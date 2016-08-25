import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';

export default (req, res) => {
  const email = req.params.email;
  return dbManager.getDb()
    .collection('users')
    .findOne({ email })
    .then((user) => {
      if (!user) {
        res.status(400);
        throw new Error('Account not found, please sign-up again');
      } else if (!user.isConfirmed) {
        res.status(401);
        return;
      } else {
        const { _id: userId } = user;
        return tokenFactory.createAccessToken(userId)
        .then((accessToken) => (
          dbManager.getDb()
            .collection('accessTokens')
            .insertOne({ userId, accessToken })
            .then(() => ({ userId, accessToken }))
        ));
      }
    });
};
