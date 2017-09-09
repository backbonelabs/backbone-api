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
export const errors = {
  invalidCredentials: {
    message: 'Invalid credentials. Please try again.',
    code: 401,
  },
  unverifiedFacebook: {
    message: 'Please verify your account through Facebook before continuing.',
    code: 403,
  },
  unconfirmedEmail: {
    message: 'Your email address is already registered with another account. ' +
    'Please check your email to confirm your email address before connecting with your ' +
    'Facebook account. Please contact support@gobackbone.com if you need assistance.',
    code: 401,
  },
};

/**
 * Verifies a user account by checking validity of user's Facebook access token
 * and returns the user object with an access token added to the user object.
 * The access token can be used in subsequent requests to access protected
 * API endpoints. The access token is a hash of the user ID and current
 * timestamp separated by a colon.
 *
 * @param  {Object} req                    Request
 * @param  {Object} req.body               Request body
 * @param  {String} req.body.email         Email address of the user
 * @param  {String} req.body.id            Facebook ID of the user
 * @param  {String} req.body.accessToken   Facebook accessToken of the user
 * @param  {String} req.body.applicationID Backbone's Facebook applicationID
 * @param  {String} req.body.{data}        User's Facebook profile information which
 *                                         includes first name, last name, and gender
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
      throw new Error(errors.unverifiedFacebook.message);
    }
    // Check if the requested app ID is valid against our own env app ID.
    if (reqAppId.toString() !== envAppId.toString()) {
      throw new Error(errors.invalidCredentials.message);
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
            throw new Error(errors.invalidCredentials.message);
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
            throw new Error(errors.invalidCredentials.message);
          }
        } else {
          // Token is not valid
          throw new Error(errors.invalidCredentials.message);
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

    const searchQuery = email ? {
      $or: [
        { email: new RegExp(`^${email}$`, 'i') },
        { facebookId },
      ],
    } : {
      facebookId,
    };

    // Check if there is already a user with existing email or Facebook ID
    return Promise.all([
      dbManager.getDb()
        .collection('users')
        .findOne(searchQuery),
      getTrainingPlans(),
    ])
      .then(([existingUser, plans]) => {
        if (existingUser) {
          if (existingUser.facebookId === facebookId) {
            // A user already exists with the same Facebook ID, return existing user
            debug('Matched existing user with same Facebook ID', facebookId);

            if (existingUser.isConfirmed) {
              // Existing user already has a confirmed email, return as is
              return existingUser;
            }
            // Existing user has an unconfirmed email, mark as confirm since the
            // email from the Facebook account is already verified
            return dbManager.getDb()
              .collection('users')
              .findOneAndUpdate(
                { _id: existingUser._id },
                { $set: { isConfirmed: true } },
                { returnOriginal: false }
              )
              .then(updatedDoc => updatedDoc.value);
          } else if (existingUser.isConfirmed) {
            // A user exists with the same email and is confirmed, add Facebook ID to user
            debug('Adding Facebook ID to existing user with same confirmed email',
              existingUser.email, facebookId);

            return dbManager.getDb()
              .collection('users')
              .findOneAndUpdate(
                { _id: existingUser._id },
                { $set: { facebookId } },
                { returnOriginal: false }
              )
              .then(updatedDoc => updatedDoc.value);
          } else if (!existingUser.isConfirmed) {
            // A user exists with the same email but is not confirmed.
            // Send confirmation email to have them verify their email before they are
            // able to add the Facebook account.
            debug('User exists with same email but unconfirmed, sending confirmation email',
              existingUser.email);

            return tokenFactory.generateToken()
              .then(([confirmationToken, confirmationTokenExpiry]) => (
                dbManager.getDb()
                  .collection('users')
                  .findOneAndUpdate(
                    { _id: existingUser._id },
                    { $set: { confirmationToken, confirmationTokenExpiry } }
                  )
                  .then(() => {
                    // Send user confirmation email
                    const emailUtility = EmailUtility.getMailer();
                    return emailUtility
                      .sendConfirmationEmail(existingUser.email, confirmationToken);
                  })
                  .then(() => {
                    throw new Error(errors.unconfirmedEmail.message);
                  })
              ));
          }
        } else {
          // There are no existing users with the same email or Facebook ID. Create new user.
          debug('Creating new Facebook user', facebookId);
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
            .then((newDoc) => {
              debug('Created new user');
              return Object.assign({}, newDoc.ops[0], { isNew: true });
            });
        }
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
    // Set the status code based on the error type
    Object.keys(errors).forEach((errorName) => {
      if (errors[errorName].message === err.message) {
        res.status(errors[errorName].code);
      }
    });
    throw err;
  });
