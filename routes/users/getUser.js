import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

/**
 * Returns a user profile
 * @param  {Object} req           Request
 * @param  {Object} req.params    Request parameters
 * @param  {String} req.params.id User ID
 * @return {Promise} Resolves with the user object, sans password
 */
export default req => {
  const id = req.params.id;
  return dbManager.getDb()
    .collection('users')
    .findOne({ _id: dbManager.mongodb.ObjectId(id) })
    .then(user => {
      if (user) {
        // Return user object without password
        return sanitizeUser(user);
      }
      throw new Error('No user found');
    });
};
