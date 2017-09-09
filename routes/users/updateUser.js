import Debug from 'debug';
import request from 'request-promise';
import uniq from 'lodash/uniq';
import Joi from 'joi';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';
import { mapIdsToTrainingPlans, getWorkouts } from '../../lib/trainingPlans';
import EmailUtility from '../../lib/EmailUtility';
import constants from '../../lib/constants';

const debug = Debug('routes:users:updateUsers');

export const errors = {
  invalidUserId: 'Invalid user id',
  nonMatchingPasswords: 'Passwords must match',
  disallowPasswordChange: 'Password change is not allowed',
  incorrectPassword: 'Current password is incorrect',
  invalidWorkout: 'Invalid workout',
  unconfirmedEmail: 'An email was sent to your email address. ' +
    'Please check your email to confirm your email address before connecting with Facebook.',
  missingFacebookAccessToken: 'Missing Facebook access token.',
  missingFacebookAppId: 'Missing Facebook application ID',
  facebookTaken: 'Your Facebook account is registered with another account. ' +
    'Please contact support@gobacbone.com if you need assistance.',
  invalidCredentials: 'Invalid Facebook credentials.',
  unverifiedFacebook: 'Please verify your Facebook account before continuing.',
  emailTaken: 'Email is already taken.',
};

/**
 * Updates a user
 * @param  {Object} req           Request
 * @param  {String} req.params.id User ID
 * @param  {Object} req.body      Key-value pairs of user attributes to update
 * @return {Promise} Resolves with the user object containing the updated attributes, sans password
 */
