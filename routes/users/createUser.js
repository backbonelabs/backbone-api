import Joi from 'joi';
import validate from '../../lib/validate';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
//
const passwordSchema = Joi.string().regex(/[A-Z]/, 'upper case')
                        .regex(/[a-z]/, 'lower case')
                        .regex(/[0-9]/, 'number')
                        .min(8)
                        .max(72)
                        .required();

/**
 * Creates a new user after checking there are no existing users with the same email
 * @param  {Object} req                     Request
 * @param  {Object} req.body                Request body
 * @param  {String} req.body.email          Email
 * @param  {String} req.body.password       Password
 * @param  {String} req.body.verifyPassword Password
 * @return {Promise} Resolves with an object containing the user ID, rejects if both
 *                   passwords do not match or the email address is being used by
 *                   another user
 */
export default req => validate(req.body, {
  email: Joi.string().email().required(),
  password: passwordSchema,
  verifyPassword: passwordSchema,
})
  .catch(() => {
    throw new Error('Email must be a valid email format. Password must be at least 8 characters' +
      'and contains at least one uppercase letter, one lowercase letter, and one number.');
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
  ))
  .then(user => {
    if (user) {
      // Email is already associated to an existing user
      throw new Error('Email is not available');
    } else {
      // Email is not associated to any existing users, hash password
      return password.hash(req.body.password);
    }
  })
  .then(hash => (
    // Create user
    dbManager.getDb()
      .collection('users')
      .insertOne({
        email: req.body.email,
        password: hash,
      })
  ))
  .then(result => ({ id: result.insertedId }));
