import { expect } from 'chai';
import EmailUtility from '../../lib/EmailUtility';

describe('Library modules', () => {
  describe('EmailUtility', () => {
    it('sendEmail method will use Mailgun to send a message', () => {
      const emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
        useTestEmail: true,
      });

      const fromEmail = 'dev@gobackbone.com';
      const toEmail = 'test@gobackbone.com';

      const data = {
        from: fromEmail,
        subject: 'Test',
        text: 'This was sent from the automated integration test for EmailUtility.sendEmail()',
      };

      const startTime = process.hrtime();

      return emailUtility.sendEmail(data, toEmail)
        .then(() => {
          const duration = process.hrtime(startTime);
          expect((duration[0] * 1e9) + duration[1]).to.be.at.least(200);
        });
    });
  });
});
