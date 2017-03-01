import dbManager from './dbManager';

/**
 * Express middleware that ensures a request has a valid access token belonging
 * to the user id passed in as a route parameter in order to access the resource.
 * The access token must be included in the Authorization header using the Bearer scheme,
 * and the user id must be available in `req.params.id`.
 */
export default (req, res, next) => {
  if (!req.headers.authorization || req.headers.authorization.split(' ')[0] !== 'Bearer') {
    res.status(401).send({ error: 'Missing credentials' });
  } else {
    const accessToken = req.headers.authorization.split(' ')[1];
    // Check if the access token is valid
    return dbManager.getDb()
      .collection('accessTokens')
      .find({ accessToken })
      .limit(1)
      .next()
      .then(accessTokenRecord => {
        // Check if access token belongs to the user id
        if (accessTokenRecord && accessTokenRecord.userId.toHexString() === req.params.id) {
          // Access token is valid and belongs to the user id
          return next();
        }
        // Access token is invalid or does not belong to the user id
        res.status(401).send({ error: 'Invalid credentials' });
      });
  }
  return undefined;
};
