import dbManager from '../../lib/dbManager';

export default (req, res) => {
  const email = req.params.email;
  return dbManager.getDb()
    .collection('users')
    .findOne({ email })
    .then(user => {
      if (user && !user.confirmed) {
        res.status(401);
      }
      return user.confirmed;
    });
};
