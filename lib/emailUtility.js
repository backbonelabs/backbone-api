import mailgun from 'mailgun-js';
import Debug from 'debug';

const debug = Debug('lib:emailUtility');

/**
 * @const {String} apiKey Mailgun API key
 * @const {String} domain Authorized domain to send Mailgun emails from
 * @const {Object} mailer Mailgun object used to interact with the Mailgun API
 */
const apiKey = process.env.BL_MAILGUN_API;
const domain = process.env.BL_MAILGUN_DOMAIN;
const mailer = mailgun({ apiKey, domain });

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
 * Sends an email using Mailgun
 * @param  {Object}  data  Contains necessary email information (e.g. email subject)
 * @param  {String}  email Recipient email address
 * @return {Promise} Resolves with undefined on success, rejects on any error
 */
const sendEmail = (data, email) => new Promise((resolve, reject) => {
  const packagedData = Object.assign({ to: email, from: templates.from }, data);

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
 * Sends the email confirmation email
 * @param {String}  email Recipient email address
 * @param {String}  token Token used to look up and validate an email confirmation attempt
 * @return {Promise} Resolves with undefined on success, rejects on any error
 */
const sendConfirmationEmail = (email, token) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;
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
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/password?token=${token}`;
  const template = { ...templates.passwordReset };
  template.text = `${template.text}${link}`;
  return sendEmail(template, email);
};

export default { sendConfirmationEmail, sendPasswordResetEmail };
