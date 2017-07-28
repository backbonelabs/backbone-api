import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import passwordUtil from '../../lib/password';
import tokenFactory from '../../lib/tokenFactory';
import { mapIdsToTrainingPlans } from '../../lib/trainingPlans';

const debug = Debug('routes:auth:login');
const errorMessage = 'Invalid login credentials. Please try again.';

/**
 * Verifies a user account by checking the email and password and returns the
 * user object with an access token added to the user object. The access token
 * can be used in subsequent requests to access protected API endpoints. The
 * access token is a hash of the user ID and current timestamp separated by a
 * colon.
 *
 * @param  {Object} req               Request
 * @param  {Object} req.body          Request body
 * @param  {String} req.body.email    Email address of the user
 * @param  {String} req.body.password Password of the user
 * @return {Promise} Resolves with a user object that has an accessToken property
 */
export default (req, res) => validate(req.body, {
  email: schemas.user.email,
  password: schemas.password,
}, ['email', 'password'])
  .then(() => {
    const { email } = req.body;

    // Look up user by email
    return dbManager.getDb()
      .collection('users')
      .find({ email: new RegExp(`^${req.body.email}$`, 'i') })
      .limit(1)
      .next()
      .then((user) => {
        if (user) {
          debug('Found user by email', email);
          return user;
        }
        debug('Did not find user by email', email);
        throw new Error(errorMessage);
      });
  })
  .then(user => (
    // Verify password matches
    Promise.all([user, passwordUtil.verify(req.body.password, user.password)])
  ))
  .then(([user, isPasswordMatch]) => {
    if (!isPasswordMatch) {
      debug('Invalid password');
      throw new Error(errorMessage);
    }
    return user;
  })
  .then((user) => {
    // Generate an access token
    const { _id: userId } = user;

    return tokenFactory.createAccessToken(userId)
      .then((accessToken) => {
        debug('Generated access token', accessToken);

        return dbManager.getDb()
          .collection('accessTokens')
          .insertOne({ userId, accessToken })
          .then(() => [user, accessToken]);
      });
  })
  .then(([user, accessToken]) => {
    // Return sanitized user object with access token and training plan details
    const userResult = sanitizeUser(user);
    userResult.accessToken = accessToken;
    userResult.trainingPlans = mapIdsToTrainingPlans(user.trainingPlans);
    return userResult;
  })
  .catch((err) => {
    if (err.message === errorMessage) {
      // Use 401 status code for invalid auth errors
      res.status(401);
    }
    throw err;
  });
