import Debug from 'debug';

const debug = Debug('lib:handleRoute');

/**
 * Wrapper for route handlers that will take the data returned by the handlers and
 * send in the response back to the client. Route handlers should return a Promise.
 * If the Promise is rejected, a 400 will be returned to the client with a JSON
 * in the shape of {error: err.message}.
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
    res.status(400).send({ error: err.message });
  });
