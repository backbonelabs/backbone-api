import dbManager from './dbManager';

/**
 * Express middleware that ensures a request has a valid access token
 * in order to access the resource. The access token must be included
 * in the Authorization header using the Bearer scheme.
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
      .then((accessTokenRecord) => {
        if (accessTokenRecord) {
          // Access token is valid
          next();
        } else {
          // Access token is invalid
          res.status(401).send({ error: 'Invalid credentials' });
        }
      });
  }
  return undefined;
};
