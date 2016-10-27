import mailgun from 'mailgun-js';
import Debug from 'debug';

const debug = Debug('lib:emailUtility');
const {
  NODE_ENV,
  BL_DOMAIN_URL,
  BL_WEB_URL,
  BL_MAILGUN_API,
  BL_MAILGUN_DOMAIN,
  BL_SILENT_EMAIL,
  BL_USE_TEST_EMAIL,
  BL_TEST_EMAIL,
} = process.env;

/**
 * Mailgun object used to interact with the Mailgun API
 * @const {Object} mailer
 */
const mailer = mailgun({
  apiKey: BL_MAILGUN_API,
  domain: BL_MAILGUN_DOMAIN,
});

/**
 * Default email address to use as the sender
 * @const {String} fromAddress
 */
const fromAddress = `Backbone <hello@${BL_MAILGUN_DOMAIN}>`;

/**
 * The Node.js environment
 * @const {String} env
 */
const env = NODE_ENV;

/**
 * Flag for determining whether or not to send emails
 * @const {Boolean} silentEmail
 */
const silentEmail = BL_SILENT_EMAIL === true || BL_SILENT_EMAIL === 'true';

/**
 * Flag for determining whether or not to send emails to the test email
 * @const {Boolean} useTestEmail
 */
const useTestEmail = BL_USE_TEST_EMAIL === true || BL_USE_TEST_EMAIL === 'true';

/**
 * Email to use as the recipient when not in production
 * @const {String} testEmail
 */
const testEmail = BL_TEST_EMAIL;

/**
 * Data properties for various email templates
 * @const {Object} templates
 */
const templates = {
  confirmEmail: {
    subject: 'Confirm your email address',
    text: 'Thanks for signing up to Backbone, the world\'s smartest posture ' +
    'support!\n\nClick on this link to confirm your email address and verify ' +
    'your account:\n',
  },
  passwordReset: {
    subject: 'Reset your Backbone password',
    text: 'You\'ve requested to reset the password for your Backbone account. ' +
    'If this wasn\'t you, please contact support@gobackbone.com immediately.\n\n' +
    'Otherwise, click on this link to confirm your request and reset your password:\n',
  },
  passwordResetSuccess: {
    subject: 'Backbone password reset successful',
    text: 'You have successfully reset your password.\n\n' +
    'If this wasn\'t you, please contact support@gobackbone.com immediately.',
  },
};

/**
 * Sends an email using Mailgun. The email will only be sent if the BL_SILENT_EMAIL
 * environment variable is false, and the email will be sent to the email passed in
 * the second parameter only if the environment is production or the BL_USE_TEST_EMAIL
 * environment variable is false. Otherwise, the BL_TEST_EMAIL will be used as the recipient.
 *
 * @param  {Object}  data  Contains necessary email information (e.g. email subject)
 * @param  {String}  email Recipient email address
 * @return {Promise} Resolves with undefined on success, rejects on any error
 */
const sendEmail = (data = {}, email) => new Promise((resolve, reject) => {
  if (silentEmail) {
    // Silent email flag is true, do not send email
    resolve();
  } else {
    const packagedData = Object.assign({
      to: env === 'production' || !useTestEmail ? email : testEmail,
      from: fromAddress,
    }, data);

    mailer.messages().send(packagedData, (error) => {
      if (error) {
        debug('Error sending email', error);
        reject(new Error('Error sending email'));
      } else {
        resolve();
      }
    });
  }
});

/**
 * Sends the email confirmation email
 * @param {String}  email Recipient email address
 * @param {String}  token Token used to look up and validate an email confirmation attempt
 * @return {Promise} Resolves with undefined on success, rejects on any error
 */
const sendConfirmationEmail = (email, token) => {
  const link = `${BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;
  const template = { ...templates.confirmEmail };
  template.text = `${template.text}${link}`;
  return sendEmail(template, email);
};

/**
 * Sends the password reset email
 * @param  {String}  email Recipient email address
 * @param  {String}  token Token used to look up and validate a password reset request
 * @return {Promise} Resolves with undefined on success, rejects on any error
 */
const sendPasswordResetEmail = (email, token) => {
  const link = `${BL_WEB_URL}/password-reset?token=${token}`;
  const template = { ...templates.passwordReset };
  template.text = `${template.text}${link}`;
  return sendEmail(template, email);
};

const sendPasswordResetSuccessEmail = email => sendEmail(templates.passwordResetSuccess, email);

export default { sendConfirmationEmail, sendPasswordResetEmail, sendPasswordResetSuccessEmail };
