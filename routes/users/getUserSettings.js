import { get, isEqual } from 'lodash';
import dbManager from '../../lib/dbManager';
import userSettings from '../../lib/userSettings';

/**
 * Returns settings for a user. If the user is missing settings, default values for the
 * missing settings will be merged with the user's existing settings.
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
      } else {
        // Get user's existing settings
        const existingSettings = get(user, 'settings', {});
        // Merge user's settings with default settings
        const mergedSettings = userSettings.mergeWithDefaults(existingSettings);

        if (isEqual(existingSettings, mergedSettings)) {
          // User already has all settings defined
          return existingSettings;
        }

        // User is missing settings, fill missing settings with default values
        return dbManager.getDb()
          .collection('users')
          .findOneAndUpdate(
            { _id: dbManager.mongodb.ObjectId(req.params.id) },
            { $set: { settings: mergedSettings } },
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
      }
    })
);
