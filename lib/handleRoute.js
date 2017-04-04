import Debug from 'debug';
import bugsnag from 'bugsnag';

const debug = Debug('lib:handleRoute');

/**
 * Wrapper for route handlers that will take the data returned by the handlers and
 * send in the response back to the client. Route handlers should return a Promise.
 * If the Promise is rejected, a JSON in the shape of {error: err.message} will be
 * sent to the client.
 *
 * If the route handler rejects and the status code was not set in the route handler,
 * the status code will be set to one of the following defaults based on the error:
 *
 * 500 for database errors
 * 400 for all other errors
 *
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
  .catch((err) => {
    debug('Error from router handler', err);
    let errorMessage;

    // Determine what error message to return
    if (err.name === 'MongoError') {
      // Mask database errors in response
      errorMessage = 'Unexpected database error';
    } else if (err.isJoi) {
      // Joi validation error
      // The Error object includes a `details` property which stores an array of errors.
      // We currently abort Joi validations on the first error, so the array will always
      // have one element.
      errorMessage = err.details[0].message;
    } else {
      errorMessage = err.message;
    }

    // Determine what status code to return
    // The default status code for Express responses is 200, but route handlers may
    // override the status code before the response is passed to routeHandler
    if (res.statusCode === 200) {
      // Status code was not set in the route handler, set a default status code
      if (err.name === 'MongoError') {
        // Set status code to 500 for database errors
        debug('Setting status code to 500 for database error');
        res.status(500);
      } else {
        // Set status code to 400 for all other errors
        debug('Setting status code to 400');
        res.status(400);
      }
    }

    bugsnag.notify(errorMessage);
    res.send({ error: errorMessage });
  });
