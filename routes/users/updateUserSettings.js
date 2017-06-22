import mapKeys from 'lodash/mapKeys';
import schemas from '../../lib/schemas';
import validate from '../../lib/validate';
import dbManager from '../../lib/dbManager';

/**
 * Updates feature settings for a user
 * @param  {Object} req      Request
 * @param  {Object} req.body Request body containing the settings to update
 * @return {Promise} Resolves with the user object containing the updated attributes, sans password
 */
export default req => validate(req.body, schemas.settings)
  .then(() => {
    const settings = mapKeys(req.body, (value, key) => `settings.${key}`);

    return dbManager.getDb()
      .collection('users')
      .findOneAndUpdate(
        { _id: dbManager.mongodb.ObjectID(req.params.id) },
        { $set: settings },
        { returnOriginal: false },
      );
  })
  .then((result) => {
    if (!result.value) {
      // User ID doesn't exist
      throw new Error('Invalid user');
    }

    // Return updated user settings
    return result.value.settings;
  });
