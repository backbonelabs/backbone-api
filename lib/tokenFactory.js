import crypto from 'crypto';

/**
 * Creates a token specifically for application authentication use.
 * @param  {String}  userId  User ID
 * @return {Promise} Rejects if undefined accessToken or resolves with the accessToken
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

/**
 * Generates a token and 2-day token expiry for email confirmation and password reset use cases.
 * @return {Promise} Rejects if error/token is undefined or resolves with token and tokenExpiry
 */
const generateToken = () => new Promise((resolve, reject) => {
  crypto.randomBytes(20, (err, buf) => {
    const token = buf.toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 2);

    if (err || !token) {
      reject(err);
    } else {
      resolve([token, tokenExpiry]);
    }
  });
});

export default { createAccessToken, generateToken };
