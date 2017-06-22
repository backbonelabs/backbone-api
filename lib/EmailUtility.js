import mailgun from 'mailgun-js';
import Debug from 'debug';

const debug = Debug('lib:emailUtility');
const {
  NODE_ENV,
  BL_DOMAIN_URL,
  BL_WEB_URL,
  BL_SILENT_EMAIL,
  BL_USE_TEST_EMAIL,
  BL_TEST_EMAIL,
} = process.env;

/**
 * Backbone support email address
 * @const {String} supportEmailAddress
 */
const supportEmailAddress = 'support@gobackbone.com';

/**
 * Default email address to use as the sender
 * @const {String} fromAddress
 */
const fromAddress = `Backbone Labs <${supportEmailAddress}>`;

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
  supportTicket: {
    subject: 'Backbone support ticket',
  },
};

let emailUtility;

/**
 * A class which uses the Mailgun API to send email messages
 */
class EmailUtility {
  /**
   * @param {Object}  options
   * @param {String}  options.apiKey API key for the Mailgun service
   * @param {String}  options.domain Email domain to use for the Mailgun service
   * @param {String}  [options.fromAddress='Backbone <hello@${process.env.BL_MAILGUN_DOMAIN}>']
   *                                 String to use as the sender
   * @param {Boolean} [options.silentEmail=process.env.BL_SILENT_EMAIL]
   *                                 Whether or not to actually send messages using Mailgun
   * @param {Boolean} [options.useTestEmail=process.env.BL_USE_TEST_EMAIL]
   *                                 Whether or not to send all messages to a single test email
   * @param {String}  [options.testEmail=process.env.BL_TEST_EMAIL]
   *                                 Email to send all messages to when useTestEmail is true
   */
  constructor(options = {}) {
    const { apiKey, domain } = options;
    this.mailer = mailgun({
      apiKey,
      domain,
    });
    this.fromAddress = options.fromAddress || fromAddress;
    this.silentEmail = options.silentEmail === undefined ? silentEmail : options.silentEmail;
    this.useTestEmail = options.useTestEmail === undefined ? useTestEmail : options.useTestEmail;
    this.testEmail = options.testEmail || testEmail;
  }

  /**
   * Sends an email using Mailgun. The email will only be sent if the silentEmail option is
   * false, and the email will be sent to the email passed in the second parameter only if
   * the environment is production or the useTestEmail option is false. Otherwise, the value
   * for the testEmail option will be used as the recipient.
   *
   * @param  {Object}  data  Contains necessary email information (e.g. email subject)
   * @param  {String}  email Recipient email address
   * @return {Promise} Resolves with undefined on success, rejects on any error
   */
  sendEmail(data = {}, email) {
    return new Promise((resolve, reject) => {
      if (this.silentEmail) {
        // Silent email flag is true, do not send email
        resolve();
      } else {
        const packagedData = Object.assign({
          to: env === 'production' || !this.useTestEmail ? email : this.testEmail,
          from: this.fromAddress,
        }, data);

        this.mailer.messages().send(packagedData, (error) => {
          if (error) {
            debug('Error sending email', error);
            reject(new Error('Error sending email'));
          } else {
            resolve();
          }
        });
      }
    });
  }

  /**
   * Sends the email confirmation email
   * @param {String}   email Recipient email address
   * @param {String}   token Token used to look up and validate an email confirmation attempt
   * @return {Promise} Resolves with undefined on success, rejects on any error
   */
  sendConfirmationEmail(email, token) {
    const link = `${BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;
    const template = { ...templates.confirmEmail };
    template.text = `${template.text}${link}`;
    return this.sendEmail(template, email);
  }

  /**
   * Sends the password reset email
   * @param  {String}  email Recipient email address
   * @param  {String}  token Token used to look up and validate a password reset request
   * @return {Promise} Resolves with undefined on success, rejects on any error
   */
  sendPasswordResetEmail(email, token) {
    const link = `${BL_WEB_URL}/password-reset?token=${token}`;
    const template = { ...templates.passwordReset };
    template.text = `${template.text}${link}`;
    return this.sendEmail(template, email);
  }

  /**
   * Sends a confirmation email upon successful password reset
   * @param  {String}  email Receipient email address
   * @return {Promise} Resolves with undefined on success, rejects on any error
   */
  sendPasswordResetSuccessEmail(email) {
    return this.sendEmail(templates.passwordResetSuccess, email);
  }

  /**
   * Sends an email to the Backbone support inbox
   * @param  {String}  userEmail Email address of the user who submitted the support ticket
   * @param  {String}  message   Message
   * @return {Promise} Resolves with undefined on success, rejects on any error
   */
  sendSupportEmail(userEmail, message) {
    return this.sendEmail({
      ...templates.supportTicket,
      from: userEmail,
      text: message,
    }, supportEmailAddress);
  }
}

/**
 * Initializes a new EmailUtility instance that will be used by default when
 * modules call EmailUtility.getMailer()
 * @param  {Object} options Config options which will be passed to the EmailUtility constructor.
 *                          See doc comments for the constructor.
 * @return {EmailUtility} A new EmailUtility instance
 */
const init = (options) => {
  emailUtility = new EmailUtility(options);
  return emailUtility;
};

/**
 * Returns the current EmailUtility instance
 * @return {EmailUtility}
 */
const getMailer = () => emailUtility;

export default {
  EmailUtility,
  init,
  getMailer,
  templates,
};