export default (req) => {
  const reqBody = Object.assign({}, req.body);
  const reqUserId = req.params.id;

  // If the session time sent from the user's phone is ahead of the servers's time then
  // set the last session time to the current server's time so it won't fail validation.
  if (reqBody.lastSession) {
    const sessionUnixTime = Date.parse(reqBody.lastSession);
    const systemUnixTime = Date.now();
    if (sessionUnixTime > systemUnixTime) {
      reqBody.lastSession = (new Date(systemUnixTime)).toISOString();
    }
  }

  return validate(reqBody, Object.assign({}, schemas.user, {
    currentPassword: schemas.password,
    password: schemas.password,
    verifyPassword: schemas.password,
    facebookAccessToken: schemas.facebook.accessToken,
    facebookAppId: schemas.facebook.applicationID,
    facebookEmail: Joi.string().email(),
    facebookVerified: Joi.boolean(),
  }), [], ['_id'])
    .then(() => (
      // Make sure user exists
      dbManager.getDb()
        .collection('users')
        .find({ _id: dbManager.mongodb.ObjectID(reqUserId) })
        .limit(1)
        .next()
        .then((user) => {
          if (user) {
            debug('Found user by id', reqUserId);
            return user;
          }
          debug('Did not find user by id', reqUserId);
          throw new Error(errors.invalidUserId);
        })
    ))
    .then((user) => {
      const {
        password: pw,
        verifyPassword,
        currentPassword,
        facebookAppId,
        facebookAccessToken,
        facebookEmail,
        facebookVerified,
        ...updateFields
      } = reqBody;

      // Ensure birthdate gets saved as ISODate by making it a JS Date object
      if (updateFields.birthdate) {
        updateFields.birthdate = new Date(updateFields.birthdate);
      }

      // Ensure lastSession gets saved as ISODate by making it a JS Date object
      if (updateFields.lastSession) {
        updateFields.lastSession = new Date(updateFields.lastSession);
      }

      if (pw || verifyPassword) {
        // Make sure password and verifyPassword are the same
        if (pw !== verifyPassword) {
          throw new Error(errors.nonMatchingPasswords);
        }

        if (user.authMethod !== constants.authMethods.EMAIL) {
          throw new Error(errors.disallowPasswordChange);
        }

        return password.verify(currentPassword, user.password)
          .then((isPasswordMatch) => {
            // If password doesn't match
            if (!isPasswordMatch) {
              debug('Incorrect password');
              throw new Error(errors.incorrectPassword);
            }
            // Hash password
            return password.hash(pw)
              .then((hash) => {
                updateFields.password = hash;
                return [user, updateFields];
              });
          });
      }

      // Checks if the workout Ids in favoriteWorkouts matches the workout Ids from database
      if (updateFields.favoriteWorkouts) {
        return getWorkouts().then((workoutsFromCache) => {
          // Remove duplicate workout Ids
          updateFields.favoriteWorkouts = uniq(updateFields.favoriteWorkouts);

          // Put all workouts into a hash table
          const workoutsHashTable = {};
          workoutsFromCache.forEach((workout) => {
            workoutsHashTable[workout._id] = workout;
          });

          const isFavoriteWorkoutsValid = updateFields.favoriteWorkouts.every(
            favoriteWorkoutId => workoutsHashTable[favoriteWorkoutId]
          );

          if (!isFavoriteWorkoutsValid) {
            throw new Error(errors.invalidWorkout);
          }
          // Converts workout Id strings to Mongo objects
          updateFields.favoriteWorkouts = updateFields.favoriteWorkouts.map(workout =>
            dbManager.mongodb.ObjectId(workout)
          );
          return [user, updateFields];
        });
      }

      if (updateFields.facebookId && updateFields.facebookId !== user.facebookId) {
        // User is adding a Facebook account
        const envFbAppId = process.env.FB_APP_ID;
        const envFbAppSecret = process.env.FB_APP_SECRET;

        if (!facebookAccessToken) {
          // Missing Facebook access token
          throw new Error(errors.missingFacebookAccessToken);
        }

        if (!facebookAppId) {
          // Missing Facebook app ID
          throw new Error(errors.missingFacebookAppId);
        }

        if (facebookAppId.toString() !== envFbAppId.toString()) {
          // Incorrect app ID
          throw new Error(errors.invalidCredentials);
        }

        if (!facebookVerified) {
          // Facebook account is not verified
          throw new Error(errors.unverifiedFacebook);
        }

        // Check if Facebook ID is already taken
        return dbManager.getDb()
          .collection('users')
          .find({ facebookId: updateFields.facebookId })
          .limit(1)
          .next()
          .then((existingFbUser) => {
            if (existingFbUser && existingFbUser._id.toHexString() !== reqUserId) {
              // Facebook ID is taken by another user
              debug('Facebook ID is registered to another user', updateFields.facebookId);
              throw new Error(errors.facebookTaken);
            }
          })
          .then(() => {
            // Facebook ID not taken by any other user. Verify Facebook ID is valid.
            const options = {
              method: 'GET',
              uri: 'https://graph.facebook.com/debug_token',
              qs: {
                input_token: facebookAccessToken,
                access_token: `${envFbAppId}|${envFbAppSecret}`,
              },
              json: true,
            };

            return request(options)
              .then((result) => {
                if (result.data.error) {
                  debug('Failed to verify Facebook user access token', result.data.error);
                  // Facebook error code for invalid user access token:
                  // { code: 190, message: 'Invalid OAuth access token.' }
                  if (result.data.error.code === 190) {
                    throw new Error(errors.invalidCredentials);
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
                  if (debugTokenAppId.toString() !== envFbAppId.toString() ||
                      debugTokenUserId.toString() !== updateFields.facebookId.toString()) {
                    throw new Error(errors.invalidCredentials);
                  }
                } else {
                  // Token is not valid
                  throw new Error(errors.invalidCredentials);
                }
              });
          })
          .then(() => {
            // Facebook ID is valid
            if (!user.isConfirmed && facebookEmail && user.email &&
              user.email.toLowerCase() === facebookEmail.toLowerCase()) {
              // User's current email is the same as the Facebook email and user's email is
              // not yet confirmed. Since the Facebook email is already verified at this point,
              // mark the user as confirmed.
              updateFields.isConfirmed = true;
            }
            return [user, updateFields];
          });
      }

      return [user, updateFields];
    })
    .then(([user, updateFields]) => {
      const { email } = updateFields;

      // Check if email is being changed and if the new email is already taken
      if (email && email !== user.email) {
        return dbManager.getDb()
          .collection('users')
          .find({ email: new RegExp(`^${email}$`, 'i') })
          .limit(1)
          .next()
          .then((userWithEmail) => {
            if (userWithEmail) {
              throw new Error(errors.emailTaken);
            }
            return tokenFactory.generateToken()
              .then(([confirmationToken, confirmationTokenExpiry]) =>
                Object.assign(updateFields, { confirmationToken, confirmationTokenExpiry })
              )
              .then(() => {
                const emailUtility = EmailUtility.getMailer();
                return emailUtility.sendConfirmationEmail(email, updateFields.confirmationToken);
              })
              .then(() => Object.assign(updateFields, { isConfirmed: false }));
          });
      }
      return updateFields;
    })
    .then(updateFields => (
      // Attempt to update the user
      dbManager.getDb()
        .collection('users')
        .findOneAndUpdate(
          { _id: dbManager.mongodb.ObjectID(reqUserId) },
          { $set: updateFields },
          { returnOriginal: false },
        )
    ))
    .then((updatedDoc) => {
      // Omit password
      const sanitizedUser = sanitizeUser(updatedDoc.value);

      // Add training plans details
      sanitizedUser.trainingPlans =
        mapIdsToTrainingPlans(sanitizedUser.trainingPlans, sanitizedUser.trainingPlanProgress);

      return sanitizedUser;
    });
};
