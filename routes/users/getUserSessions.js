import request from 'request-promise';
import Debug from 'debug';

const debug = Debug('routes:users:getUserSessions');

/**
 * Formats date object to "YYYY-MM-DD"
 * @param  {Boolean} days
 * @return {String} date "YYYY-MM-DD"
 */

const getDaysAgo = (days) => {
  const today = new Date();
  today.setDate(today.getDate() - days);

  let month = (today.getMonth() + 1);
  let day = today.getDate();
  const year = today.getFullYear();

  if (month.length < 2) month = `0${month}`;
  if (day.length < 2) day = `0${day}`;

  return `${year}-${month}-${day}`;
};

/**
 * Returns user posture sessions for the given dates
 * @param  {Object} req           Request
 * @param  {Object} req.params    Request parameters
 * @param  {String} req.params.id User ID
 * @return {Promise} Resolves with the sessions object
 */

export default req => {
  const id = req.params.id;

  const params = {
    from_date: getDaysAgo(20),
    to_date: getDaysAgo(0),
  };

  const script = `function main() {
      return Events({
        from_date: ${JSON.stringify(params.from_date)},
        to_date: ${JSON.stringify(params.to_date)},
      }).filter((event) => {
        return (event.name == 'postureSession') && (event.distinct_id === ${JSON.stringify(id)});
      });
    }`;

  return request.post('https://mixpanel.com/api/2.0/jql/', {
    form: {
      script,
      params: JSON.stringify(params),
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
      .sort((a, b) => a.time - b.time)
      .filter((val) => {
        const date = new Date(val.time);

        if (new Date(seen.time).toDateString() === (date.toDateString())) {
          if (
          Number.isInteger(val.properties.sessionTime) &&
          Number.isInteger(val.properties.slouchTime) &&
          Number.isInteger(val.properties.totalDuration)
          ) {
            seen.properties.sessionTime += val.properties.sessionTime;
            seen.properties.slouchTime += val.properties.slouchTime;
            seen.properties.totalDuration += val.properties.totalDuration;
          }

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
