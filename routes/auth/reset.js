import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import emailUtility from '../../lib/emailUtility';

/**
 * Handles a user-initiated password reset request. Generates a token for the password reset
 * request, as well as the expiration date for the token and sends the user an email.
 * @param  {Object} req                      Request
 * @param  {String} req.body.email           Email
 * @param  {String} passwordResetToken       Token for confirming a user's password reset request
 * @param  {Object} passwordResetTokenExpiry A date two days into the future from when the token
 *                                           was created, in order to check whether it has expired
 *                                           (48 hour expiration period).
 * @return {Promise}                         Resolves with undefined on successful email send
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
