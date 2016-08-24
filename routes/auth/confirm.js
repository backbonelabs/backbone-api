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
    // Create a date object and set to two days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    if (!user) {
      res.status(400);
    } else if (user.createdAt < twoDaysAgo) {
      throw new Error('Confirmation is expired');
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
