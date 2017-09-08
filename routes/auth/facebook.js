import Debug from 'debug';
import request from 'request-promise';
import userDefaults from '../../lib/userDefaults';
import EmailUtility from '../../lib/EmailUtility';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';
import constants from '../../lib/constants';
import {
  getTrainingPlans,
  mapIdsToTrainingPlans,
  getDefaultTrainingPlanIds,
} from '../../lib/trainingPlans';

const debug = Debug('routes:auth:facebook');
const errorMessages = {
  invalidCredentials: 'Invalid credentials. Please try again.',
  unverifiedFacebook: 'Please verify your account through Facebook before continuing.',
  unconfirmedEmail: 'An account has already been registered with the same email ' +
    'address as your Facebook account. Please check your email to confirm your ' +
    'email address. If you have any questions, please contact support@gobackbone.com.',
};

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
  ...schemas.facebook,
  email: schemas.user.email,
}, ['accessToken', 'applicationID', 'id', 'verified'], [], { allowUnknown: true })
  .then(() => {
    const envAppId = process.env.FB_APP_ID;
    const envFBAppSecret = process.env.FB_APP_SECRET;
    const {
      accessToken: reqAccessToken,
      applicationID: reqAppId,
      id: reqUserId,
      verified: reqVerified,
    } = req.body;
    const options = {
      method: 'GET',
      uri: 'https://graph.facebook.com/debug_token',
      qs: {
        input_token: reqAccessToken,
        access_token: `${envAppId}|${envFBAppSecret}`,
      },
      json: true,
    };

    // Check if the Facebook account is verified.
    if (!reqVerified) {
      throw new Error(errorMessages.unverifiedFacebook);
    }
    // Check if the requested app ID is valid against our own env app ID.
    if (reqAppId.toString() !== envAppId.toString()) {
      throw new Error(errorMessages.invalidCredentials);
    }
    // Checks if the requested access token is valid by verify the application ID,
    // user ID, and is_valid against data from Facebook servers.
    return request(options)
      .then((result) => {
        // Throw an error if Facebook returns any errors.
        if (result.data.error) {
          debug('Failed to verify Facebook user access token', result.data.error);
          // Facebook error code for invalid user access token:
          // { code: 190, message: 'Invalid OAuth access token.' }
          if (result.data.error.code === 190) {
            throw new Error(errorMessages.invalidCredentials);
          }
          throw new Error(result.data.error.message);
        }

        const {
          app_id: debugTokenAppId,
          is_valid: debugTokenIsValid,
          user_id: debugTokenUserId,
        } = result.data;

        if (debugTokenIsValid) {
          // Token is valid so we continue to check app and user Id
          if (debugTokenAppId.toString() !== envAppId.toString() ||
              debugTokenUserId.toString() !== reqUserId.toString()) {
            throw new Error(errorMessages.invalidCredentials);
          }
        } else {
          // Token is not valid
          throw new Error(errorMessages.invalidCredentials);
        }
      });
  })
  .then(() => {
    const {
      email = null, // FB user logs in with phone number instead of email
      first_name: firstName,
      last_name: lastName,
      id: facebookId,
    } = req.body;

    // Handles weather user is male, female, or other.  Facebook will ommit
    // gender in the req.body if other.
    let gender = 3;
    if (req.body.gender) {
      gender = req.body.gender === 'male' ? 1 : 2;
    }

    // Check if there is already a user with existing email or facebookUserID
    return Promise.all([dbManager.getDb()
      .collection('users')
      .findOne({ $or: [
        { email: new RegExp(`^${email}$`, 'i') },
        { facebookId },
      ] }), getTrainingPlans()])
      .then(([user, plans]) => {
        if (!user) {
          // Create new local user for facebook user
          return dbManager.getDb()
            .collection('users')
            .insertOne(userDefaults.mergeWithDefaultData({
              email,
              firstName,
              lastName,
              facebookId,
              nickname: firstName,
              gender,
              isConfirmed: true,
              authMethod: constants.authMethods.FACEBOOK,
              createdAt: new Date(),
              trainingPlans: getDefaultTrainingPlanIds(plans),
            }))
            .then(newDoc => Object.assign({}, newDoc.ops[0], { isNew: true }));
        } else if (user.authMethod === constants.authMethods.EMAIL) {
          // User exist but signed up with email/password so we add their facebook
          // user ID to document only if their email is confirmed
          if (!user.facebookId && user.isConfirmed) {
            return dbManager.getDb()
            .collection('users')
            .findOneAndUpdate(
              { email: new RegExp(`^${email}$`, 'i') },
              { $set: { facebookId } },
              { returnOriginal: false })
            .then(updatedDoc => updatedDoc.value);
          } else if (!user.isConfirmed) {
            // User is not confirmed so we automatically resend the confirmation
            // email and throw an error back to the app.
            tokenFactory.generateToken()
              .then(([confirmationToken, confirmationTokenExpiry]) => (
                dbManager.getDb()
                  .collection('users')
                  .findOneAndUpdate(
                    // We use the DB email for confirmation because the user may
                    // have changed their email in the app so won't match their Facebook email.
                    { email: new RegExp(`^${user.email}$`, 'i') },
                    { $set: { confirmationToken, confirmationTokenExpiry } }
                  )
                  .then(() => {
                    // Initiate sending of user confirmation email
                    const emailUtility = EmailUtility.getMailer();
                    emailUtility.sendConfirmationEmail(user.email, confirmationToken);
                  })
              ));
            throw new Error(errorMessages.unconfirmedEmail);
          }
        }
        return user;
      });
  })
  .then((result) => {
    // Generate an access token
    const { _id: userId } = result;

    return tokenFactory.createAccessToken(userId)
      .then((accessToken) => {
        debug('Generated access token', accessToken);

        return dbManager.getDb()
          .collection('accessTokens')
          .insertOne({ userId, accessToken })
          .then(() => [result, accessToken]);
      });
  })
  .then(([result, accessToken]) => {
    // Return sanitized user object with access token
    const user = sanitizeUser(result);
    user.accessToken = accessToken;
    user.trainingPlans = mapIdsToTrainingPlans(user.trainingPlans, user.trainingPlanProgress);
    return user;
  })
  .catch((err) => {
    Object.keys(errorMessages).forEach((key) => {
      if (errorMessages[key] === err.message) {
        if (key === 'invalidCredentials') {
          res.status(401);
        } else {
          res.status(403);
        }
      }
    });
    throw err;
  });
