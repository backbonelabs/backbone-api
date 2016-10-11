import uaParser from 'ua-parser-js';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';

/**
 * Checks if a confirmation URL's token parameter matches a user document in database
 * If a user is found and token is still valid, update user isConfirmed property to
 * reflect that user's email is confirmed
 * @param  {Object} req             Request
 * @param  {Object} req.query       Request query keys and their values
 * @param  {String} req.query.token Email confirmation token
 * @return {Promise} Resolves with a string stating that the user has successfully
 *                   confirmed their email
 */
export default (req, res) => validate(req.query, { token: schemas.token },
  ['token'])
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ confirmationToken: req.query.token })
  ))
  .then(user => {
    if (!user) {
      throw new Error('Invalid email confirmation request');
    } else if (new Date() > user.confirmationTokenExpiry) {
      throw new Error('Invalid email confirmation request');
    } else {
      return dbManager.getDb()
      .collection('users')
      .findOneAndUpdate(
        { _id: user._id },
        { $set: { isConfirmed: true } }
      );
    }
  })
  .then(() => {
    const useragent = uaParser(req.headers['user-agent']);
    if (useragent.os.name === 'iOS') {
      // Check if user agent is iOS and redirect to app URL
      res.redirect('backbone://');
    } else {
      return 'Email successfully confirmed';
    }
  });
