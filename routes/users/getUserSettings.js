import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

export default req => (
  dbManager.getDb()
    .collection('users')
    .findOne({ _id: dbManager.mongodb.ObjectId(req.params.id) })
    .then(user => {
      if (!user) {
        throw new Error('No user found');
      } else if (user && user.settings) {
        // User exists and has existing settings
        // Return user object without password
        return sanitizeUser(user);
      }
      // User exists but does not have any existing settings
      // Set default settings
      const settings = { settings: { postureThreshold: 0.2 } };

      return dbManager.getDb()
        .collection('users')
        .findOneAndUpdate(
          { _id: dbManager.mongodb.ObjectId(req.params.id) },
          { $set: settings },
          { returnOriginal: false }
        )
        .then(result => {
          if (!result.value) {
            // User ID doesn't exist
            throw new Error('Invalid user');
          }

          // Return updated user
          return sanitizeUser(result.value);
        });
    })
);
