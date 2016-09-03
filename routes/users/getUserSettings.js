import dbManager from '../../lib/dbManager';
import defaultUserSettings from '../../lib/defaultUserSettings';

/**
 * Returns settings for a user. If no settings exist, default settings will be applied to the user.
 * @param  {Object} req Request
 * @return {Promise} Resolves with an object representing the user's settings
 */
export default req => (
  dbManager.getDb()
    .collection('users')
    .findOne({ _id: dbManager.mongodb.ObjectId(req.params.id) })
    .then(user => {
      if (!user) {
        throw new Error('No user found');
      } else if (user && user.settings) {
        // User exists and has existing settings
        // Return existing user settings
        return user.settings;
      }
      // User exists but does not have any existing settings
      // Set default settings
      const settings = { settings: defaultUserSettings };

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

          // Return user settings
          return result.value.settings;
        });
    })
);
