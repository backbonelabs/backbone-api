import dbManager from '../../lib/dbManager';

/**
 * Checks if a user is confirmed
 * @param  {Object} req              Request
 * @param  {Object} req.params       Request parameters
 * @param  {String} req.params.email User's email address
 * @param  {Object} res              Response
 * @return {Promise} Resolves with a boolean indicating whether the user is confirmed or not
 */
export default (req, res) => {
  const email = req.params.email;
  return dbManager.getDb()
    .collection('users')
    .findOne({ email })
    .then(user => {
      if (user && !user.isConfirmed) {
        res.status(401);
      }
      return user.isConfirmed;
    });
};
