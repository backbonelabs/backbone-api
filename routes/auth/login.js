import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import passwordUtil from '../../lib/password';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';

const debug = Debug('routes:auth:login');
const errorMessage = 'Invalid login credentials. Please try again.';
const notConfirmedMessage = 'Email is not confirmed. Please check your inbox.';

/**
 * Verifies a user account by checking the email and password and returns an
 * object with an access token that the user can use in subsequent requests
 * to access protected API endpoints. The access token is a hash of the user
 * ID and current timestamp separated by a colon.
 *
 * If an access token is provided in lieu of an email and password, then a query
 * will be made to find a user account associated to the provided access token.
 * If there is a matching user account, the access token will be replaced with
 * a new access token and the new access token will be returned.
 * @param  {Object} req                  Request
 * @param  {Object} req.body             Request body
 * @param  {String} req.body.email       Email address of the user
 * @param  {String} req.body.password    Password of the user
 * @param  {String} req.body.accessToken Access token associated to the user (will
 *                                       only be used if email and password are
 *                                       not available)
 * @return {Promise} Resolves with a user object
 */
export default (req, res) => validate(req.body, {
  email: schemas.user.email,
  password: schemas.password,
  accessToken: schemas.accessToken,
})
  .then(() => {
    const { email, password, accessToken } = req.body;

    if (email && !password) {
      throw new Error('Password required');
    } else if (!email && password) {
      throw new Error('Email required');
    } else if (!email && !password && !accessToken) {
      throw new Error('Missing authentication credentials');
    }

    if (email && password) {
      // Look up user by email and password
      return dbManager.getDb()
        .collection('users')
        .find({ email })
        .limit(1)
        .next()
        .then(user => {
          if (user) {
            debug('Found user by email', email);
            return user;
          }
          debug('Did not find user by email', email);
          throw new Error(errorMessage);
        })
        .then(user => (
          // Verify password matches
          Promise.all([user, passwordUtil.verify(password, user.password)])
        ))
        .then(([user, isPasswordMatch]) => {
          if (isPasswordMatch && !user.isConfirmed) {
            throw new Error('Email is not confirmed. Please check your inbox.');
          } else if (!isPasswordMatch) {
            throw new Error(errorMessage);
          }
          return user;
        });
    }

    // Look up user by access token
    debug('Looking up user by access token', accessToken);
    // Use findOneAndDelete because if a user is found by access token,
    // a new access token will be generated, and if no user is found,
    // then there's no point in keeping the access token
    return dbManager.getDb()
      .collection('accessTokens')
      .findOneAndDelete({ accessToken })
      .then(result => {
        const accessTokenRecord = result.value;
        if (accessTokenRecord) {
          debug('Found and deleted access token', accessTokenRecord);
          return dbManager.getDb()
            .collection('users')
            .find({ _id: dbManager.mongodb.ObjectId(accessTokenRecord.userId) })
            .limit(1)
            .next()
            .then(user => {
              if (user) {
                debug('Found user by access token', accessToken);
                return user;
              }
              debug('Did not find user by access token', accessToken);
              throw new Error(errorMessage);
            });
        }
        debug('Did not find access token', accessToken);
        throw new Error(errorMessage);
      });
  })
  .then(user => {
    // Generate an access token
    const { _id: userId } = user;

    return tokenFactory.createAccessToken(userId)
      .then(accessToken => {
        debug('Generated access token', accessToken);

        return dbManager.getDb()
          .collection('accessTokens')
          .insertOne({ userId, accessToken })
          .then(() => [user, accessToken]);
      });
  })
  .then(([user, accessToken]) => {
    // Return sanitized user object with access token
    const userResult = sanitizeUser(user);
    userResult.accessToken = accessToken;
    return userResult;
  })
  .catch(err => {
    if (err.message === errorMessage || err.message === notConfirmedMessage) {
      res.status(401);
    }
    throw err;
  });
