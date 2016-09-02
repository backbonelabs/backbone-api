import schemas from '../../lib/schemas';
import validate from '../../lib/validate';
import dbManager from '../../lib/dbManager';
import sanitizeUser from '../../lib/sanitizeUser';

export default req => validate(req.body, schemas.settings)
  .then(() => {
    const settings = { settings: req.body };

    return dbManager.getDb()
      .collection('users')
      .updateOne(
        { _id: dbManager.mongodb.ObjectID(req.params.id) },
        { $set: settings }
      );
  })
  .then(updateWriteOpResult => {
    if (!updateWriteOpResult.modifiedCount) {
      // User ID doesn't exist
      throw new Error('Invalid user');
    }

    // Get updated user document
    return dbManager.getDb()
      .collection('users')
      .findOne({ _id: dbManager.mongodb.ObjectID(req.params.id) });
  })
  .then(user => sanitizeUser(user));
