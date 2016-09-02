import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

export default req =>
  dbManager.getDb()
    .collection('users')
    .findOne({ _id: dbManager.mongodb.ObjectId(req.params.id) })
    .then(user => {
      if (!user) {
        throw new Error('No user found');
      } else if (user && user.settings) {
        // Return user object without password
        return sanitizeUser(user);
      }
      const settings = { postureThreshold: 0.1 };

      return dbManager.getDb()
        .collection('users')
        .updateOne(
          { _id: dbManager.mongodb.ObjectId(req.params.id) },
          { $set: { settings } }
        )
        .then(() => Object.assign({}, user, settings));
    });
