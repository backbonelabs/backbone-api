import mailgun from 'mailgun-js';

const apiKey = process.env.BL_MAILGUN_API;
const domain = process.env.BL_MAILGUN_DOMAIN;
const mailer = mailgun({ apiKey, domain });

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

const sendEmail = (data, email, link) => new Promise((resolve, reject) => {
  const packagedData = Object.assign({ to: email, from: templates.from }, data);
  packagedData.text += link;

  return mailer.messages().send(packagedData, (error, body) => {
    if (error) {
      reject(error);
    }
    resolve(!!body);
  });
});

const sendConfirmationEmail = (email, token) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;
  return sendEmail(templates.confirmEmail, email, link);
};

const sendPasswordResetEmail = (email, token) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/password?token=${token}`;
  return sendEmail(templates.passwordReset, email, link);
};

export default { sendConfirmationEmail, sendPasswordResetEmail };
