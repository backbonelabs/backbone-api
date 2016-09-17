import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import sanitizeUser from '../../lib/sanitizeUser';

/**
 * Checks if a user is confirmed
 * @param  {Object} req              Request
 * @param  {Object} req.params       Request parameters
 * @param  {String} req.params.email User's email address
 * @param  {Object} res              Response
 * @return {Promise} Resolves with a boolean indicating whether the user is confirmed or not
 */
export default (req, res) => {
  const email = req.params.email;
  return dbManager.getDb()
    .collection('users')
    .findOne({ email })
    .then(user => {
      if (user && !user.isConfirmed) {
        res.status(401);
        throw new Error('User has not confirmed email.');
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
        throw new Error('This user does not exist.');
      }
    })
    .then(([user, accessToken]) => {
      // Return sanitized user object with access token
      const userResult = sanitizeUser(user);
      userResult.accessToken = accessToken;
      return userResult;
    });
};
