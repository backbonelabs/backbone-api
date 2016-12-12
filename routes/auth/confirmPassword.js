import uaParser from 'ua-parser-js';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';

/**
 * Checks if a password reset URL's token parameter matches a user document in database.
 * If a user is found and token is still valid, redirect user to update their password.
 * @param  {Object} req             Request
 * @param  {Object} req.query       Request query keys and their values
 * @param  {String} req.query.token Password reset token
 * @return {Promise} Redirects user to a page where the user can change their password
 */
export default (req, res) => validate(req.query, { token: schemas.token },
  ['token'])
  .then(() => (
    dbManager.getDb()
      .collection('users')
      .find({ passwordResetToken: req.query.token })
      .limit(1)
      .next()
  ))
  .then(user => {
    if (!user) {
      throw new Error('Invalid password reset request');
    } else if (new Date() > user.passwordResetTokenExpiry) {
      throw new Error('Invalid password reset request');
    } else {
      const { passwordResetToken, passwordResetTokenExpiry } = user;

      // Update the user profile by removing the passwordResetToken/Expiry properties
      return dbManager.getDb()
        .collection('users')
        .findOneAndUpdate(
          { _id: user._id },
          { $unset: { passwordResetToken, passwordResetTokenExpiry } }
        );
    }
  })
  .then(() => {
    const useragent = uaParser(req.headers['user-agent']);
    if (useragent.os.name === 'iOS') {
      // Check if user agent is iOS and redirect to app
      res.redirect('backbone://');
    } else if (useragent.os.name === 'Android') {
      // Check if user agent is Android and redirect to app
    } else {
      // Redirect user to our web (or mobile?) app to change password
      return 'Password request successfully confirmed';
    }
  });
