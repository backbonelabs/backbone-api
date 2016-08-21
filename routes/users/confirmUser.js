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
export default req => validate(req.query, Object.assign({}, { e: schemas.user.email },
  { t: schemas.emailToken }), ['e', 't'], [], {})
  .then(() => {
    const { e: email, t: emailToken } = req.query;
    return dbManager.getDb()
    .collection('emailTokens')
    .findOne({ email, emailToken });
  })
  .then(token => {
    const { e: email } = req.query;

    if (token) {
      return dbManager.getDb()
      .collection('users')
      .findOneAndUpdate(
        { email },
        { $set: { confirmed: true } }
      );
    }
    throw new Error('Error with email confirmation');
  })
  .then(() => ('Email is now confirmed'))
  .catch(err => { throw err; });
