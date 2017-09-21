import Debug from 'debug';
import Joi from 'joi';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import { mapIdsToTrainingPlans } from '../../lib/trainingPlans';
import validate from '../../lib/validate';

const debug = Debug('routes:admin:getUsers');

/**
 * Returns a collection of users
 *
 * @param  {Object} req               Request
 * @param  {Object} req.query         Request query string
 * @param  {String} [req.query.q]     Search query for matching on users' nickname and email
 * @param  {String} [req.query.page]  The page of results to return
 * @param  {String} [req.query.limit] Maximum number of results per page
 * @return {Promise<Object[]>} Resolves with an array of all users, sans passwords
 */

export default req => validate(req.query, {
  q: Joi.string().allow(''),
  page: Joi.number().positive().integer(),
  limit: Joi.number().positive().integer(),
})
  .then(() => {
    const { q } = req.query;
    const searchQuery = {};
    if (q) {
      // This will perform a regular expression search across the entire collection
      // and will not make use of a text index. This is required in order to do partial
      // word matching. If performance is an issue, we will need to resort to doing
      // whole-word matching using the $text query operator
      // (https://docs.mongodb.com/manual/reference/operator/query/text/).
      const re = new RegExp(q, 'i');
      searchQuery.$or = [{ nickname: re }, { email: re }];
    }
    debug('Search query', searchQuery);

    const cursor = dbManager
      .getDb()
      .collection('users')
      .find(searchQuery);

    const page = Number(req.query.page);
    const limit = Number(req.query.limit);

    if (limit) {
      cursor.limit(limit);
    }

    if (page > 1 && limit) {
      cursor.skip((page - 1) * limit);
    }

    return Promise.all([cursor.toArray(), cursor.count()])
      .then(([userDocs, count]) => {
        // cursor.count() returns the total number of documents that match the search query
        // but doesn't take in the effects of .limit() or .skip() applied to the cursor.

        const users = userDocs
          // Remove password from all users
          .map(sanitizeUser)
          // Add training plan details
          .map(user => ({
            ...user,
            trainingPlans: mapIdsToTrainingPlans(user.trainingPlans, user.trainingPlanProgress),
          }));

        return {
          users,
          count,
        };
      });
  });
