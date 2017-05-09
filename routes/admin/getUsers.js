import Debug from 'debug';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

const debug = Debug('routes:admin:getUsers');

/**
 * Returns a collection of users
 *
 * @param  {Object} req           Request
 * @param  {Object} req.query     Request query string
 * @param  {String} [req.query.q] Search query for matching on users' nickname and email
 * @return {Promise} Resolves with an array of all users, sans passwords
 */
export default (req) => {
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

  return dbManager.getDb()
    .collection('users')
    .find(searchQuery)
    .toArray()
    .then(users => (
      // Remove password from all users
      users.map(sanitizeUser)
    ));
};
