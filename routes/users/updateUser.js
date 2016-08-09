import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import sanitizeUser from '../../lib/sanitizeUser';

/**
 * Updates a user
 * @param  {Object} req           Request
 * @param  {String} req.params.id User ID
 * @param  {Object} req.body      Key-value pairs of user attributes to update
 * @return {Promise} Resolves with the user object containing the updated attributes, sans password
 */
export default req => validate(req.body, Object.assign({}, schemas.user, {
  password: schemas.password,
  verifyPassword: schemas.password,
}), [], ['_id'])
  .then(() => {
    // Check if we need to update the password
    const {
      password: pw,
      verifyPassword,
      ...body,
    } = req.body;

    if (pw || verifyPassword) {
      // Make sure password and verifyPassword are the same
      if (pw !== verifyPassword) {
        throw new Error('Passwords must match');
      }

      // Hash password
      return password.hash(pw)
        .then(hash => {
          body.password = hash;
          return body;
        });
    }

    return body;
  })
  .then(updateFields => (
    // Attempt to update the user
    dbManager.getDb()
      .collection('users')
      .updateOne({ _id: dbManager.mongodb.ObjectID(req.params.id) }, { $set: updateFields })
  ))
  .then(updateWriteOpReesult => {
    if (!updateWriteOpReesult.modifiedCount) {
      // User ID doesn't exist
      throw new Error('Invalid user');
    }

    // Get updated user document
    return dbManager.getDb()
      .collection('users')
      .findOne({ _id: dbManager.mongodb.ObjectID(req.params.id) });
  })
  .then(user => sanitizeUser(user));
