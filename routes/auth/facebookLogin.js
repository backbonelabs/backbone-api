import Debug from 'debug';
import request from 'request-promise';
import userDefaults from '../../lib/userDefaults';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';

const debug = Debug('routes.auth.facebookLogin');
const errorMessage = 'Invalid credentials.  Please try again.';

/**
 * Verifies a user account by checking validity of user's Facebook access token
 * and returns the user object with an access token added to the user object.
 * The access token can be used in subsequent requests to access protected
 * API endpoints. The access token is a hash of the user ID and current
 * timestamp separated by a colon.
 *
 * @param  {Object} req               Request
 * @param  {Object} req.body          Request body
 * @param  {String} req.body.email    Email address of the user
 * @param  {String} req.body.accessToken Facebook accessToken of the user
 * @param  {String} req.body.applicationID Backbone's Facebook applicationID
 * @param  {String} req.body.{data} User's Facebook profile information which
 * includes first and last name, gender, and birthday
 * @return {Promise} Resolves with a user object that has an accessToken property
 */
export default (req, res) => validate(req.body, {
  email: schemas.user.email,
  accessToken: schemas.facebook.accessToken,
  applicationID: schemas.facebook.applicationID,
}, ['email', 'accessToken', 'applicationID'], [], { allowUnknown: true })
  .catch(() => {
    throw new Error(errorMessage);
  })
  .then(() => {
    const envAppID = process.env.APP_ID;
    const {
      accessToken: reqAccessToken,
      applicationID: reqAppID,
    } = req.body;
    const options = {
      method: 'GET',
      uri: 'https://graph.facebook.com/debug_token',
      qs: {
        input_token: reqAccessToken,
        access_token: `${envAppID}|${process.env.APP_SECRET}`,
      },
      json: true,
    };

    // Check if the requested app ID is valid.
    if (reqAppID !== envAppID) {
      throw new Error(errorMessage);
    }

    // Checks whether the requested access token is valid and the
    // application ID returned by facebook.
    return request(options)
      .then((result) => {
        const { app_id: debugTokenAppID, is_valid: isValid } = result.data;
        if (debugTokenAppID !== envAppID || !isValid) {
          throw new Error(errorMessage);
        }
      })
      .catch(() => {
        throw new Error('Unable to verify identity.  Try again later.');
      });
  })
  .then(() => {
    const {
      email,
      gender,
      first_name: firstName,
      last_name: lastName,
      birthday: birthdate,
    } = req.body;

    // Check if there is already a user with this email
    return dbManager.getDb()
      .collection('users')
      .find({ email: new RegExp(email, 'i') })
      .limit(1)
      .next()
      .then((user) => {
        if (!user) {
          // Create new local user for facebook user
          return dbManager.getDb()
            .collection('users')
            .insertOne(userDefaults.mergeWithDefaultData({
              email,
              firstName,
              lastName,
              nickName: firstName,
              gender: (gender === 'male' ? 1 : 2),
              birthdate: (birthdate ? (new Date(birthdate)) : null),
              password: null,
              isConfirmed: true,
              authMethod: 'facebook',
              createdAt: new Date(),
            }))
            .then(newDoc => newDoc.ops[0]);
        } else if (user.authMethod === 'password') {
          // Throws error because user already resgistered with email and password
          throw new Error('Please login using your email and password');
        }
        return user;
      });
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
    // Return sanitized user object with access token
    const userResult = sanitizeUser(user);
    userResult.accessToken = accessToken;
    return userResult;
  })
  .catch((err) => {
    if (err.message === errorMessage) {
      // Use 401 status code for invalid auth errors
      res.status(401);
    }
    throw err;
  });
