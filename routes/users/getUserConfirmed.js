import dbManager from '../../lib/dbManager';

/**
 * Checks if a user has confirmed their email
 * @param  {Object} req              Request
 * @param  {Object} req.params       Request parameters
 * @param  {String} req.params.email User's email address
 * @param  {Object} res              Response
 * @return {Promise} Resolves with an object containing boolean property stating
 *                   whether a user has confirmed their email.
 */
export default (req, res) => (
  dbManager.getDb()
    .collection('users')
    .findOne({ email: req.params.email })
    .then(user => {
      if (!user) {
        res.status(401);
        throw new Error('This user does not exist.');
      } else if (!user.isConfirmed) {
        res.status(401);
        return { isConfirmed: false };
      }
      return { isConfirmed: true };
    })
);
