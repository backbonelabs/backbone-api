import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

/**
 * Returns all users
 *
 * TODO: Use query parameters to retrieve a subset of users
 *
 * @return {Promise} Resolves with an array of all users, sans passwords
 */
export default () => (
  dbManager.getDb()
    .collection('users')
    .find({})
    .toArray()
)
  .then(users => (
    // Remove password from all users
    users.map(sanitizeUser)
  ));
