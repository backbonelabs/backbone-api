import { expect } from 'chai';
import sinon from 'sinon';
import EmailUtility from '../../lib/EmailUtility';

describe('EmailUtility', () => {
  let emailUtility;
  let sendEmailStub;

  beforeEach(() => {
    emailUtility = EmailUtility.init({
      apiKey: process.env.BL_MAILGUN_API,
      domain: process.env.BL_MAILGUN_DOMAIN,
      silentEmail: false,
      useTestEmail: false,
    });
  });

  it('is a class', () => {
    expect(EmailUtility.EmailUtility).to.be.a('function');
    expect(EmailUtility.EmailUtility.name).to.equal('EmailUtility');
  });

  describe('sendEmail', () => {
    it('is a function', () => {
      expect(EmailUtility.EmailUtility.prototype.sendEmail).to.be.a('function');
    });

    it('returns a Promise', () => {
      const emailSendStub = sinon.stub().callsArg(1);
      sinon.stub(emailUtility.mailer, 'messages', () => ({
        send: emailSendStub,
      }));

      expect(emailUtility.sendEmail()).to.be.a('Promise');
    });

    it('will resolve and not send an email if the silentEmail option is truthy', () => {
      emailUtility = EmailUtility.init({
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
      emailUtility = EmailUtility.init({
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
      emailUtility = EmailUtility.init({
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

  describe('sendConfirmationEmail', () => {
    it('is a function', () => {
      expect(EmailUtility.EmailUtility.prototype.sendConfirmationEmail).to.be.a('function');
    });

    it('calls the sendEmail method with the correct arguments', () => {
      sendEmailStub = sinon.stub(emailUtility, 'sendEmail', () => Promise.resolve());
      const recipientEmail = 'test+sendConfirmationEmail@gobackbone.com';
      const token = 'token123';

      emailUtility.sendConfirmationEmail(recipientEmail, token);

      const spyCall = sendEmailStub.getCall(0);
      const args = spyCall.args;
      const link = `${process.env.BL_DOMAIN_URL}/auth/confirm/email?token=${token}`;

      expect(sendEmailStub.callCount).to.equal(1);
      expect(args[0]).to.be.an('object');
      expect(args[0].subject).to.equal(EmailUtility.templates.confirmEmail.subject);
      expect(args[0].text).to.contain(link);
      expect(args[1]).to.equal(recipientEmail);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('is a function', () => {
      expect(EmailUtility.EmailUtility.prototype.sendPasswordResetEmail).to.be.a('function');
    });

    it('calls the sendEmail method with the correct arguments', () => {
      sendEmailStub = sinon.stub(emailUtility, 'sendEmail', () => Promise.resolve());
      const recipientEmail = 'test+sendPasswordResetEmail@gobackbone.com';
      const token = 'token123';

      emailUtility.sendPasswordResetEmail(recipientEmail, token);

      const spyCall = sendEmailStub.getCall(0);
      const args = spyCall.args;
      const link = `${process.env.BL_WEB_URL}/password-reset?token=${token}`;

      expect(sendEmailStub.callCount).to.equal(1);
      expect(args[0]).to.be.an('object');
      expect(args[0].subject).to.equal(EmailUtility.templates.passwordReset.subject);
      expect(args[0].text).to.contain(link);
      expect(args[1]).to.equal(recipientEmail);
    });
  });

  describe('sendPasswordResetSuccessEmail', () => {
    it('is a function', () => {
      expect(EmailUtility.EmailUtility.prototype.sendPasswordResetSuccessEmail).to.be.a('function');
    });

    it('calls the sendEmail method with the correct arguments', () => {
      sendEmailStub = sinon.stub(emailUtility, 'sendEmail', () => Promise.resolve());
      const recipientEmail = 'test+sendPasswordResetSuccessEmail@gobackbone.com';

      emailUtility.sendPasswordResetSuccessEmail(recipientEmail);

      const spyCall = sendEmailStub.getCall(0);
      const args = spyCall.args;

      expect(sendEmailStub.callCount).to.equal(1);
      expect(args[0]).to.be.an('object');
      expect(args[0].subject).to.equal(EmailUtility.templates.passwordResetSuccess.subject);
      expect(args[1]).to.equal(recipientEmail);
    });
  });

  describe('sendSupportEmail', () => {
    it('is a function', () => {
      expect(EmailUtility.EmailUtility.prototype.sendSupportEmail).to.be.a('function');
    });

    it('calls the sendEmail method with the correct arguments', () => {
      sendEmailStub = sinon.stub(emailUtility, 'sendEmail', () => Promise.resolve());
      const userEmail = 'test+sendSupportEmail@gobackbone.com';
      const message = 'Hello there';

      emailUtility.sendSupportEmail(userEmail, message);

      const spyCall = sendEmailStub.getCall(0);
      const args = spyCall.args;

      expect(sendEmailStub.callCount).to.equal(1);
      expect(args[0]).to.be.an('object');
      expect(args[0].subject).to.equal(EmailUtility.templates.supportTicket.subject);
      expect(args[0].from).to.equal(userEmail);
      expect(args[0].text).to.equal(message);
      expect(args[1]).to.equal('support@gobackbone.com');
    });
  });
});
