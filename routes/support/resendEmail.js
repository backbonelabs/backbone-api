import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import tokenFactory from '../../lib/tokenFactory';
import EmailUtility from '../../lib/EmailUtility';

const debug = Debug('routes:support:resendEmail');

/**
 * Resends comfirmation email and sets new comfirmation tokens
 * @param  {Object} req              Request
 * @param  {Object} req.body         Request body
 * @param  {String} req.body._id     User id
 * @param  {String} req.body.message Support ticket message
 * @return {Promise} Resolves with a user object
 */
export default req => validate(req.body, {
  _id: schemas.user._id,
}, ['_id'])
  .then(() => (
    // Verify user
    dbManager.getDb()
      .collection('users')
      .find({ _id: dbManager.mongodb.ObjectId(req.body._id) })
      .limit(1)
      .next()
      .then((user) => {
        if (user) {
          debug('Found user by id', user);
          return user;
        }
        debug('Did not find user by id', req.body._id);
        throw new Error('Invalid user');
      })
  ))
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
            { _id: dbManager.mongodb.ObjectID(req.body._id) },
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
