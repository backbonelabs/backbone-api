import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';

/**
 * Removes the access token for an internal user so subsequent API requests
 * using the access token will not be accepted.
 * @param  {Object} req                  Request
 * @param  {Object} req.body             Request body
 * @param  {String} req.body.accessToken Access token to remove
 * @return {Promise} Resolves with undefined
 */
export default req => validate(req.body, {
  accessToken: schemas.accessToken,
}, ['accessToken'])
  .then(() => {
    const { accessToken } = req.body;
    return dbManager.getDb()
      .collection('internalUsers')
      .findOneAndUpdate(
        { accessToken },
        { $unset: { accessToken: true } },
        { returnOriginal: false },
      )
      .then(() => {
        // Nothing needs to be returned
        return;
      });
});
