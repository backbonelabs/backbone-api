import Debug from 'debug';
import uniq from 'lodash/uniq';
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
  facebookTaken: 'Your Facebook account is registered with another account. ' +
    'Please contact support@gobacbone.com if you need assistance.',
  emailTaken: 'Email already taken',
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
        ...body
      } = reqBody;

      // Ensure birthdate gets saved as ISODate by making it a JS Date object
      if (body.birthdate) {
        body.birthdate = new Date(body.birthdate);
      }

      // Ensure lastSession gets saved as ISODate by making it a JS Date object
      if (body.lastSession) {
        body.lastSession = new Date(body.lastSession);
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
                body.password = hash;
                return [user, body];
              });
          });
      }

      // Checks if the workout Ids in favoriteWorkouts matches the workout Ids from database
      if (body.favoriteWorkouts) {
        return getWorkouts().then((workoutsFromCache) => {
          // Remove duplicate workout Ids
          body.favoriteWorkouts = uniq(body.favoriteWorkouts);

          // Put all workouts into a hash table
          const workoutsHashTable = {};
          workoutsFromCache.forEach((workout) => {
            workoutsHashTable[workout._id] = workout;
          });

          const isFavoriteWorkoutsValid = body.favoriteWorkouts.every(
            favoriteWorkoutId => workoutsHashTable[favoriteWorkoutId]
          );

          if (!isFavoriteWorkoutsValid) {
            throw new Error(errors.invalidWorkout);
          }
          // Converts workout Id strings to Mongo objects
          body.favoriteWorkouts = body.favoriteWorkouts.map(workout =>
              dbManager.mongodb.ObjectId(workout)
            );
          return [user, body];
        });
      }

      if (body.facebookId && body.facebookId !== user.facebookId) {
        // User is adding a Facebook account
        if (!user.isConfirmed) {
          // User is not confirmed yet, resend confirmation email
          tokenFactory.generateToken()
            .then(([confirmationToken, confirmationTokenExpiry]) => ({
              confirmationToken,
              confirmationTokenExpiry,
            }))
            .then((tokenResults) => {
              const emailUtility = EmailUtility.getMailer();
              return emailUtility.sendConfirmationEmail(user.email, tokenResults.confirmationToken)
                .then(() => tokenResults);
            })
            .then((tokenResults) => {
              dbManager.getDb()
                .collection('users')
                .findOneAndUpdate(
                  { _id: dbManager.mongodb.ObjectID(reqUserId) },
                  { $set: tokenResults },
                  { returnOriginal: false },
                );
            });

          debug('User attempted to add a Facebook account but is not confirmed yet.', reqUserId);
          throw new Error(errors.unconfirmedEmail);
        } else {
          // User is confirmed. Check if the Facebook ID is already taken.
          return dbManager.getDb()
            .collection('users')
            .find({ facebookId: body.facebookId })
            .limit(1)
            .next()
            .then((existingFbUser) => {
              if (existingFbUser && existingFbUser._id.toHexString() !== reqUserId) {
                // Facebook ID is taken by another user
                debug('Facebook ID is registered to another user', body.facebookId);
                throw new Error(errors.facebookTaken);
              }
              return [user, body];
            });
        }
      }

      return [user, body];
    })
    .then(([user, body]) => {
      const { email } = body;

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
                Object.assign(body, { confirmationToken, confirmationTokenExpiry })
              )
              .then(() => {
                const emailUtility = EmailUtility.getMailer();
                return emailUtility.sendConfirmationEmail(email, body.confirmationToken);
              })
              .then(() => Object.assign(body, { isConfirmed: false }));
          });
      }
      return body;
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
