import dbManager from '../../lib/dbManager';
import emailUtility from '../../lib/emailUtility';

export default req => {
  console.log('req body ', req.body);
  const email = req.body.email;
  const confirmationTokenExpiry = new Date();
  confirmationTokenExpiry.setDate(confirmationTokenExpiry.getDate() + 2);

  return emailUtility.generateConfirmationToken()
  .then((token) => (
    dbManager.getDb()
    .collection('users')
    .update({ email },
      { $set: {
        confirmationToken: token,
        confirmationTokenExpiry,
      },
    })
    .then(() => emailUtility.sendConfirmationEmail(email, token))
  ))
  .then(() => true);
};
