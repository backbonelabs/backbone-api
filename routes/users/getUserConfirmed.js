import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import sanitizeUser from '../../lib/sanitizeUser';

export default (req, res) => {
  const email = req.params.email;
  return dbManager.getDb()
    .collection('users')
    .findOne({ email })
    .then(user => {
      if (user && !user.isConfirmed) {
        res.status(401);
      } else if (user && user.isConfirmed) {
        const { _id: userId } = user;

        return tokenFactory.createAccessToken(userId)
          .then(accessToken => (
            dbManager.getDb()
              .collection('accessTokens')
              .insertOne({ userId, accessToken })
              .then(() => [user, accessToken])
          ));
      } else {
        // TODO: Stop app from scanning, since user doesn't exist
      }
    })
    .then(([user, accessToken]) => {
      console.log('user ', user, ' accessToken ', accessToken);
      // Return sanitized user object with access token
      const userResult = sanitizeUser(user);
      userResult.accessToken = accessToken;
      return userResult;
    });
};
