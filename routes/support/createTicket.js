import Debug from 'debug';
import validate from '../../lib/validate';
import schemas from '../../lib/schemas';
import dbManager from '../../lib/dbManager';
import EmailUtility from '../../lib/EmailUtility';

const debug = Debug('routes:support:createTicket');

/**
 * Creates a new support ticket, which simply sends an email to support@gobackbone.com
 * @param  {Object} req              Request
 * @param  {Object} req.body         Request body
 * @param  {String} req.body._id     User id
 * @param  {String} req.body.message Support ticket message
 * @return {Promise} Resolves with an empty object upon successful email send
 */
export default req => validate(req.body, {
  _id: schemas.user._id,
  message: schemas.supportMessage,
}, ['_id', 'message'])
  .then(() => (
    // Verify user
    dbManager.getDb()
      .collection('users')
      .find({ _id: dbManager.mongodb.ObjectId(req.body._id) })
      .limit(1)
      .next()
      .then(user => {
        if (user) {
          debug('Found user by id', user);
          return user;
        }
        debug('Did not find user by id', req.body._id);
        throw new Error('Invalid user');
      })
  ))
  .then(user => {
    // Send email to support inbox
    const emailUtility = EmailUtility.getMailer();
    return emailUtility.sendSupportEmail(user.email, req.body.message);
  })
  .then(() => {
    debug('Sent support email');
    return {};
  });
