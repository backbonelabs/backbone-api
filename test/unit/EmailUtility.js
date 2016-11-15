import { expect } from 'chai';
import sinon from 'sinon';
import EmailUtility from '../../lib/EmailUtility';

describe('EmailUtility', () => {
  it('is a class', () => {
    expect(EmailUtility.EmailUtility).to.be.a('function');
    expect(EmailUtility.EmailUtility.name).to.equal('EmailUtility');
  });

  describe('sendEmail', () => {
    it('is a function', () => {
      expect(EmailUtility.EmailUtility.prototype.sendEmail).to.be.a('function');
    });

    it('returns a Promise', () => {
      const emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
      });

      const emailSendStub = sinon.stub().callsArg(1);
      sinon.stub(emailUtility.mailer, 'messages', () => ({
        send: emailSendStub,
      }));

      expect(emailUtility.sendEmail()).to.be.a('Promise');
    });

    it('will resolve and not send an email if the silentEmail option is truthy', () => {
      const emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: true,
      });

      const emailSendStub = sinon.stub().callsArg(1);
      sinon.stub(emailUtility.mailer, 'messages', () => ({
        send: emailSendStub,
      }));

      return emailUtility.sendEmail({}, 'test@gobackbone.com')
        .then(results => {
          expect(results).to.be.undefined;
          expect(emailSendStub.callCount).to.equal(0);
        });
    });

    it('will use Mailgun to send a message to the email defined in the testEmail option', () => {
      const testEmail = 'test@gobackbone.com';
      const emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
        useTestEmail: true,
        testEmail,
      });

      const emailSendStub = sinon.stub().callsArg(1);
      sinon.stub(emailUtility.mailer, 'messages', () => ({
        send: emailSendStub,
      }));

      const data = {
        from: 'dev@gobackbone.com',
        subject: 'Test',
        text: 'This was sent from an automated test',
      };

      return emailUtility.sendEmail(data, 'random@gobackbone.com')
        .then(() => {
          expect(emailSendStub.callCount).to.equal(1);
          expect(emailSendStub.calledWithMatch({
            ...data,
            to: testEmail,
          }));
        });
    });

    it('will use Mailgun to send a message', () => {
      const emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
        useTestEmail: false,
      });

      const emailSendStub = sinon.stub().callsArg(1);
      sinon.stub(emailUtility.mailer, 'messages', () => ({
        send: emailSendStub,
      }));

      const fromEmail = 'dev@gobackbone.com';
      const toEmail = 'test@gobackbone.com';

      const data = {
        from: fromEmail,
        subject: 'Test',
        text: 'This was sent from an automated test',
      };

      return emailUtility.sendEmail(data, toEmail)
        .then(() => {
          expect(emailSendStub.callCount).to.equal(1);
          expect(emailSendStub.calledWithMatch({
            ...data,
            to: toEmail,
          }));
          emailUtility.mailer.messages.restore();
        });
    });
  });
});
