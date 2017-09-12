import Debug from 'debug';
import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import EmailUtility from '../../lib/EmailUtility';

const debug = Debug('routes:users:resendEmail');

/**
 * Resends comfirmation email and sets new comfirmation tokens
 * @param  {Object} req           Request
 * @param  {Object} req.params    Request parameters
 * @param  {String} req.params.id User ID
 * @return {Promise} Resolves with a user object
 */
export default (req) => {
  const id = req.params.id;
  // Verify user
  return dbManager.getDb()
    .collection('users')
    .find({ _id: dbManager.mongodb.ObjectId(id) })
    .limit(1)
    .next()
    .then((user) => {
      if (user) {
        debug('Found user by id', user);
        return user;
      }
      debug('Did not find user by id', id);
      throw new Error('Invalid user');
    })
  .then(user => (
    // Generate new tokens and send email
    tokenFactory.generateToken()
      .then(([confirmationToken, confirmationTokenExpiry]) => ({
        confirmationToken,
        confirmationTokenExpiry,
      }))
      .then((tokenResults) => {
        const emailUtility = EmailUtility.getMailer();
        emailUtility.sendConfirmationEmail(user.email, tokenResults.confirmationToken);
        return tokenResults;
      })
      .then(tokenResults => (
        dbManager.getDb()
          .collection('users')
          .findOneAndUpdate(
            { _id: dbManager.mongodb.ObjectID(id) },
            { $set: tokenResults },
            { returnOriginal: false },
          )))
      )
    )
  .then((user) => {
    debug('Email was resent');
    if (!user.value) {
      // User ID doesn't exist
      throw new Error('Invalid user');
    }

    const updatedTokens = {};
    updatedTokens.confirmationToken = user.value.confirmationToken;
    updatedTokens.confirmationTokenExpiry = user.value.confirmationTokenExpiry;

    return updatedTokens;
  });
};
