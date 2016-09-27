import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

/**
 * Checks if a user is confirmed
 * @param  {Object} req              Request
 * @param  {Object} req.params       Request parameters
 * @param  {String} req.params.email User's email address
 * @param  {Object} res              Response
 * @return {Promise} Resolves with a boolean indicating whether the user is confirmed or not
 */
export default (req, res) => (
  dbManager.getDb()
    .collection('users')
    .findOne({ email: req.params.email })
    .then(user => {
      if (!user) {
        throw new Error('This user does not exist.');
      } else if (user && !user.isConfirmed) {
        res.status(401);
        throw new Error('User has not confirmed email.');
      } else {
        return user;
      }
    })
    .then(user => sanitizeUser(user))
);
