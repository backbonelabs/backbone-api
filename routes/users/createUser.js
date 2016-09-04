import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import tokenFactory from '../../lib/tokenFactory';
import emailUtility from '../../lib/emailUtility';
import userSettings from '../../lib/userSettings';

/**
 * Creates a new user after checking there are no existing users with the same email
 * Sends a confirmation email after creating a new user account
 * @param  {Object} req                     Request
 * @param  {Object} req.body                Request body
 * @param  {String} req.body.email          Email
 * @param  {String} req.body.password       Password
 * @param  {String} req.body.verifyPassword Password
 * @return {Promise} Resolves with an object containing the user email, rejects if
 *                   both passwords do not match or the email address is being used
 *                   by another user
 */
export default req => validate(req.body, Object.assign({}, schemas.user, {
  password: schemas.password,
  verifyPassword: schemas.password,
}), ['email', 'password', 'verifyPassword'], ['_id'])
  .catch(() => {
    throw new Error('Email must be a valid email format. Password must be at least 8 characters ' +
      'and contain at least one number.');
  })
  .then(() => {
    // Make sure password and verifyPassword are the same
    if (req.body.password !== req.body.verifyPassword) {
      throw new Error('Passwords must match');
    }
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
    .then(hash => {
      // Generate a token and create user
      const confirmationTokenExpiry = new Date();
      confirmationTokenExpiry.setDate(confirmationTokenExpiry.getDate() + 2);

      return tokenFactory.createConfirmationToken()
      .then((token) => (
        dbManager.getDb()
        .collection('users')
        .insertOne({
          email: req.body.email,
          password: hash,
          isConfirmed: false,
          createdAt: new Date(),
          confirmationToken: token,
          confirmationTokenExpiry,
          settings: userSettings.defaults,
        })
        .then(() => emailUtility.sendConfirmationEmail(req.body.email, token))
      ));
    })
  ))
  .then(() => (true));
