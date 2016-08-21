import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Create nodemailer transporter object with email credentials
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'hello@gobackbone.com',
    pass: process.env.BL_EMAIL_PASSWORD,
  },
});

// Create email template object for use with nodemailer transporter
const confirmationTemplate = (email, url) => ({
  from: '"Backbone" <hello@gobackbone.com>',
  to: email,
  subject: 'Please confirm your email',
  text: 'Confirm your email to get started!\n\n' +
  'Thanks for signing up to Backbone, the world\'s smartest posture support! ' +
  'Click on the link to confirm your email and create your account:\n' + url,
});

// TODO: Make method send email for different templates
const send = (email) => new Promise((resolve, reject) => {
  // Generate a random token
  crypto.randomBytes(20, (err, buf) => {
    if (err) {
      reject(err);
    } else {
      const token = buf.toString('hex');

      // Add token to end of confirmation url
      const url = `${process.env.BL_DOMAIN_URL}/users/confirm?e=${email}&t=${token}`;

      // Create and send email template based on user email and url
      transporter.sendMail(confirmationTemplate(email, url), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve({ email, emailToken: token });
        }
      });
    }
  });
});

export default { send };
