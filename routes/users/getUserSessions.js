import request from 'request-promise';
import Debug from 'debug';

const debug = Debug('routes:users:getUserSessions');

/**
 * Returns user posture sessions for the given dates
 * @param  {Object} req           Request
 * @param  {Object} req.params    Request parameters
 * @param  {String} req.params.id User ID
 * @return {Promise} Resolves with the sessions object
 */

export default req => {
  const { id } = req.params;
  const { from, to } = req.query;

  const script = `function main() {
      return Events({
        from_date: ${JSON.stringify(from)},
        to_date: ${JSON.stringify(to)},
      }).filter((event) => {
        return (event.name == 'postureSession') && (event.distinct_id === ${JSON.stringify(id)});
      });
    }`;

  return request.post('https://mixpanel.com/api/2.0/jql/', {
    form: {
      script,
      params: JSON.stringify({
        from_date: from,
        to_date: to,
      }),
    },
    headers: { 'Cache-control': 'no-cache' },
    auth: { user: process.env.BL_MIXPANEL_API_SECRET },
    json: true,
  })
  .then((response) => {
    let seen = {};
    // Sort the sessions
    // Merge the all the sessions with the same date
    const groupByDay = response
      .sort((a, b) => b.time - a.time) // sort from latest to oldest
      .filter((val) => {
        const date = new Date(val.time);

        if (new Date(seen.time).toDateString() === (date.toDateString())) {
          seen.properties.sessionTime += val.properties.sessionTime;
          seen.properties.slouchTime += val.properties.slouchTime;
          seen.properties.totalDuration += val.properties.totalDuration;
          // Don't keep this value, It's merged
          return false;
        }

        // remember this obj
        seen = val;
        return true;
      });

    return groupByDay;
  })
  .catch((error) => {
    debug('Failed to fetch sessions ', error.message);
    throw new Error(error.message);
  });
};
