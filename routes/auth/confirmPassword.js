import uaParser from 'ua-parser-js';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';

/**
 * Checks if a confirmation URL's token parameters match any token in database
 * @param  {Object} req                     Request
 * @param  {Object} req.query               Request query keys and their values
 * @param  {String} req.query.token         Confirmation token
 * @return {Promise} Resolves with a string stating that the user has successfully
 *                   confirmed their email and is able to change their password
 */
export default (req, res) => validate(req.query, { token: schemas.token },
  ['token'])
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ passwordResetToken: req.query.token })
  ))
  .then(user => {
    if (!user) {
      throw new Error('Invalid email confirmation link. Please try again.');
    } else if (new Date() > user.passwordResetTokenExpiry) {
      throw new Error('Email confirmation has expired, please sign up again');
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
