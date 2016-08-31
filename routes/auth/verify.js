import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';

const debug = Debug('routes:auth:verify');

/**
 * Verifies an access token simply by checking if it is in the accessToken collection
 * @param  {Object} req                  Request
 * @param  {Object} req.body             Request body
 * @param  {String} req.body.accessToken Access token
 * @return {Promise} Resolves with an empty object. Status code will be 200 for a valid
 *                   access token, 401 otherwise.
 */
export default req => validate(req.body, {
  accessToken: schemas.accessToken,
}, ['accessToken'])
  .then(() => {
    const { accessToken } = req.body;
    return dbManager.getDb()
      .collection('accessTokens')
      .find({ accessToken })
      .limit(1)
      .next();
  })
  .then(accessToken => {
    debug(`${accessToken ? 'Found' : 'Did not find'} access token`, accessToken);
    return {
      accessToken: req.body.accessToken,
      isValid: !!accessToken,
      userId: accessToken ? accessToken.userId : null,
    };
  });
