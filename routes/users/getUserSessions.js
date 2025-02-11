import Debug from 'debug';
import request from 'request-promise';
import errors from 'request-promise/errors';
import moment from 'moment-timezone';
import schemas from '../../lib/schemas';
import validate from '../../lib/validate';

const debug = Debug('routes:users:getUserSessions');

/**
 * Returns user posture sessions for the given dates
 * @param  {Object} req            Request
 * @param  {Object} req.params     Request route parameters
 * @param  {String} req.params.id  User ID
 * @param  {Object} req.query      Request query parameters
 * @param  {String} req.query.from Starting date of the posture sessions to retrieve.
 *                                 It must match known ISO 8601 formats.
 * @param  {String} req.query.to   Ending date of the posture session to retrieve.
 *                                 It must match known ISO 8601 formats.
 * @return {Promise<Array>} Resolves with an array of the sessions within the date range
 */

export default (req, res) => validate(req.query, {
  from: schemas.isoDate,
  to: schemas.isoDate,
}, ['from', 'to'])
  .then(() => {
    const { id } = req.params;
    const { from, to } = req.query;

    // Mixpanel stores, queries, and returns event times in our project's timezone,
    // which is US/Pacific. As a result, we need to convert the query dates to
    // Pacific time. See https://blog.mixpanel.com/2015/08/24/community-tip-all-about-time.
    const fromDateString = moment.tz(from, 'UTC').tz('US/Pacific').format('YYYY-MM-DD');
    const toDateString = moment.tz(to, 'UTC').tz('US/Pacific').format('YYYY-MM-DD');

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
          from_date: fromDateString,
          to_date: toDateString,
          id,
        }),
      },
      headers: { 'Cache-control': 'no-cache' },
      auth: { user: process.env.BL_MIXPANEL_API_SECRET },
      json: true,
    })
    .then((response) => {
      return response.map((event) => {
        // zone.offset() will figure out whether DST applies for
        // the given date and will return the correct offset in minutes
        const offsetMinutes = moment.tz.zone('US/Pacific').offset(event.time);
        const offsetMilliseconds = offsetMinutes * 60 * 1000;
        return {
          // Mixpanel returns times in Pacific timezone, so add offset to get UTC timestamp
          timestamp: event.time + offsetMilliseconds,
          sessionTime: event.properties.sessionTime,
          slouchTime: event.properties.slouchTime,
          totalDuration: event.properties.totalDuration,
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
  });
