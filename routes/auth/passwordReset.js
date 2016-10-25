import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';

/**
 * Finds a user by their email and generates a password reset token and the date which
 * it expires. Send user email with link containing token for confirming reset request.
 * @param  {Object} req            Request
 * @param  {Object} req.body       Request body
 * @param  {String} req.body.email Email
 * @return {Promise} Resolves with undefined upon successful email send
 */
export default req => validate(req.body, {
  token: schemas.token,
  password: schemas.password,
  verifyPassword: schemas.password,
}, ['token', 'password', 'verifyPassword'])
  .then(() => {
    if (req.body.password !== req.body.verifyPassword) {
      // Passwords do not match
      throw new Error('Passwords must match');
    }
    // Hash password
    return password.hash(req.body.password);
  })
  .then((passwordHash) => (
    // Update user password and remove password reset token
    dbManager.getDb()
      .collection('users')
      .findOneAndUpdate({
        passwordResetToken: req.body.token,
        passwordResetTokenExpiry: { $gt: new Date() },
      }, {
        $set: { password: passwordHash },
        $unset: {
          passwordResetToken: '',
          passwordResetTokenExpiry: '',
        },
      })
  ))
  .then((result) => {
    if (!result.value) {
      throw new Error('Invalid reset token');
    }
  });
