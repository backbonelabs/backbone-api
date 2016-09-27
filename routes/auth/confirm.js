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
export default (req, res) => validate(req.query, { token: schemas.confirmationToken }, ['token'])
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ confirmationToken: req.query.token })
  ))
  .then(user => {
    const today = new Date();

    if (!user) {
      throw new Error('Invalid confirmation link. Please try again.');
    } else if (today > user.confirmationTokenExpiry) {
      throw new Error('Email confirmation has expired, please sign up again');
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
      res.send('Email successfully confirmed');
    }
  });
