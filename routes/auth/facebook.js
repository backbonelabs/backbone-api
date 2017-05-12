import Debug from 'debug';
import request from 'request-promise';
import userDefaults from '../../lib/userDefaults';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';
import constants from '../../lib/constants';

const debug = Debug('routes:auth:facebook');
const errorMessage = 'Invalid credentials. Please try again.';

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
 * @param  {String} req.body.facebookUserID Facebook ID of the user
 * @param  {String} req.body.accessToken Facebook accessToken of the user
 * @param  {String} req.body.applicationID Backbone's Facebook applicationID
 * @param  {String} req.body.{data} User's Facebook profile information which
 * includes first name, last name, and gender
 * @return {Promise} Resolves with a user object that has an accessToken property
 */
export default (req, res) => validate(req.body, {
  email: schemas.user.email,
  accessToken: schemas.facebook.accessToken,
  applicationID: schemas.facebook.applicationID,
  id: schemas.facebook.id,
}, ['email', 'accessToken', 'applicationID', 'id'], [], { allowUnknown: true })
  .then(() => {
    const envAppID = process.env.FB_APP_ID;
    const envFBAppSecret = process.env.FB_APP_SECRET;
    const {
      accessToken: reqAccessToken,
      applicationID: reqAppID,
      id: reqUserID,
    } = req.body;
    const options = {
      method: 'GET',
      uri: 'https://graph.facebook.com/debug_token',
      qs: {
        input_token: reqAccessToken,
        access_token: `${envAppID}|${envFBAppSecret}`,
      },
      json: true,
    };

    // Check if the requested app ID is valid against our own env app ID.
    if (reqAppID !== envAppID) {
      throw new Error(errorMessage);
    }

    // Checks if the requested access token is valid by verify the application ID,
    // user ID, and is_valid against data from Facebook servers.
    return request(options)
      .then((result) => {
        const {
          app_id: debugTokenAppID,
          is_valid: debugTokenIsValid,
          user_id: debugTokenUserID,
        } = result.data;
        if (debugTokenAppID !== reqAppID ||
            debugTokenUserID !== reqUserID ||
            !debugTokenIsValid) {
          throw new Error(errorMessage);
        }
      });
  })
  .then(() => {
    const {
      email,
      gender,
      first_name: firstName,
      last_name: lastName,
      id: facebookUserID,
    } = req.body;

    // Check if there is already a user with existing email or facebookUserID
    return dbManager.getDb()
      .collection('users')
      .findOne({ $or: [
        { email: new RegExp(email, 'i') },
        { facebookUserID },
      ] })
      .then((user) => {
        if (!user) {
          // Create new local user for facebook user
          return dbManager.getDb()
            .collection('users')
            .insertOne(userDefaults.mergeWithDefaultData({
              email,
              firstName,
              lastName,
              facebookUserID,
              nickName: firstName,
              gender: (gender === 'male' ? 1 : 2),
              password: null,
              isConfirmed: true,
              authMethod: constants.authMethod.FACEBOOK,
              createdAt: new Date(),
            }))
            .then(newDoc => newDoc.ops[0]);
        } else if (user.authMethod === constants.authMethod.EMAIL) {
          // User exist but signed up with email/password so we add their facebook
          // user ID to document
          if (!user.facebookUserID) {
            return dbManager.getDb()
            .collection('users')
            .findOneAndUpdate(
              { email: new RegExp(email, 'i') },
              { $set: { facebookUserID } },
              { returnOriginal: false })
            .then(updatedDoc => updatedDoc.value);
          }
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
