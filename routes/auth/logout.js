import dbManager from '../../lib/dbManager';

/**
 * Removes an access token from the database so that subsequent API requests
 * using the access token will not be accepted.
 * @param  {Object} req         Request
 * @param  {Object} req.headers Request headers
 * @param  {String} req.headers.authorization Authorization header with Bearer token
 * @return {Promise} Resolves with an empty object if there was a matching
 *                   access token, rejects if access token isn't a valid token
 */
export default req => new Promise((resolve, reject) => {
  const accessToken = req.headers.authorization.split(' ')[1];
  dbManager.getDb()
    .collection('accessTokens')
    .remove({ accessToken })
    .then(results => {
      if (results.result.n) {
        // Access token matched an entry in the database and was removed
        resolve({});
      } else {
        reject(new Error('Invalid credentials'));
      }
    });
});
