import dbManager from '../../lib/dbManager';

export default req => {
  const id = req.params.id;
  return dbManager.getDb()
    .collection('users')
    .findOne({ _id: dbManager.mongodb.ObjectId(id) })
    .then(user => {
      if (user) {
        // Return user object without password
        const userSansPassword = Object.assign({}, user);
        delete userSansPassword.password;
        return userSansPassword;
      }
      throw new Error('No user found');
    });
};
