import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import { mapObjectIdsToDocuments } from '../../lib/trainingPlans';

/**
 * Returns a user profile
 * @param  {Object} req           Request
 * @param  {Object} req.params    Request parameters
 * @param  {String} req.params.id User ID
 * @return {Promise} Resolves with the user object, sans password
 */
export default (req) => {
  const id = req.params.id;
  return dbManager.getDb()
    .collection('users')
    .find({ _id: dbManager.mongodb.ObjectId(id) })
    .limit(1)
    .next()
    .then((user) => {
      if (user) {
        // Omit password
        const sanitizedUser = sanitizeUser(user);

        // Add training plan details
        sanitizedUser.trainingPlans = mapObjectIdsToDocuments(user.trainingPlans);

        return sanitizedUser;
      }
      throw new Error('No user found');
    });
};
