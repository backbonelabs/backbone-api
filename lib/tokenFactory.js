import crypto from 'crypto';

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

export default { createAccessToken, createConfirmationToken };
