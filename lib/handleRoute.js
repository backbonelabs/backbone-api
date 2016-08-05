import Debug from 'debug';

const debug = Debug('lib:handleRoute');

/**
 * Wrapper for route handlers that will take the data returned by the handlers and
 * send in the response back to the client. Route handlers should return a Promise.
 * If the Promise is rejected, a JSON in the shape of {error: err.message} will be
 * sent to the client. The status code will be 400 by default if no status code was
 * set in the route handler.
 * @param  {Function} routeHandler The route handler will be called with the request and
 *                                 response objects, and the route handler should return a
 *                                 Promise that resolves with the data that will be sent back
 *                                 in the response
 * @return {Promise}
 */
export default routeHandler => (req, res) => Promise.resolve()
  .then(() => routeHandler(req, res))
  .then(handlerResults => res.send(handlerResults))
  .catch(err => {
    debug('Error from router handler', err);
    if (res.statusCode === 200) {
      // Status code was not set, set to 400 by default
      res.status(400);
    }
    res.send({ error: err.message });
  });
