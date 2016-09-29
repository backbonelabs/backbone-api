import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import emailUtility from '../../lib/emailUtility';

/**
 * Finds a user by their email and generates a password reset token and the date which
 * it expires. Send user email with link containing token for confirming reset request.
 * @param  {Object} req                      Request
 * @param  {String} req.body.email           Email
 *         {String} passwordResetToken       Token for confirming a user's password reset request
 *         {Object} passwordResetTokenExpiry A date two days into the future from when the token
 *                                           was created, in order to check whether it has expired
 * @return {Promise}                         Resolves with undefined on a successful email send
 */
export default req => validate(req.body, schemas.user, ['email'], ['_id'])
  .catch(() => {
    throw new Error('Email must be a valid email format.');
  })
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ email: req.body.email })
  ))
  .then((user) => {
    if (!user) {
      // For security purposes, we probably shouldn't expose whether a user exists or not
    } else {
      // Generate a passwordResetToken/Expiry and send a password reset confirmation email
      return tokenFactory.generateToken()
        .then(([passwordResetToken, passwordResetTokenExpiry]) => (
          dbManager.getDb()
            .collection('users')
            .findOneAndUpdate(
              { email: req.body.email },
              { $set: {
                passwordResetToken,
                passwordResetTokenExpiry,
              } }
            )
            .then((updatedUser) =>
              emailUtility.sendPasswordResetEmail(updatedUser.value.email, passwordResetToken)
            )
        ));
    }
  });
