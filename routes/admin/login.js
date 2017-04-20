import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import passwordUtil from '../../lib/password';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';

const debug = Debug('routes:admin:login');
const errorMessage = 'Invalid login credentials. Please try again.';

/**
 * Verifies an internal user account by checking the email and password and returns the
 * user object. A new access token is also regenerated and stored with the user. The access
 * token can be used in subsequent requests to access protected API endpoints.
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
      .collection('internalUsers')
      .find({ email: new RegExp(email, 'i') })
      .limit(1)
      .next()
      .then((user) => {
        if (user) {
          debug('Found internal user by email', email);
          return user;
        }
        debug('Did not find internal user by email', email);
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

        // Store access token with user
        return dbManager.getDb()
          .collection('internalUsers')
          .findOneAndUpdate(
            { _id: dbManager.mongodb.ObjectId(userId) },
            { $set: { accessToken } },
            { returnOriginal: false }
          );
      });
  })
  .then(result => sanitizeUser(result.value))
  .catch((err) => {
    if (err.message === errorMessage) {
      // Use 401 status code for invalid auth errors
      res.status(401);
    }
    throw err;
  });
