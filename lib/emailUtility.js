import mailgun from 'mailgun-js';

const apiKey = process.env.BL_MAILGUN_API;
const domain = process.env.BL_MAILGUN_DOMAIN;
const mailer = mailgun({ apiKey, domain });

const templates = {
  confirmEmail: {
    from: `Backbone <hello@${process.env.BL_MAILGUN_DOMAIN}>`,
    subject: 'Confirm Email Address',
    text: 'Thanks for signing up to Backbone, the world\'s smartest posture ' +
    'support!\n\nClick on this link to confirm your email address and create ' +
    'your Backbone account:\n',
  },
  passwordReset: {
    from: `Backbone <hello@${process.env.BL_MAILGUN_DOMAIN}>`,
    subject: 'Confirm Password Reset',
    text: 'You\'ve requested to reset the password for your Backbone account.\n\n' +
    'Click on this link to confirm your request and reset your password:\n',
  },
};

function sendEmail(data, token, email, link, resolve, reject) {
  const packagedData = Object.assign({ to: email }, data);
  packagedData.text += link;

  mailer.messages().send(packagedData, (error) => {
    if (error) {
      reject(false);
    } else {
      resolve(true);
    }
  });
}

const sendConfirmationEmail = (email, token) => new Promise((resolve, reject) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;
  return sendEmail(templates.confirmEmail, token, email, link, resolve, reject);
});

const sendPasswordResetEmail = (email, token) => new Promise((resolve, reject) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/password?token=${token}`;
  sendEmail(templates.passwordReset, token, email, link, resolve, reject);
});

export default { sendConfirmationEmail, sendPasswordResetEmail };
