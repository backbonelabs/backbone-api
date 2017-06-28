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

let emailUtility;
let app;
let db;
let unconfirmedUserFixture;
let confirmedUserFixture;
let validTokenUserFixture;
let invalidTokenUserFixture;
let accessTokenFixture;
let fbExistingUserFixture;
let fbUnconfirmedEmailFixture;
let fbConfirmedEmailFixture;
let validFBAccessToken;
let validFBUserId;

const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
const testEmail3 = `test.${randomString()}@${randomString()}.com`;
const testEmail4 = `test.${randomString()}@${randomString()}.com`;
const testEmail5 = `test.${randomString()}@${randomString()}.com`;
const testEmail6 = `test.${randomString()}@${randomString()}.com`;
const testEmail7 = `test.${randomString()}@${randomString()}.com`;
const testEmail8 = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const accessTokensToDelete = [];
const validFBAppId = process.env.FB_APP_ID;
const fbNoEmailFixture = {};

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
            isConfirmed: false,
            authMethod: constants.authMethods.EMAIL,
          }, {
            email: testEmail6,
            isConfirmed: true,
            authMethod: constants.authMethods.EMAIL,
          }, {
            email: testEmail7,
            authMethod: constants.authMethods.FACEBOOK,
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
    fbUnconfirmedEmailFixture = ops[4];
    fbConfirmedEmailFixture = ops[5];
    fbExistingUserFixture = ops[6];
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
    // gets a valid Facebook access token from a test user
    const options = {
      method: 'GET',
      uri: `https://graph.facebook.com/${validFBAppId}/accounts/test-users/`,
      qs: {
        fields: 'access_token',
        access_token: `${validFBAppId}|${process.env.FB_APP_SECRET}`,
      },
      json: true,
    };

    return requestPromise(options);
  })
  .then((body) => {
    // testUser1 is for adding facebook to existing email/password accounts
    // testUser2 is for new accounts from facebook logins
    // testUser3 is for facebook accounts without an email address
    validFBUserId = {
      testUser1: body.data[0].id,
      testUser2: body.data[1].id,
      testUser3: body.data[2].id,
    };
    validFBAccessToken = {
      testUser1: body.data[0].access_token,
      testUser2: body.data[1].access_token,
      testUser3: body.data[2].access_token,
    };
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
          mongodb.ObjectID(fbConfirmedEmailFixture._id),
          mongodb.ObjectID(fbUnconfirmedEmailFixture._id),
          mongodb.ObjectID(fbExistingUserFixture._id),
          mongodb.ObjectID(fbNoEmailFixture._id),
        ],
      },
    }),
  )
  .then(() => db.collection('users')
    .deleteMany({ email: { $in: [testEmail8] },
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

  describe('POST /facebook', () => {
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

    // Email confirmation checks for existing users with email and password
    it('should reject Facebook login when existing email is not confirmed', () => assertRequestStatusCode(403, {
      email: testEmail5,
      accessToken: validFBAccessToken.testUser1,
      applicationID: validFBAppId,
      id: validFBUserId.testUser1,
      verified: true,
    }));

    it('should allow Facebook login when existing email is confirmed', (done) => {
      request(app)
        .post(url)
        .send({
          email: testEmail6,
          accessToken: validFBAccessToken.testUser1,
          applicationID: validFBAppId,
          id: validFBUserId.testUser1,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'facebookId',
            'authMethod']);
          expect(res.body).to.not.contain.any.keys('password', 'isNew');
          expect(res.body.authMethod).to.equal(1);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    // Facebook access token checks
    it('should reject when FB accessToken is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail7,
      applicationID: validFBAppId,
      id: validFBUserId.testUser1,
      verified: true,
    }));

    it('should reject when FB accessToken is not a token', () => assertRequestStatusCode(400, {
      email: testEmail7,
      accessToken: '@123a1aaf',
      applicationID: validFBAppId,
      id: validFBUserId.testUser1,
      verified: true,
    }));

    it('should reject an invalid FB accessToken', () => assertRequestStatusCode(401, {
      email: testEmail7,
      accessToken: '1badAccessToken',
      applicationID: validFBAppId,
      id: validFBUserId.testUser1,
      verified: true,
    }));

    // Application ID checks
    it('should reject when applicationID is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      id: validFBUserId.testUser1,
      verified: true,
    }));

    it('should reject an applicationID that contains letters', () => assertRequestStatusCode(400, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: '1a2b345678',
      id: validFBUserId.testUser1,
      verified: true,
    }));

    it('should reject an invalid applicationID', () => assertRequestStatusCode(401, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: '12345678',
      id: validFBUserId.testUser1,
      verified: true,
    }));

    // User ID checks
    it('should reject when id is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: validFBAppId,
      verified: true,
    }));

    it('should reject an id that contains letters', () => assertRequestStatusCode(400, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: validFBAppId,
      id: '1invalid',
      verified: true,
    }));

    it('should reject an invalid id', () => assertRequestStatusCode(401, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: validFBAppId,
      id: '111111',
      verified: true,
    }));

    // Facebook account verified checks
    it('should reject when verified is not in request body', () => assertRequestStatusCode(400, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: validFBAppId,
      id: validFBUserId.testUser1,
    }));

    it('should reject when Facebook user is not verified', () => assertRequestStatusCode(403, {
      email: testEmail7,
      accessToken: validFBAccessToken.testUser1,
      applicationID: validFBAppId,
      id: validFBUserId.testUser1,
      verified: false,
    }));

    // Email/accessToken/applicationID/userID combination check
    it('should create new user when Facebook login has email', (done) => {
      request(app)
        .post(url)
        .send({
          email: testEmail8,
          accessToken: validFBAccessToken.testUser2,
          applicationID: validFBAppId,
          id: validFBUserId.testUser2,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'authMethod',
            'facebookId',
            'isNew',
            'isConfirmed']);
          expect(res.body.authMethod).to.equal(2);
          expect(res.body.isConfirmed).to.be.true;
          expect(res.body.isNew).to.be.true;
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

    it('should create new user when Facebook login has no email', (done) => {
      request(app)
        .post(url)
        .send({
          accessToken: validFBAccessToken.testUser3,
          applicationID: validFBAppId,
          id: validFBUserId.testUser3,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys([
            '_id',
            'accessToken',
            'authMethod',
            'facebookId',
            'isNew',
            'email',
            'isConfirmed']);
          expect(res.body.authMethod).to.equal(2);
          expect(res.body.email).to.be.null;
          expect(res.body.isConfirmed).to.be.true;
          expect(res.body.isNew).to.be.true;
          expect(res.body).to.not.contain.all.keys(['password']);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            fbNoEmailFixture._id = res.body._id;
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should allow FB login to existing Facebook users with email', (done) => {
      request(app)
        .post(url)
        .send({
          email: testEmail8,
          accessToken: validFBAccessToken.testUser2,
          applicationID: validFBAppId,
          id: validFBUserId.testUser2,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'authMethod',
            'facebookId',
            'isConfirmed']);
          expect(res.body.authMethod).to.equal(2);
          expect(res.body.isConfirmed).to.be.true;
          expect(res.body).to.not.contain.any.keys(['password', 'isNew']);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should allow FB login to existing Facebook users without email', (done) => {
      request(app)
        .post(url)
        .send({
          accessToken: validFBAccessToken.testUser3,
          applicationID: validFBAppId,
          id: validFBUserId.testUser3,
          verified: true,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.contain.all.keys([
            '_id',
            'email',
            'accessToken',
            'authMethod',
            'facebookId',
            'isConfirmed']);
          expect(res.body.authMethod).to.equal(2);
          expect(res.body.isConfirmed).to.be.true;
          expect(res.body).to.not.contain.any.keys(['password', 'isNew']);
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
