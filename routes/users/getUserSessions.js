import request from 'request-promise';
import errors from 'request-promise/errors';

import Debug from 'debug';

const debug = Debug('routes:users:getUserSessions');

/**
 * Returns user posture sessions for the given dates
 * @param  {Object} req             Request
 * @param  {Object} req.params      Request parameters
 * @param  {String} req.query.from  Date
 * @param  {String} req.query.to    Date
 * @param  {String} req.params.id   User ID
 * @return {Promise} Resolves with the sessions object
 */

export default req => {
  const { id } = req.params;
  const { from, to } = req.query;

/* eslint-disable */
  const script = function main() {
    return Events({
      from_date: params.from_date,
      to_date: params.to_date,
    }).filter((event) => {
      return (event.name === 'postureSession') && (event.distinct_id === params.id);
    });
  };
/* eslint-disable */

  return request.post('https://mixpanel.com/api/2.0/jql/', {
    form: {
      script: script.toString(),
      params: JSON.stringify({
        from_date: from,
        to_date: to,
        id,
      }),
    },
    headers: { 'Cache-control': 'no-cache' },
    auth: { user: process.env.BL_MIXPANEL_API_SECRET },
    json: true,
  })
  .then((response) => {
    return response.map((val) => {
      return {
        timestamp: val.time,
        sessionTime: val.properties.sessionTime,
        slouchTime: val.properties.slouchTime,
        totalDuration: val.properties.totalDuration,
      }
    });
  })
  .catch(errors.StatusCodeError, (reason) => {
    // The server responded with a status codes other than 2xx.
    debug('Failed to fetch sessions StatusCodeError', reason.statusCode, reason.message);
    throw new Error(reason.message)
  })
  .catch(errors.RequestError, (reason) => {
    // The request failed due to technical reasons.
    debug('Failed to fetch sessions RequestError', reason.message);
    throw new Error(reason.message)
  })
  .catch(err => {
    // Return generic error message to hide details about specific Mixpanel errors
    res.status(500);
    throw new Error('Could not retrieve session data');
  });
};
