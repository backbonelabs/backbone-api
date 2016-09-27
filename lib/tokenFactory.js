import crypto from 'crypto';

/**
 * Factory for handling the creation of tokens for various use cases
 * @const  {Function}  createAccessToken  Creates an access token for authentication
 * @const  {Function}  createConfirmationToken  Creates a token for email verification
 */

const createAccessToken = (userId) => new Promise((resolve, reject) => {
  const hmac = crypto.createHmac('sha256', process.env.BL_ACCESS_TOKEN_SECRET);
  hmac.update(`${userId}:${Date.now()}`);
  const accessToken = hmac.digest('hex');

  if (!accessToken) {
    reject();
  } else {
    resolve(accessToken);
  }
});

const createConfirmationToken = () => new Promise((resolve, reject) => {
  crypto.randomBytes(20, (err, buf) => {
    const confirmationToken = buf.toString('hex');
    const confirmationTokenExpiry = new Date();
    confirmationTokenExpiry.setDate(confirmationTokenExpiry.getDate() + 2);

    if (err || !confirmationToken) {
      reject(err);
    } else {
      resolve([confirmationToken, confirmationTokenExpiry]);
    }
  });
});

export default { createAccessToken, createConfirmationToken };
