import { expect } from 'chai';
import requestPromise from 'request-promise';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import sinon from 'sinon';
import server from '../../index';
import tokenFactory from '../../lib/tokenFactory';
import EmailUtility from '../../lib/EmailUtility';

let emailUtility;
let app;
let db;
let unconfirmedUserFixture;
let confirmedUserFixture;
let validTokenUserFixture;
let invalidTokenUserFixture;
let accessTokenFixture;
let validFBAccessToken;

const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
const testEmail3 = `test.${randomString()}@${randomString()}.com`;
const testEmail4 = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const accessTokensToDelete = [];
const validFBAppID = process.env.FB_APP_ID;

before(() => Promise.resolve(server)
  .then((expressApp) => {
    app = expressApp;
  })
  .then(() => MongoClient.connect(process.env.BL_DATABASE_URL))
  .then((mDb) => {
    db = mDb;
  })
  .then(() => (
    tokenFactory.generateToken()
      .then(([token, tokenExpiry]) => {
        const expiredToken = randomString({ length: 40 });
        const expiredTokenExpiry = new Date();
        expiredTokenExpiry.setDate(expiredTokenExpiry.getDate() - 1);

        return db.collection('users')
          .insertMany([{
            email: testEmail1,
            password: testPasswordHash,
          }, {
            email: testEmail2,
            password: testPasswordHash,
            isConfirmed: true,
          }, {
            email: testEmail3,
            password: testPasswordHash,
            isConfirmed: false,
            passwordResetToken: token,
            passwordResetTokenExpiry: tokenExpiry,
            confirmationToken: token,
            confirmationTokenExpiry: tokenExpiry,
          }, {
            email: testEmail4,
            password: testPasswordHash,
            isConfirmed: false,
            passwordResetToken: expiredToken,
            passwordResetTokenExpiry: expiredTokenExpiry,
            confirmationToken: expiredToken,
            confirmationTokenExpiry: expiredTokenExpiry,
          }]);
      })
  ))
  .then((results) => {
    const { ops } = results;

    // QUESTION: Do we need this? Tests pass
    // const ops = results.ops.map(op => ({
    //   ...op,
    //   _id: op._id.toHexString(),
    // }));
    unconfirmedUserFixture = ops[0];
    confirmedUserFixture = ops[1];
    validTokenUserFixture = ops[2];
    invalidTokenUserFixture = ops[3];
  })
  .then(() => db.collection('accessTokens')
    .insertOne({
      userId: mongodb.ObjectID(confirmedUserFixture._id),
      accessToken: randomString({ length: 64 }),
    }),
  )
  .then((results) => {
    accessTokenFixture = results.ops[0];
    accessTokenFixture.userId = accessTokenFixture.userId.toHexString();
    accessTokensToDelete.push(accessTokenFixture.accessToken);
  })
  .then(() => {
    // get a valid Facebook access token from a test user
    const options = {
      method: 'GET',
      uri: `https://graph.facebook.com/${validFBAppID}/accounts/test-users/`,
      qs: {
        fields: 'access_token',
        access_token: `${validFBAppID}|${process.env.FB_APP_SECRET}`,
      },
      json: true,
    };

    return requestPromise(options);
  })
  .then((body) => {
    validFBAccessToken = body.data[0].access_token;
  }),
);

after(() => db.collection('accessTokens')
  .deleteMany({ accessToken: { $in: accessTokensToDelete } })
    .then(() => db.collection('users')
      .deleteMany({
        _id: {
          $in: [
            mongodb.ObjectID(unconfirmedUserFixture._id),
            mongodb.ObjectID(confirmedUserFixture._id),
            mongodb.ObjectID(validTokenUserFixture._id),
            mongodb.ObjectID(invalidTokenUserFixture._id),
          ],
        },
      }),
  ),
);

