import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import password from '../../lib/password';
import sanitizeUser from '../../lib/sanitizeUser';
import tokenFactory from '../../lib/tokenFactory';
import EmailUtility from '../../lib/EmailUtility';

const debug = Debug('routes:users:updateUsers');

/**
 * Updates a user
 * @param  {Object} req           Request
 * @param  {String} req.params.id User ID
 * @param  {Object} req.body      Key-value pairs of user attributes to update
 * @return {Promise} Resolves with the user object containing the updated attributes, sans password
 */
export default (req) => {
  const reqBody = Object.assign({}, req.body);

  // If the session time sent from the user's phone is ahead of the servers's time then
  // set the last session time to the current server's time so it won't fail validation.
  if (reqBody.lastSession) {
    const sessionUnixTime = Date.parse(reqBody.lastSession);
    const systemUnixTime = Date.now();
    if (sessionUnixTime > systemUnixTime) {
      reqBody.lastSession = (new Date(systemUnixTime)).toISOString();
    }
  }

  return validate(reqBody, Object.assign({}, schemas.user, {
    currentPassword: schemas.password,
    password: schemas.password,
    verifyPassword: schemas.password,
  }), [], ['_id'])
    .then(() => (
      // Make sure user exists
      dbManager.getDb()
        .collection('users')
        .find({ _id: dbManager.mongodb.ObjectID(req.params.id) })
        .limit(1)
        .next()
        .then((user) => {
          if (user) {
            debug('Found user by id', req.params.id);
            return user;
          }
          debug('Did not find user by id', req.params.id);
          throw new Error('Invalid user id');
        })
    ))
    .then((user) => {
      const {
        password: pw,
        verifyPassword,
        currentPassword,
        ...body
      } = reqBody;

      // Ensure birthdate gets saved as ISODate by making it a JS Date object
      if (body.birthdate) {
        body.birthdate = new Date(body.birthdate);
      }

      // Ensure lastSession gets saved as ISODate by making it a JS Date object
      if (body.lastSession) {
        body.lastSession = new Date(body.lastSession);
      }

      if (pw || verifyPassword) {
        // Make sure password and verifyPassword are the same
        if (pw !== verifyPassword) {
          throw new Error('Passwords must match');
        }
        return password.verify(currentPassword, user.password)
          .then((isPasswordMatch) => {
            // If password doesn't match
            if (!isPasswordMatch) {
              debug('Invalid password');
              throw new Error('Current password is incorrect');
            }
            // Hash password
            return password.hash(pw)
              .then((hash) => {
                body.password = hash;
                return [user, body];
              });
          });
      }

      return [user, body];
    })
    .then(([user, body]) => {
      const { email } = body;

      // Check if email is already taken
      if (email && email !== user.email) {
        return dbManager.getDb()
        .collection('users')
        .find({ email: new RegExp(`^${email}$`, 'i') })
        .limit(1)
        .next()
        .then((userWithEmail) => {
          if (userWithEmail) {
            throw new Error('Email already taken');
          }
          return tokenFactory.generateToken()
            .then(([confirmationToken, confirmationTokenExpiry]) =>
              Object.assign(body, { confirmationToken, confirmationTokenExpiry })
            )
            .then(() => {
              const emailUtility = EmailUtility.getMailer();
              return emailUtility.sendConfirmationEmail(email, body.confirmationToken);
            })
            .then(() => Object.assign(body, { isConfirmed: false }));
        });
      }
      return body;
    })
    .then(updateFields => (
      // Attempt to update the user
      dbManager.getDb()
        .collection('users')
        .findOneAndUpdate(
          { _id: dbManager.mongodb.ObjectID(req.params.id) },
          { $set: updateFields },
          { returnOriginal: false },
        )
    ))
    .then((user) => {
      if (!user.value) {
        // User ID doesn't exist
        throw new Error('Invalid user');
      }

      // Return updated user
      return sanitizeUser(user.value);
    });
};
