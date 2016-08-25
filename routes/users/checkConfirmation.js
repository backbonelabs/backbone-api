import crypto from 'crypto';
import dbManager from '../../lib/dbManager';

export default (req, res) => {
  const email = req.params.email;
  return dbManager.getDb()
    .collection('users')
    .findOne({ email })
    .then(user => {
      if (user && !user.isConfirmed) {
        res.status(401);
      } else {
        const { _id: userId } = user;
        const hmac = crypto.createHmac('sha256', process.env.BL_ACCESS_TOKEN_SECRET);
        hmac.update(`${userId}:${Date.now()}`);
        const accessToken = hmac.digest('hex');

        return dbManager.getDb()
        .collection('accessTokens')
        .insertOne({ userId, accessToken })
        .then(() => ({
          userId,
          accessToken,
        }));
      }
    });
};