describe('/auth router', () => {
  describe('POST /login', () => {
    const url = '/auth/login';
    const assertRequestStatusCode = (statusCode, body) => new Promise((resolve, reject) => {
      request(app)
        .post(url)
        .send(body)
        .expect(statusCode)
        .end((err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
    });

    it('should reject when email is not in request body', () => assertRequestStatusCode(400, {
      password: testPassword,
    }));

    it('should reject when password is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail1,
    }));

    it('should reject when email, password, and access token are not in request body', () => (
      assertRequestStatusCode(400, {})
    ));

    it('should reject invalid email formats', () => {
      const password = { password: testPassword };
      const simpleWord = 'email';
      const noAtSymbol = 'bb.com';
      const noLocal = '@b.com';
      const noDomain = 'b@';

      return Promise.all([
        assertRequestStatusCode(400, Object.assign({ email: simpleWord }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noAtSymbol }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noLocal }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noDomain }, password)),
      ]);
    });

    it('should reject an invalid email/password combination', () => assertRequestStatusCode(401, {
      email: testEmail1,
      password: `${testPassword}1`,
    }));

    it('should return user profile and access token on valid email/password combination', (done) => {
      request(app)
        .post(url)
        .send({
          email: confirmedUserFixture.email,
          password: testPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys(['_id', 'email', 'accessToken']);
          expect(res.body).to.not.contain.all.keys(['password']);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });
  });

  describe('POST /facebookLogin', () => {
    const url = '/auth/facebookLogin';
    const assertRequestStatusCode = (statusCode, body) => new Promise((resolve, reject) => {
      request(app)
        .post(url)
        .send(body)
        .expect(statusCode)
        .end((err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
    });

    // Email checks
    it('should reject when email is not in request body', () => assertRequestStatusCode(400, {
      applicationID: validFBAppID,
      accessToken: validFBAccessToken,
    }));

    it('should reject invalid email formats', () => {
      const restOfbody = {
        accessToken: validFBAccessToken,
        applicationID: validFBAppID,
      };
      const simpleWord = 'email';
      const noAtSymbol = 'bb.com';
      const noLocal = '@b.com';
      const noDomain = 'b@';

      return Promise.all([
        assertRequestStatusCode(400, Object.assign({ email: simpleWord }, restOfbody)),
        assertRequestStatusCode(400, Object.assign({ email: noAtSymbol }, restOfbody)),
        assertRequestStatusCode(400, Object.assign({ email: noLocal }, restOfbody)),
        assertRequestStatusCode(400, Object.assign({ email: noDomain }, restOfbody)),
      ]);
    });

    // access token checks
    it('should reject when accessToken is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail1,
      applicationID: validFBAppID,
    }));

    it('should reject when accessToken is not a token', () => assertRequestStatusCode(400, {
      email: testEmail1,
      accessToken: '@123a1aaf',
      applicationID: validFBAppID,
    }));

    it('should reject an invalid accessToken', () => assertRequestStatusCode(401, {
      email: testEmail1,
      applicationID: validFBAppID,
      accessToken: '1badAccessToken',
    }));

    // application ID checks
    it('should reject when applicationID is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail1,
      accessToken: validFBAccessToken,
    }));

    it('should reject an applicationID that contains letters', () => assertRequestStatusCode(400, {
      email: testEmail1,
      accessToken: validFBAccessToken,
      applicationID: '1a2b345678',
    }));

    it('should reject an invalid applicationID', () => assertRequestStatusCode(401, {
      email: testEmail1,
      accessToken: validFBAccessToken,
      applicationID: '12345678',
    }));

    it('should return user profile and access token on valid' +
       'email/accessToken/applicationID combination', (done) => {
      request(app)
        .post(url)
        .send({
          email: confirmedUserFixture.email,
          accessToken: validFBAccessToken,
          applicationID: validFBAppID,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys(['_id', 'email', 'accessToken']);
          expect(res.body).to.not.contain.all.keys(['password']);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });
  });

  describe('POST /logout', () => {
    const url = '/auth/logout';

    it('should require authorization header', (done) => {
      request(app)
        .post(url)
        .expect(401)
        .end(done);
    });

    it('should require bearer authorization scheme', (done) => {
      request(app)
        .post(url)
        .set('Authorization', `Basic ${accessTokensToDelete[1]}`)
        .expect(401)
        .end(done);
    });

    // TODO: Create tests for making sure user isConfirmed, to have accessToken to delete
    // it('should delete an access token', done => {
    //   request(app)
    //     .post(url)
    //     .set('Authorization', `Bearer ${accessTokensToDelete[1]}`)
    //     .expect(200)
    //     .end(requestErr => {
    //       db.collection('accessTokens')
    //         .find({ accessToken: accessTokensToDelete[1] })
    //         .limit(1)
    //         .next((dbErr, accessToken) => {
    //           expect(accessToken).to.be.null;
    //           done(requestErr || dbErr, accessToken);
    //         });
    //     });
    // });
  });

  describe('POST /password-reset-token', () => {
    let sendPasswordResetEmailStub;

    beforeEach(() => {
      emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
      });
      sendPasswordResetEmailStub = sinon
        .stub(emailUtility, 'sendPasswordResetEmail', () => Promise.resolve());
    });

    const url = '/auth/password-reset-token';
    const assertRequestStatusCode = (statusCode, body) => new Promise(
      (resolve, reject) => {
        request(app)
          .post(url)
          .send(body)
          .expect(statusCode)
          .expect(() => {
            if (statusCode >= 400) {
              expect(sendPasswordResetEmailStub.callCount).to.equal(0);
            }
          })
          .end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
      });

    it('should reject when email is not in request body', () => assertRequestStatusCode(400, {}));

    it('should reject invalid email formats', () => {
      const simpleWord = 'email';
      const noAtSymbol = 'bb.com';
      const noLocal = '@b.com';
      const noDomain = 'b@';

      return Promise.all([
        assertRequestStatusCode(400, { email: simpleWord }),
        assertRequestStatusCode(400, { email: noAtSymbol }),
        assertRequestStatusCode(400, { email: noLocal }),
        assertRequestStatusCode(400, { email: noDomain }),
      ]);
    });

    it('should send a password reset email', () => (
      assertRequestStatusCode(200, { email: confirmedUserFixture.email })
        .then(() => {
          expect(sendPasswordResetEmailStub.callCount).to.equal(1);
          expect(sendPasswordResetEmailStub.calledWith(confirmedUserFixture.email)).to.be.true;
        })
    ));
  });

  describe('GET /confirm/email', () => {
    const url = '/auth/confirm/email?token=';

    const assertRequestStatusCode = (statusCode, token) => new Promise((resolve, reject) => (
        request(app)
          .get(`${url}${token}`)
          .send({})
          .expect(statusCode)
          .end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          })
      ));

    it('should reject when token is not in request query', () => (
      assertRequestStatusCode(400, '')
    ));

    it('should reject when token is incorrect', () => (
      assertRequestStatusCode(400, `${validTokenUserFixture.confirmationToken}123`)
    ));

    it('should reject when token is expired', () => (
      assertRequestStatusCode(400, invalidTokenUserFixture.confirmationToken)
    ));

    it('should confirm email on valid and nonexpired token and set isConfirmed to true', () => (
      assertRequestStatusCode(200, validTokenUserFixture.confirmationToken)
        .then(() => (
          db.collection('users')
            .findOne({ email: validTokenUserFixture.email })
            .then(result => expect(result.isConfirmed).to.be.true)
        ))
    ));
  });

  describe('POST /password-reset', () => {
    let sendPasswordResetSuccessEmailStub;

    beforeEach(() => {
      emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
      });
      sendPasswordResetSuccessEmailStub = sinon
        .stub(emailUtility, 'sendPasswordResetSuccessEmail', () => Promise.resolve());
    });

    const url = '/auth/password-reset';
    const randomPassword = randomString({ length: 10 });
    const invalidPassword = 'abc';

    const assertRequestStatusCode = (statusCode, data = {}) => new Promise((resolve, reject) => (
        request(app)
          .post(`${url}`)
          .send(data)
          .expect(statusCode)
          .expect(() => {
            if (statusCode >= 400) {
              expect(sendPasswordResetSuccessEmailStub.callCount).to.equal(0);
            }
          })
          .end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          })
      ));

    it('should reject when token is not in request body', () => (
      assertRequestStatusCode(400, {
        password: randomPassword,
        verifyPassword: randomPassword,
      })
    ));

    it('should reject when token is incorrect', () => (
      assertRequestStatusCode(400, {
        token: `${validTokenUserFixture.passwordResetToken}123`,
        password: randomPassword,
        verifyPassword: randomPassword,
      })
    ));

    it('should reject when token is expired', () => (
      assertRequestStatusCode(400, {
        token: invalidTokenUserFixture.passwordResetToken,
        password: randomPassword,
        verifyPassword: randomPassword,
      })
    ));

    it('should reject when passwords are not valid formats', () => (
      assertRequestStatusCode(400, {
        token: validTokenUserFixture.passwordResetToken,
        password: invalidPassword,
        verifyPassword: randomPassword,
      })
        .then(() => (
          assertRequestStatusCode(400, {
            token: validTokenUserFixture.passwordResetToken,
            password: randomPassword,
            verifyPassword: invalidPassword,
          })
        ))
    ));

    it('should reject when passwords do not match', () => (
      assertRequestStatusCode(400, {
        token: validTokenUserFixture.passwordResetToken,
        password: randomPassword,
        verifyPassword: `${randomPassword}1`,
      })
    ));

    it('should allow reset on valid and nonexpired token', () => (
      assertRequestStatusCode(200, {
        token: validTokenUserFixture.passwordResetToken,
        password: randomPassword,
        verifyPassword: randomPassword,
      })
        .then(() => {
          expect(sendPasswordResetSuccessEmailStub.callCount).to.equal(1);
          expect(sendPasswordResetSuccessEmailStub
            .calledWith(validTokenUserFixture.email)).to.be.true;
        })
    ));

    it('should reject when trying to reset with a previously used token', () => (
      assertRequestStatusCode(400, {
        token: validTokenUserFixture.passwordResetToken,
        password: randomPassword,
        verifyPassword: randomPassword,
      })
    ));
  });
});
