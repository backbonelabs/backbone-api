import uaParser from 'ua-parser-js';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';


/**
 * Checks if a confirmation URL's email/token parameters match any email/token in database
 * @param  {Object} req                     Request
 * @param  {Object} req.query               Request query keys and their values
 * @param  {String} req.query.e             Email
 * @param  {String} req.query.t             Email token
 * @return {Promise} Resolves with an object containing the user ID, rejects if both
 *                   passwords do not match or the email address is being used by
 *                   another user
 */
export default (req, res) => validate(req.query, Object.assign({}, { email: schemas.user.email }),
  ['email'], [], {})
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ email: req.query.email })
  ))
  .then(user => {
    if (!user) {
      res.status(401);
    } else {
      dbManager.getDb()
      .collection('users')
      .findOneAndUpdate(
        { email: req.query.email },
        { $set: { confirmed: true } }
      );
    }
  })
  .then(() => {
    const useragent = uaParser(req.headers['user-agent']);
    if (useragent.os.name === 'iOS') {
      // Check if user agent is iOS and redirect to app URL
      res.redirect('openBackbone://');
    }
    return 'Email successfully confirmed';
  })
  .catch(err => { throw err; });
