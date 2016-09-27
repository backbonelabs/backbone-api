import mailgun from 'mailgun-js';

/**
 * @const  {String}    apiKey  Mailgun API key
 * @const  {String}    domain  Authorized domain to send Mailgun emails from
 * @const  {Object}    mailer  Mailgun object with API/domain credentials
 * @const  {Function}  sendConfirmationEmail  Sends confirmation emails
 */

const apiKey = process.env.BL_MAILGUN_API;
const domain = process.env.BL_MAILGUN_DOMAIN;
const mailer = mailgun({ apiKey, domain });

const sendConfirmationEmail = (email, token) => new Promise((resolve, reject) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm?token=${token}`;

  const data = {
    from: `Backbone <hello@${process.env.BL_MAILGUN_DOMAIN}>`,
    to: email,
    subject: 'Please confirm your email',
    text: 'Confirm your email to get started!\n\nThanks for signing up ' +
    'to Backbone, the world\'s smartest posture support! Click on the ' +
    'link to confirm your email and create your account:\n' + link,
  };

  mailer.messages().send(data, (error, body) => {
    if (error) {
      reject(error);
    } else {
      resolve(body);
    }
  });
});

export default { sendConfirmationEmail };
