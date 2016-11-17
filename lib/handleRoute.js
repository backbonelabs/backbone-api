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
 * @return {Promise} Resolves with the value resolved from the routeHandler, and rejects
 *                   with an object containing the error message
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
    let errorMessage;
    if (err.isJoi) {
      // Joi validation error
      // The Error object includes a `details` property which stores an array of errors.
      // We currently abort Joi validations on the first error, so the array will always
      // have one element.
      errorMessage = err.details[0].message;
    } else {
      errorMessage = err.message;
    }
    res.send({ error: errorMessage });
  });
