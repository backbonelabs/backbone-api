import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import emailUtility from '../../lib/emailUtility';

/**
 * Updates a user
 * @param  {Object} req           Request
 * @param  {String} req.params.id User ID
 * @param  {Object} req.body      Key-value pairs of user attributes to update
 * @return {Promise} Resolves with the user object containing the updated attributes, sans password
 */
export default req => validate(req.body, schemas.user, [], ['_id'])
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ email: req.body.email })
  ))
  .then((user) => {
    if (!user) {
      // For security purposes, we probably shouldn't expose whether a user exists or not
    } else if (user && user.isConfirmed) {
      // User exists and has previously confirmed their email already, send a password reset email
      return tokenFactory.createConfirmationToken()
        .then(([confirmationToken, confirmationTokenExpiry]) => (
          dbManager.getDb()
            .collection('users')
            .findOneAndUpdate(
              { email: req.body.email },
              { $set: {
                confirmationToken,
                confirmationTokenExpiry,
              } }
            )
            .then((updatedUser) =>
              emailUtility.sendPasswordResetEmail(updatedUser.value.email, confirmationToken)
            )
        ));
    }
  });
