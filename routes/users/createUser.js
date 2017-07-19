import mongodb from 'mongodb';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import tokenFactory from '../../lib/tokenFactory';
import EmailUtility from '../../lib/EmailUtility';
import userDefaults from '../../lib/userDefaults';
import sanitizeUser from '../../lib/sanitizeUser';

// Short of using Redis or an external cache, we store the default training plan
// data in local memory so we don't have to continuously make database calls
// to retrieve the information since it won't change often
let defaultTrainingPlans = [];

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
  .then((hash) => {
    // Make sure the home and work training plans are stored in memory
    if (defaultTrainingPlans.length) {
      return hash;
    }

    return dbManager.getDb()
      .collection('trainingPlans')
      .find({ name: { $in: ['Home', 'Work'] } })
      .toArray()
      .then((trainingPlans) => {
        defaultTrainingPlans = trainingPlans;
        return hash;
      });
  })
  .then(hash => (
    // Generate token and token expiry for use in confirming user email
    tokenFactory.generateToken()
      .then(([confirmationToken, confirmationTokenExpiry]) => (
        dbManager.getDb()
          .collection('users')
          .insertOne(userDefaults.mergeWithDefaultData({
            email: req.body.email,
            password: hash,
            createdAt: new Date(),
            confirmationToken,
            confirmationTokenExpiry,
            trainingPlans: defaultTrainingPlans.map(plan => plan._id),
          }))
          .then((result) => {
            // Initiate sending of user confirmation email
            const emailUtility = EmailUtility.getMailer();
            return emailUtility.sendConfirmationEmail(result.ops[0].email, confirmationToken)
              // Create accessToken for authenticating session
              .then(() => tokenFactory.createAccessToken())
              // Return result from inserting user and accessToken
              .then(accessToken => [result, accessToken]);
          })
      ))
  ))
  .then(([result, accessToken]) => {
    const { ops, insertedId: userId } = result;
    // Store accessToken along with userId
    return dbManager.getDb()
      .collection('accessTokens')
      .insertOne({ userId, accessToken })
      .then(() => (
        {
          user: sanitizeUser(ops[0]),
          accessToken,
        }
      ));
  });
