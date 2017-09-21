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
import constants from '../../lib/constants';
import { errors as fbErrors } from '../../routes/auth/facebook';

let emailUtility;
let sendConfirmationEmailStub;
let sendPasswordResetEmailStub;
let sendPasswordResetSuccessEmailStub;
let app;
let db;
let emailUnconfirmedUserFixture;
let emailConfirmedUserFixture1;
let validTokenUserFixture;
let invalidTokenUserFixture;
let accessTokenFixture;
let fbUserFixture;
let emailConfirmedUserFixture2;
let emailConfirmedWithFbUserFixture;
let unconfirmedWithFbUserFixture;
let fbTestUsers;
let newFbUser;

const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
const testEmail3 = `test.${randomString()}@${randomString()}.com`;
const testEmail4 = `test.${randomString()}@${randomString()}.com`;
const testEmail5 = `test.${randomString()}@${randomString()}.com`;
const testEmail6 = `test.${randomString()}@${randomString()}.com`;
const testEmail7 = `test.${randomString()}@${randomString()}.com`;
const testEmail8 = `test.${randomString()}@${randomString()}.com`;
const testEmail9 = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const userObjectIdsToDelete = [];
const accessTokensToDelete = [];
const validFBAppId = process.env.FB_APP_ID;

describe('/auth router', function describeAuth() {
  const mochaContext = this;

  before(() => {
    mochaContext.timeout(15000);
    return (
      Promise.resolve(server)
        .then((expressApp) => {
          app = expressApp;
        })
        .then(() => MongoClient.connect(process.env.BL_DATABASE_URL))
        .then((mDb) => {
          db = mDb;
        })
        .then(() => {
          emailUtility = EmailUtility.init({
            apiKey: process.env.BL_MAILGUN_API,
            domain: process.env.BL_MAILGUN_DOMAIN,
            silentEmail: true,
          });
          sendConfirmationEmailStub = sinon
            .stub(emailUtility, 'sendConfirmationEmail', () => Promise.resolve());
          sendPasswordResetEmailStub = sinon
            .stub(emailUtility, 'sendPasswordResetEmail', () => Promise.resolve());
          sendPasswordResetSuccessEmailStub = sinon
            .stub(emailUtility, 'sendPasswordResetSuccessEmail', () => Promise.resolve());
        })
        .then(() => {
          // Retrieve Facebook test users
          const options = {
            method: 'GET',
            uri: `https://graph.facebook.com/v2.10/${validFBAppId}/accounts/test-users/`,
            qs: {
              fields: 'access_token',
              access_token: `${validFBAppId}|${process.env.FB_APP_SECRET}`,
            },
            json: true,
          };

          return requestPromise(options);
        })
        .then((body) => {
          // At least 5 test users must exist at developers.facebook.com.
          fbTestUsers = body.data;
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
                  isConfirmed: false,
                  authMethod: constants.authMethods.EMAIL,
                }, {
                  email: testEmail2,
                  password: testPasswordHash,
                  authMethod: constants.authMethods.EMAIL,
                  isConfirmed: true,
                }, {
                  email: testEmail3,
                  password: testPasswordHash,
                  authMethod: constants.authMethods.EMAIL,
                  isConfirmed: false,
                  passwordResetToken: token,
                  passwordResetTokenExpiry: tokenExpiry,
                  confirmationToken: token,
                  confirmationTokenExpiry: tokenExpiry,
                }, {
                  email: testEmail4,
                  password: testPasswordHash,
                  authMethod: constants.authMethods.EMAIL,
                  isConfirmed: false,
                  passwordResetToken: expiredToken,
                  passwordResetTokenExpiry: expiredTokenExpiry,
                  confirmationToken: expiredToken,
                  confirmationTokenExpiry: expiredTokenExpiry,
                }, {
                  email: testEmail5,
                  isConfirmed: true,
                  authMethod: constants.authMethods.EMAIL,
                }, {
                  email: testEmail6,
                  isConfirmed: true,
                  authMethod: constants.authMethods.FACEBOOK,
                  facebookId: fbTestUsers[0].id,
                }, {
                  email: testEmail7,
                  isConfirmed: true,
                  authMethod: constants.authMethods.EMAIL,
                  facebookId: fbTestUsers[1].id,
                }, {
                  email: testEmail8,
                  isConfirmed: false,
                  authMethod: constants.authMethods.EMAIL,
                  facebookId: fbTestUsers[2].id,
                }]);
            })
        ))
        .then((results) => {
          const { ops } = results;
          emailUnconfirmedUserFixture = ops[0];
          emailConfirmedUserFixture1 = ops[1];
          validTokenUserFixture = ops[2];
          invalidTokenUserFixture = ops[3];
          emailConfirmedUserFixture2 = ops[4];
          fbUserFixture = ops[5];
          emailConfirmedWithFbUserFixture = ops[6];
          unconfirmedWithFbUserFixture = ops[7];

          ops.forEach(doc => userObjectIdsToDelete.push(doc._id));
        })
        .then(() => db.collection('accessTokens')
          .insertOne({
            userId: emailConfirmedUserFixture1._id,
            accessToken: randomString({ length: 64 }),
          }),
        )
        .then((results) => {
          accessTokenFixture = results.ops[0];
          accessTokenFixture.userId = accessTokenFixture.userId.toHexString();
          accessTokensToDelete.push(accessTokenFixture.accessToken);
        })
    );
  });

  beforeEach(() => {
    sendConfirmationEmailStub.reset();
    sendPasswordResetEmailStub.reset();
    sendPasswordResetSuccessEmailStub.reset();
  });

  after(() => (
    db.collection('accessTokens')
      .deleteMany({ accessToken: { $in: accessTokensToDelete } })
      .then(() => (
        db.collection('users')
          .deleteMany({
            _id: { $in: userObjectIdsToDelete },
          })
      ))
  ));

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
      const noTld = 'a@b';

      return Promise.all([
        assertRequestStatusCode(400, Object.assign({ email: simpleWord }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noAtSymbol }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noLocal }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noDomain }, password)),
        assertRequestStatusCode(400, Object.assign({ email: noTld }, password)),
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
          email: emailConfirmedUserFixture1.email,
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

  describe('POST /facebook', () => {
    // For Facebook tests, increase timeout because Facebook Graph API can sometimes
    // take a while to respond
    mochaContext.timeout(15000);
    const url = '/auth/facebook';
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

    // Facebook access token checks
    it('should reject when FB accessToken is not in request body', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        applicationID: validFBAppId,
        id: fbTestUsers[3].id,
        verified: true,
      })
    ));

    it('should reject when FB accessToken is not a valid token format', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        accessToken: '@123a1aaf',
        applicationID: validFBAppId,
        id: fbTestUsers[3].id,
        verified: true,
      })
    ));

    it('should reject an invalid FB accessToken', () => (
      assertRequestStatusCode(401, {
        email: testEmail9,
        accessToken: '1badAccessToken',
        applicationID: validFBAppId,
        id: fbTestUsers[3].id,
        verified: true,
      })
    ));

    // Application ID checks
    it('should reject when applicationID is not in request body', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        id: fbTestUsers[3].id,
        verified: true,
      })
    ));

    it('should reject an applicationID that contains letters', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: '1a2b345678',
        id: fbTestUsers[3].id,
        verified: true,
      })
    ));

    it('should reject an invalid applicationID', () => (
      assertRequestStatusCode(fbErrors.invalidCredentials.code, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: '12345678',
        id: fbTestUsers[3].id,
        verified: true,
      })
    ));

    // User ID checks
    it('should reject when id is not in request body', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: validFBAppId,
        verified: true,
      })
    ));

    it('should reject an id that contains letters', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: validFBAppId,
        id: '1invalid',
        verified: true,
      })
    ));

    it('should reject an invalid id', () => (
      assertRequestStatusCode(fbErrors.invalidCredentials.code, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: validFBAppId,
        id: '111111',
        verified: true,
      })
    ));

    // Facebook account verified checks
    it('should reject when verified is not in request body', () => (
      assertRequestStatusCode(400, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: validFBAppId,
        id: fbTestUsers[3].id,
      })
    ));

    it('should reject when Facebook user is not verified', () => (
      assertRequestStatusCode(fbErrors.unverifiedFacebook.code, {
        email: testEmail9,
        accessToken: fbTestUsers[3].access_token,
        applicationID: validFBAppId,
        id: fbTestUsers[3].id,
        verified: false,
      })
    ));

    // Tests for various scenarios with valid FB info
    it('should reject when matching existing user with unconfirmed email', () => (
      assertRequestStatusCode(fbErrors.unconfirmedEmail.code, {
        email: emailUnconfirmedUserFixture.email,
        accessToken: fbTestUsers[3].access_token,
        applicationID: validFBAppId,
        id: fbTestUsers[3].id,
        verified: true,
      })
        .then(() => {
          expect(sendConfirmationEmailStub.callCount).to.equal(1);
        })
    ));

    it('should update existing user to be confirmed on matching Facebook ID', (done) => {
      expect(unconfirmedWithFbUserFixture.isConfirmed).to.be.false;
      request(app)
        .post(url)
        .send({
          email: unconfirmedWithFbUserFixture.email,
          accessToken: fbTestUsers[2].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[2].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'facebookId',
            'authMethod',
            'isConfirmed',
          ]);
          expect(body).to.not.contain.any.keys(['password', 'isNew']);
          expect(body._id).to.equal(unconfirmedWithFbUserFixture._id.toHexString());
          expect(body.accessToken.length).to.equal(64);
          expect(body.authMethod).to.equal(unconfirmedWithFbUserFixture.authMethod);
          expect(body.facebookId).to.equal(fbTestUsers[2].id);
          expect(body.isConfirmed).to.be.true;
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should add Facebook account to existing confirmed email user', (done) => {
      request(app)
        .post(url)
        .send({
          email: emailConfirmedUserFixture2.email,
          accessToken: fbTestUsers[3].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[3].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'facebookId',
            'authMethod',
          ]);
          expect(body).to.not.contain.any.keys(['password', 'isNew']);
          expect(body._id).to.equal(emailConfirmedUserFixture2._id.toHexString());
          expect(body.accessToken.length).to.equal(64);
          expect(body.authMethod).to.equal(emailConfirmedUserFixture2.authMethod);
          expect(body.facebookId).to.equal(fbTestUsers[3].id);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should create new user with email', (done) => {
      request(app)
        .post(url)
        .send({
          email: testEmail9,
          accessToken: fbTestUsers[4].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[4].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'authMethod',
            'facebookId',
            'isNew',
            'isConfirmed',
            'trainingPlans',
            'trainingPlanProgress',
          ]);
          expect(body).to.not.contain.any.keys('password');
          expect(body.email).to.equal(testEmail9);
          expect(body.facebookId).to.equal(fbTestUsers[4].id);
          expect(body.authMethod).to.equal(constants.authMethods.FACEBOOK);
          expect(body.isConfirmed).to.be.true;
          expect(body.isNew).to.be.true;
          expect(body.accessToken.length).to.equal(64);
          expect(body.trainingPlans).to.be.a('array');
          expect(body.trainingPlanProgress).to.be.a('object');
        })
        .end((err, res) => {
          if (!err) {
            newFbUser = res.body;
            userObjectIdsToDelete.push(mongodb.ObjectID(res.body._id));
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should return newly created user from previous test', (done) => {
      request(app)
        .post(url)
        .send({
          accessToken: fbTestUsers[4].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[4].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'accessToken',
            'facebookId',
            'isConfirmed',
          ]);
          expect(body).to.not.contain.any.keys(['password', 'isNew']);
          expect(body._id).to.equal(newFbUser._id);
          expect(body.accessToken.length).to.equal(64);
          expect(body.facebookId).to.equal(newFbUser.facebookId);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should return existing Facebook auth method user with the same Facebook ID', (done) => {
      request(app)
        .post(url)
        .send({
          accessToken: fbTestUsers[0].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[0].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'accessToken',
            'facebookId',
            'isConfirmed',
          ]);
          expect(body).to.not.contain.any.keys(['password', 'isNew']);
          expect(body._id).to.equal(fbUserFixture._id.toHexString());
          expect(body.accessToken.length).to.equal(64);
          expect(body.facebookId).to.equal(fbUserFixture.facebookId);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should return existing email auth method user with the same Facebook ID', (done) => {
      request(app)
        .post(url)
        .send({
          accessToken: fbTestUsers[1].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[1].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'accessToken',
            'facebookId',
            'isConfirmed',
          ]);
          expect(body).to.not.contain.any.keys(['password', 'isNew']);
          expect(body._id).to.equal(emailConfirmedWithFbUserFixture._id.toHexString());
          expect(body.accessToken.length).to.equal(64);
          expect(body.facebookId).to.equal(emailConfirmedWithFbUserFixture.facebookId);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should create new user with no email', (done) => {
      request(app)
        .post(url)
        .send({
          accessToken: fbTestUsers[5].access_token,
          applicationID: validFBAppId,
          id: fbTestUsers[5].id,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body).to.contain.all.keys([
            '_id',
            'accessToken',
            'authMethod',
            'facebookId',
            'isNew',
            'email',
            'isConfirmed',
            'trainingPlans',
            'trainingPlanProgress',
          ]);
          expect(body).to.not.contain.any.keys('password');
          expect(body.email).to.be.null;
          expect(body.facebookId).to.equal(fbTestUsers[5].id);
          expect(body.authMethod).to.equal(constants.authMethods.FACEBOOK);
          expect(body.isConfirmed).to.be.true;
          expect(body.isNew).to.be.true;
          expect(body.accessToken.length).to.equal(64);
          expect(body.trainingPlans).to.be.a('array');
          expect(body.trainingPlanProgress).to.be.a('object');
        })
        .end((err, res) => {
          if (!err) {
            userObjectIdsToDelete.push(mongodb.ObjectID(res.body._id));
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
      assertRequestStatusCode(200, { email: emailConfirmedUserFixture1.email })
        .then(() => {
          expect(sendPasswordResetEmailStub.callCount).to.equal(1);
          expect(sendPasswordResetEmailStub
            .calledWith(emailConfirmedUserFixture1.email)).to.be.true;
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
