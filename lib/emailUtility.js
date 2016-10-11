import mailgun from 'mailgun-js';
import Debug from 'debug';

/**
 * @const  {String}  apiKey  Mailgun API key
 * @const  {String}  domain  Authorized domain to send Mailgun emails from
 * @const  {Object}  mailer  Mailgun object with API/domain credentials
 */
const apiKey = process.env.BL_MAILGUN_API;
const domain = process.env.BL_MAILGUN_DOMAIN;
const mailer = mailgun({ apiKey, domain });
const debug = Debug('lib:emailUtility');

// Object properties containing email information for different use cases
const templates = {
  from: `Backbone <hello@${process.env.BL_MAILGUN_DOMAIN}>`,
  confirmEmail: {
    subject: 'Confirm Email Address',
    text: 'Thanks for signing up to Backbone, the world\'s smartest posture ' +
    'support!\n\nClick on this link to confirm your email address and create ' +
    'your Backbone account:\n',
  },
  passwordReset: {
    subject: 'Confirm Password Reset',
    text: 'You\'ve requested to reset the password for your Backbone account.\n\n' +
    'Click on this link to confirm your request and reset your password:\n',
  },
};

/**
 * Sends the user an email.
 * @param  {Object}  data   Contains necessary email information (e.g. email subject)
 * @param  {String}  email  User email
 * @param  {String}  link   Link containing user-specific token
 * @return {Promise} Rejects on error sending email and resolves with undefined
 */
const sendEmail = (data, email, link) => new Promise((resolve, reject) => {
  const packagedData = Object.assign({ to: email, from: templates.from }, data);
  packagedData.text += link;

  mailer.messages().send(packagedData, (error) => {
    if (error) {
      debug('Error sending email', error);
      reject(new Error('Error sending email'));
    } else {
      resolve();
    }
  });
});

/**
 * Creates a confirmation link and initiates sending a confirmation email.
 * @param  {String}  email  User email
 * @param  {String}  token  Token used to look up and validate an email confirmation attempt
 */
const sendConfirmationEmail = (email, token) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;
  return sendEmail(templates.confirmEmail, email, link);
};

/**
 * Creates a password reset link and initiates sending a password reset email.
 * @param  {String}  email  User email
 * @param  {String}  token  Token used to look up and validate an email confirmation attempt
 */
const sendPasswordResetEmail = (email, token) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/password?token=${token}`;
  return sendEmail(templates.passwordReset, email, link);
};

export default { sendConfirmationEmail, sendPasswordResetEmail };
