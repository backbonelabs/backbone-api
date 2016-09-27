import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import tokenFactory from '../../lib/tokenFactory';
import userDefaults from '../../lib/userDefaults';
import sanitizeUser from '../../lib/sanitizeUser';

/**
 * Creates a new user after checking there are no existing users with the same email
 * Sends a confirmation email after creating a new user account
 * @param  {Object} req                     Request
 * @param  {Object} req.body                Request body
 * @param  {String} req.body.email          Email
 * @param  {String} req.body.password       Password
 * @return {Promise} Resolves with the user object without their password, rejects if
 *                   the email address is already registered to another user.
 */
export default req => validate(req.body, {
  email: schemas.user.email,
  password: schemas.password,
}, ['email', 'password'], ['_id'])
  .catch(() => {
    throw new Error('Email must be a valid email format. Password must be at least 8 characters');
  })
  .then(() => (
    // Check if there is already a user with the email
    dbManager.getDb()
    .collection('users')
    .findOne({ email: req.body.email })
    .then(user => {
      if (user) {
        // Email is already associated to a confirmed user
        throw new Error('Email is not available');
      } else {
        // Email is not associated to any existing users, hash password
        return password.hash(req.body.password);
      }
    })
    .then(hash => (
      // Generate an accessToken
      tokenFactory.createAccessToken()
        .then(accessToken => (
          dbManager.getDb()
            .collection('users')
            .insertOne(userDefaults.mergeWithDefaultData({
              email: req.body.email,
              password: hash,
              createdAt: new Date(),
              accessToken,
            }))
            .then((result) => {
              const { ops: user, insertedId: userId } = result;

              // Store accessToken along with userId
              return dbManager.getDb()
                .collection('accessTokens')
                .insertOne({ userId, accessToken })
                .then(() => sanitizeUser(user[0]));
            })
      ))
    ))
  ));
