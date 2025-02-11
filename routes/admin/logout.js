import Debug from 'debug';
import dbManager from '../../lib/dbManager';

const debug = Debug('routes:admin:logout');

/**
 * Removes the access token for an internal user so subsequent API requests
 * using the access token will not be allowed.
 * @param  {Object} req                  Request
 * @param  {Object} req.body             Request body
 * @param  {String} req.body.accessToken Access token to remove
 * @return {Promise} Resolves with undefined
 */
export default req => new Promise((resolve, reject) => {
  const accessToken = req.headers.authorization.split(' ')[1];
  debug('Processing logout request for access token', accessToken);
  dbManager.getDb()
    .collection('internalUsers')
    .findOneAndUpdate(
      { accessToken },
      { $unset: { accessToken: true } },
      { returnOriginal: false },
    )
    .then((result) => {
      if (result.value) {
        debug('Removed access token', result.value);
      } else {
        debug('Access token not found, no-op');
      }
      // Resolve regardless if the access token was valid or not
      resolve();
    })
    .catch((err) => {
      debug('Error', err);
      reject(err);
    });
});
