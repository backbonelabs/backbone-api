import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Create a transporter object with email service/credentials
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'hello@gobackbone.com',
    pass: process.env.BL_EMAIL_PASSWORD,
  },
});

const generateEmailToken = () => new Promise((resolve, reject) => {
  crypto.randomBytes(20, (err, buf) => {
    if (err) {
      reject(err);
    } else {
      const token = buf.toString('hex');
      resolve(token);
    }
  });
});

const sendConfirmationEmail = (email, token) => new Promise((resolve, reject) => {
  const link = `${process.env.BL_DOMAIN_URL}/auth/confirm?token=${token}`;

  transporter.sendMail({
    from: '"Backbone" <hello@gobackbone.com>',
    to: email,
    subject: 'Please confirm your email',
    text: 'Confirm your email to get started!\n\nThanks for signing up ' +
    'to Backbone, the world\'s smartest posture support! Click on the ' +
    'link to confirm your email and create your account:\n' + link,
  }, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});

export default { sendConfirmationEmail, generateEmailToken };
