import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import tokenFactory from '../../lib/tokenFactory';
import EmailUtility from '../../lib/EmailUtility';
import userDefaults from '../../lib/userDefaults';
import sanitizeUser from '../../lib/sanitizeUser';
import {
  getTrainingPlans,
  mapIdsToTrainingPlans,
} from '../../lib/trainingPlans';

/**
 * Creates a new user after checking there are no existing users with the same email
 * Sends a confirmation email after creating a new user account
 * @param  {Object} req                     Request
 * @param  {Object} req.body                Request body
 * @param  {String} req.body.email          Email
 * @param  {String} req.body.password       Password
 * @return {Promise} Resolves with an object containing user details sans password
 *                   and user's current assigned accessToken.
 */
export default req => validate(req.body, {
  email: schemas.user.email,
  password: schemas.password,
}, ['email', 'password'])
  .catch(() => {
    throw new Error(
      'Email must be a valid email format, and password must be at least 8 characters'
    );
  })
  .then(() => (
    // Check if there is already a user with this email
    dbManager.getDb()
      .collection('users')
      .find({ email: new RegExp(`^${req.body.email}$`, 'i') })
      .limit(1)
      .next()
      .then((user) => {
        if (user) {
          // Email is already associated to a confirmed user
          throw new Error('Email is not available');
        } else {
          // Email is not associated to any existing users, hash password
          return password.hash(req.body.password);
        }
      })
  ))
  .then(hash => (
    Promise.all([
      // Generate token and token expiry for use in confirming user email
      tokenFactory.generateToken(),
      // Retrieve training plan data
      getTrainingPlans(),
    ])
      .then(([
        [confirmationToken, confirmationTokenExpiry],
        plans,
      ]) => {
        // Get home and work training plans to assign to user
        const homeAndWorkTrainingPlans = plans
          .filter(plan => plan.name === 'Home' || plan.name === 'Work')
          .map(plan => plan._id);

        return dbManager.getDb()
          .collection('users')
          .insertOne(userDefaults.mergeWithDefaultData({
            email: req.body.email,
            password: hash,
            createdAt: new Date(),
            confirmationToken,
            confirmationTokenExpiry,
            trainingPlans: homeAndWorkTrainingPlans,
          }))
          .then((result) => {
            // Initiate sending of user confirmation email
            const emailUtility = EmailUtility.getMailer();
            return emailUtility.sendConfirmationEmail(result.ops[0].email, confirmationToken)
              // Create accessToken for authenticating session
              .then(() => tokenFactory.createAccessToken())
              // Return result from inserting user and accessToken
              .then(accessToken => [result, accessToken]);
          });
      })
  ))
  .then(([result, accessToken]) => {
    const { ops, insertedId: userId } = result;
    const user = sanitizeUser(ops[0]);
    user.trainingPlans = mapIdsToTrainingPlans(user.trainingPlans);

    // Store accessToken along with userId
    return dbManager.getDb()
      .collection('accessTokens')
      .insertOne({ userId, accessToken })
      .then(() => ({
        user,
        accessToken,
      }));
  });
