import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';
import { mapIdsToTrainingPlans } from '../../lib/trainingPlans';

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

        // Add training plans details
        sanitizedUser.trainingPlans =
          mapIdsToTrainingPlans(sanitizedUser.trainingPlans, sanitizedUser.trainingPlanProgress);

        return sanitizedUser;
      }
      throw new Error('No user found');
    });
};
