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
export default (req, res) => validate(req.query, Object.assign({}, { email: schemas.user.email }),
  ['email'])
  .then(() => (
    dbManager.getDb()
    .collection('users')
    .findOne({ email: req.query.email })
  ))
  .then(user => {
    if (user) {
      res.status(400);

      /**
       * TODO: Create an error message that tells
       * to sign up again. Likely token expired
       * and we deleted their account.
       */
      throw new Error('Could not confirm email');
    } else {
      return dbManager.getDb()
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
      res.redirect('backbone://');
    }
    return 'Email successfully confirmed';
  })
  .catch(err => { throw err; });
