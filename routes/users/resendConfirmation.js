import dbManager from '../../lib/dbManager';
import emailService from '../../lib/emailService';
import tokenFactory from '../../lib/tokenFactory';

export default (req, res) => {
  const email = req.body.email;

  return dbManager.getDb()
  .collection('users')
  .findOne({ email })
  .then((user) => {
    if (!user) {
      res.status(400);
      throw new Error('Account not found, please sign-up again');
    } else {
      const confirmationTokenExpiry = new Date();
      confirmationTokenExpiry.setDate(confirmationTokenExpiry.getDate() + 2);

      return tokenFactory.generateConfirmationToken()
      .then((confirmationToken) => (
        dbManager.getDb()
        .collection('users')
        .updateOne({ email },
          { $set: {
            confirmationToken,
            confirmationTokenExpiry,
          },
        })
        .then(() => emailService.sendConfirmationEmail(email, confirmationToken))
      ))
      .then(() => true);
    }
  });
};
