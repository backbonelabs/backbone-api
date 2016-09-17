import uaParser from 'ua-parser-js';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';

/**
 * Checks if a confirmation URL's email/token parameters match any email/token in database
 * @param  {Object} req                     Request
 * @param  {Object} req.query               Request query keys and their values
 * @param  {String} req.query.email         Email
 * @return {Promise} Resolves with a string stating that the user has successfully
 *                   confirmed their email
 */
export default (req, res) => validate(req.query, Object.assign({},
  { token: schemas.confirmationToken }),
  ['token'])
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({
      confirmationToken: req.query.token,
    })
  ))
  .then(user => {
    if (!user) {
      throw new Error('Invalid email confirmation link. Please try again.');
    } else if (new Date() > user.confirmationTokenExpiry) {
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
      res.send('Password request successfully confirmed');
    }
  });
