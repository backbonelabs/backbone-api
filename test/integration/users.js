import { expect } from 'chai';
import request from 'supertest';
import requestPromise from 'request-promise';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import sinon from 'sinon';
import server from '../../index';
import userDefaults from '../../lib/userDefaults';
import constants from '../../lib/constants';
import EmailUtility from '../../lib/EmailUtility';
import tokenFactory from '../../lib/tokenFactory';
import { getWorkouts } from '../../lib/trainingPlans';
import { errors } from '../../routes/users/updateUser';

let emailUtility;
let app;
let db;
let fbUserFixture1 = {};
let fbUserFixture2 = {};
let userFixture1 = {};
let userFixture2 = {};
let userFixture3 = {};
let userFixture4 = {};
let defaultTrainingPlans = [];
let fbTestUsers = [];

const { mergeWithDefaultData } = userDefaults;
const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
const testEmail3 = `test.${randomString()}@${randomString()}.com`;
const testEmail4 = `test.${randomString()}@${randomString()}.com`;
const testEmail5 = `test.${randomString()}@${randomString()}.com`;
const testEmail6 = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const testAccessToken1 = randomString({ length: 64 });
const testAccessToken2 = randomString({ length: 64 });
const testAccessToken3 = randomString({ length: 64 });
const testAccessToken4 = randomString({ length: 64 });
const testAccessToken5 = randomString({ length: 64 });
const testAccessToken6 = randomString({ length: 64 });
const userIdsToDelete = [];
const accessTokensToDelete = [
  testAccessToken1,
  testAccessToken2,
  testAccessToken3,
  testAccessToken4,
  testAccessToken5,
  testAccessToken6,
];
const testWorkoutName1 = randomString();
const testWorkoutName2 = randomString();
const testWorkouts = [{
  title: testWorkoutName1,
}, {
  title: testWorkoutName2,
}];
const fbAppId = process.env.FB_APP_ID;

describe('/users router', function describeUsers() {
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
        .then(() => (
          // Insert test workouts
          db.collection('workouts')
            .insertMany(testWorkouts)
        ))
        .then(() => {
          const defaultTrainingPlanNames = process.env.BL_DEFAULT_TRAINING_PLAN_NAMES.split(/,\s*/);

          return db.collection('trainingPlans')
            .find({ name: { $in: defaultTrainingPlanNames } })
            .toArray()
            .then((trainingPlans) => {
              defaultTrainingPlans = trainingPlans;
            });
        })
        .then(() => {
          // Retrieve Facebook test users
          const options = {
            method: 'GET',
            uri: `https://graph.facebook.com/v2.10/${process.env.FB_APP_ID}/accounts/test-users/`,
            qs: {
              fields: 'access_token',
              access_token: `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`,
            },
            json: true,
          };

          return requestPromise(options)
            .then((body) => {
              fbTestUsers = body.data;
            });
        })
        .then(() => (
          db.collection('users')
          .insertMany([
            mergeWithDefaultData({
              email: testEmail1,
              password: testPasswordHash,
            }),
            mergeWithDefaultData({
              email: testEmail2,
              password: testPasswordHash,
            }),
            mergeWithDefaultData({
              email: testEmail3,
              password: testPasswordHash,
              isConfirmed: true,
            }),
            mergeWithDefaultData({
              email: testEmail4,
              password: testPasswordHash,
            }),
            mergeWithDefaultData({
              email: testEmail5,
              isConfirmed: true,
              authMethod: constants.authMethods.FACEBOOK,
              facebookId: fbTestUsers[0].id,
            }),
            mergeWithDefaultData({
              email: null,
              authMethod: constants.authMethods.FACEBOOK,
            }),
          ])
        ))
        .then((results) => {
          const { ops } = results;
          userFixture1 = ops[0];
          userFixture2 = ops[1];
          userFixture3 = ops[2];
          userFixture4 = ops[3];
          fbUserFixture1 = ops[4];
          fbUserFixture2 = ops[5];
          userFixture1._id = userFixture1._id.toHexString();
          userFixture2._id = userFixture2._id.toHexString();
          userFixture3._id = userFixture3._id.toHexString();
          userFixture4._id = userFixture4._id.toHexString();
          fbUserFixture1._id = fbUserFixture1._id.toHexString();
          fbUserFixture2._id = fbUserFixture2._id.toHexString();

          userIdsToDelete.push(
            userFixture1._id,
            userFixture2._id,
            userFixture3._id,
            userFixture4._id,
            fbUserFixture1._id,
            fbUserFixture2._id,
          );
        })
        .then(() => (
          db.collection('accessTokens')
            .insertMany([{
              userId: mongodb.ObjectID(userFixture1._id),
              accessToken: testAccessToken1,
            }, {
              userId: mongodb.ObjectID(userFixture2._id),
              accessToken: testAccessToken2,
            }, {
              userId: mongodb.ObjectID(userFixture3._id),
              accessToken: testAccessToken3,
            }, {
              userId: mongodb.ObjectID(userFixture4._id),
              accessToken: testAccessToken4,
            }, {
              userId: mongodb.ObjectID(fbUserFixture1._id),
              accessToken: testAccessToken5,
            }, {
              userId: mongodb.ObjectID(fbUserFixture2._id),
              accessToken: testAccessToken6,
            }])
        ))
    );
  });

  after(() => Promise.all([
    db.collection('accessTokens')
      .deleteMany({ accessToken: { $in: accessTokensToDelete } }),

    db.collection('users')
      .deleteMany({
        _id: {
          $in: userIdsToDelete.map(id => mongodb.ObjectID(id)),
        },
      }),

    db.collection('workouts')
      .deleteMany({
        _id: {
          $in: testWorkouts.map(workout => workout._id),
        },
      }),
  ]));

  describe('POST /', () => {
    let sendConfirmationEmailStub;

    beforeEach(() => {
      emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
      });
      sendConfirmationEmailStub = sinon
        .stub(emailUtility, 'sendConfirmationEmail', () => Promise.resolve());
    });

    const url = '/users';
    const assert400Request = body => new Promise((resolve, reject) => {
      request(app)
        .post(url)
        .send(body)
        .expect(400)
        .expect(() => expect(sendConfirmationEmailStub.callCount).to.equal(0))
        .end((err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
    });

    it('should reject when email is not in request body', () => assert400Request({
      password: testPassword,
    }));

    it('should reject when only one password field is in request body', () => Promise.all([
      assert400Request({ email: testEmail1, password: testPassword }),
      assert400Request({ email: testEmail1, verifyPassword: testPassword }),
    ]));

    it('should reject invalid email formats', () => {
      const passwords = { password: testPassword };
      const simpleWord = 'email';
      const noAtSymbol = 'bb.com';
      const noLocal = '@b.com';
      const noDomain = 'b@';
      const noTld = 'a@b';

      return Promise.all([
        assert400Request(Object.assign({ email: simpleWord }, passwords)),
        assert400Request(Object.assign({ email: noAtSymbol }, passwords)),
        assert400Request(Object.assign({ email: noLocal }, passwords)),
        assert400Request(Object.assign({ email: noDomain }, passwords)),
        assert400Request(Object.assign({ email: noTld }, passwords)),
      ]);
    });

    it('should reject invalid password formats', () => {
      /* eslint-disable max-len */
      const staticEmail = { email: `test.${randomString()}@${randomString()}.com` };
      const tooShort = 'fO0';
      const tooLong = 'fO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@r';

      return Promise.all([
        assert400Request(Object.assign({ password: tooShort }, staticEmail)),
        assert400Request(Object.assign({ password: tooLong }, staticEmail)),
      ]);
      /* eslint-enable max-len */
    });

    it('should reject when email is already taken', () => assert400Request({
      email: userFixture1.email,
      password: testPassword,
    }));

    it('should create a new user', (done) => {
      request(app)
        .post(url)
        .send({
          email: `test.${randomString()}@${randomString()}.com`,
          password: testPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.be.ok;
          expect(res.body).to.have.all.keys('user', 'accessToken');
          expect(res.body.user).to.have.all.keys(
            '_id',
            'email',
            'firstName',
            'nickname',
            'gender',
            'height',
            'heightUnitPreference',
            'weight',
            'weightUnitPreference',
            'birthdate',
            'hasOnboarded',
            'seenAppRating',
            'seenBaselineSurvey',
            'seenFeedbackSurvey',
            'lastName',
            'settings',
            'isConfirmed',
            'createdAt',
            'confirmationToken',
            'confirmationTokenExpiry',
            'dailyStreak',
            'lastSession',
            'authMethod',
            'trainingPlans',
            'favoriteWorkouts',
            'trainingPlanProgress',
          );
          expect(res.body.user).to.have.property('heightUnitPreference', constants.heightUnits.IN);
          expect(res.body.user).to.have.property('weightUnitPreference', constants.weightUnits.LB);
          expect(res.body.user.settings).to.have.all.keys(
            'postureThreshold',
            'backboneVibration',
            'phoneVibration',
            'vibrationStrength',
            'vibrationPattern',
            'slouchTimeThreshold',
            'slouchNotification',
            'dailyReminderNotification',
            'dailyReminderTime',
          );

          const defaultTrainingPlanIds = defaultTrainingPlans.map(plan => plan._id.toHexString());
          res.body.user.trainingPlans.forEach((plan) => {
            expect(plan._id).to.be.oneOf(defaultTrainingPlanIds);
          });
          expect(res.body).to.not.have.property('password');
          expect(res.body.accessToken).to.be.a('string');
          expect(sendConfirmationEmailStub.callCount).to.equal(1);
        })
        .end((err, res) => {
          userIdsToDelete.push(res.body.user._id);
          accessTokensToDelete.push(res.body.accessToken);
          done(err, res);
        });
    });
  });

  describe('GET /:id', () => {
    const url = '/users';

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with a 401 if access token does not belong to the user id', (done) => {
      request(app)
        .get(`${url}/abcdef123456abcdef123456`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(401)
        .expect({ error: 'Invalid credentials' })
        .end(done);
    });

    it('should return a user object without password data', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).to.not.have.ownProperty('password');
        })
        .end(done);
    });
  });

  describe('POST /:id', () => {
    let url;
    let sendConfirmationEmailStub;
    let generateTokenSpy;

    beforeEach(() => {
      emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
      });
      sendConfirmationEmailStub = sinon
        .stub(emailUtility, 'sendConfirmationEmail', () => Promise.resolve());
    });

    const assertRequest = body => request(app)
      .post(url)
      .set('Authorization', `Bearer ${testAccessToken1}`)
      .send(body);

    before(() => {
      url = `/users/${userFixture1._id}`;
      generateTokenSpy = sinon
        .spy(tokenFactory, 'generateToken');
    });

    after(() => {
      generateTokenSpy.restore();
    });

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .post(url)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .post(url)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should not allow unknown fields', (done) => {
      assertRequest({ foo: 'bar' })
        .expect(400)
        .expect({ error: '"foo" is not allowed' })
        .end(done);
    });

    it('should not allow forbidden fields', (done) => {
      assertRequest({ _id: 'abc123' })
        .expect(400)
        .expect({ error: '"_id" is not allowed' })
        .end(done);
    });

    it('should not update users if access token does not belong to the user id', (done) => {
      request(app)
        .post('/users/123456789012')
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .send({ email: 'new@email.com' })
        .expect(401)
        .expect({ error: 'Invalid credentials' })
        .end(done);
    });

    it('should not allow an email update if the email is taken by another user', (done) => {
      const newEmail = userFixture1.email;
      request(app)
        .post(`/users/${userFixture2._id}`)
        .set('Authorization', `Bearer ${testAccessToken2}`)
        .send({ email: newEmail })
        .expect(400)
        .expect(() => {
          expect(sendConfirmationEmailStub.callCount).to.equal(0);
        })
        .end(done);
    });

    it('should update email address', (done) => {
      const newEmail = `aaa${userFixture1.email}`;
      assertRequest({ email: newEmail })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.email).to.equal(newEmail);
          expect(body.password).to.not.exist;
          expect(sendConfirmationEmailStub.callCount).to.equal(1);
          expect(generateTokenSpy.callCount).to.equal(1);
          userFixture1.email = newEmail;
        })
        .end(done);
    });

    it('should update first name', (done) => {
      const testFirstName = randomString();
      assertRequest({ firstName: testFirstName })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.firstName).to.equal(testFirstName);
        })
        .end(done);
    });

    it('should update last name', (done) => {
      const testLastName = randomString();
      assertRequest({ lastName: testLastName })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.lastName).to.equal(testLastName);
        })
        .end(done);
    });

    it('should update nickname', (done) => {
      const testNickname = randomString();
      assertRequest({ nickname: testNickname })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.nickname).to.equal(testNickname);
        })
        .end(done);
    });

    it('should update gender', (done) => {
      const testGender = 1;
      assertRequest({ gender: testGender })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.gender).to.equal(testGender);
        })
        .end(done);
    });

    it('should update height', (done) => {
      const testHeight = 100;
      assertRequest({ height: testHeight })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.height).to.equal(testHeight);
        })
        .end(done);
    });

    it('should update weight', (done) => {
      const testWeight = 100;
      assertRequest({ weight: testWeight })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.weight).to.equal(testWeight);
        })
        .end(done);
    });

    it('should update birthdate', (done) => {
      const testBirthdate = (new Date()).toISOString();
      assertRequest({ birthdate: testBirthdate })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.birthdate).to.equal(testBirthdate);
        })
        .end(done);
    });

    it('should update valid favorite workout Id', (done) => {
      getWorkouts().then((workouts) => {
        assertRequest({ favoriteWorkouts: [workouts[0]._id] })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.favoriteWorkouts).to.deep.equal([workouts[0]._id.toHexString()]);
        })
        .end(done);
      });
    });

    it('should reject invalid favorite workout Ids', (done) => {
      assertRequest({ favoriteWorkouts: [randomString({ length: 24 })] })
        .expect(errors.invalidWorkout.code)
        .expect((res) => {
          expect(res.body.error).to.equal(errors.invalidWorkout.message);
        })
        .end(done);
    });

    it('should remove duplicate favorite workout Id', (done) => {
      getWorkouts().then((workouts) => {
        assertRequest({ favoriteWorkouts: [workouts[0]._id, workouts[1]._id, workouts[0]._id] })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture1._id);
          expect(body.favoriteWorkouts).to.deep.equal([
            workouts[0]._id.toHexString(),
            workouts[1]._id.toHexString(),
          ]);
        })
        .end(done);
      });
    });

    it('should update password', () => {
      const newPassword = 'abcd1234';
      return new Promise((resolve, reject) => {
        assertRequest({
          currentPassword: testPassword,
          password: newPassword,
          verifyPassword: newPassword,
        })
          .expect(200)
          .expect((res) => {
            const { body } = res;
            expect(body._id).to.equal(userFixture1._id);
            expect(body.password).to.not.exist;
          })
          .end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
      })
        .then(() => (
          db.collection('users')
            .findOne({ _id: mongodb.ObjectID(userFixture1._id) })
        ))
        .then(user => bcrypt.compareSync(newPassword, user.password))
        .then((isPasswordMatches) => {
          expect(isPasswordMatches).to.be.true;
        });
    });

    it('should not update password on non email/password accounts', (done) => {
      const newPassword = 'abcd1234';
      request(app)
        .post(`/users/${fbUserFixture1._id}`)
        .set('Authorization', `Bearer ${testAccessToken5}`)
        .send({
          currentPassword: testPassword,
          password: newPassword,
          verifyPassword: newPassword,
        })
        .expect(400)
        .end(done);
    });

    it('should update email on Facebook account with no previous email', (done) => {
      request(app)
        .post(`/users/${fbUserFixture2._id}`)
        .set('Authorization', `Bearer ${testAccessToken6}`)
        .send({
          email: testEmail6,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.email).to.equal(testEmail6);
          expect(res.body.isConfirmed).to.be.false;
        })
        .end(done);
    });

    it('should reject Facebook ID update when missing Facebook access token', (done) => {
      const facebookId = fbTestUsers[1].id;
      assertRequest({
        facebookId,
        facebookAppId: fbAppId,
        facebookVerified: true,
      })
        .expect(errors.missingFacebookAccessToken.code)
        .expect((res) => {
          expect(res.body.error).to.equal(errors.missingFacebookAccessToken.message);
        })
        .end(done);
    });

    it('should reject Facebook ID update when missing Facebook app ID', (done) => {
      const facebookId = fbTestUsers[1].id;
      assertRequest({
        facebookId,
        facebookAccessToken: fbTestUsers[1].access_token,
        facebookVerified: true,
      })
        .expect(errors.missingFacebookAppId.code)
        .expect((res) => {
          expect(res.body.error).to.equal(errors.missingFacebookAppId.message);
        })
        .end(done);
    });

    it('should reject Facebook ID update when missing Facebook verified', (done) => {
      mochaContext.timeout(15000);
      const facebookId = fbTestUsers[1].id;
      assertRequest({
        facebookId,
        facebookAccessToken: fbTestUsers[1].access_token,
        facebookAppId: fbAppId,
      })
        .expect(errors.unverifiedFacebook.code)
        .expect((res) => {
          expect(res.body.error).to.equal(errors.unverifiedFacebook.message);
        })
        .end(done);
    });

    it('should reject Facebook ID if taken by another confirmed user', (done) => {
      mochaContext.timeout(15000);
      const facebookId = fbUserFixture1.facebookId;
      assertRequest({
        facebookId,
        facebookAccessToken: fbTestUsers[1].access_token,
        facebookAppId: fbAppId,
        facebookVerified: true,
      })
        .expect(errors.facebookTaken.code)
        .expect((res) => {
          expect(res.body.error).to.equal(errors.facebookTaken.message);
        })
        .end(done);
    });

    it('should reject Facebook ID for an unconfirmed user', (done) => {
      mochaContext.timeout(15000);
      expect(userFixture2.isConfirmed).to.be.false;
      const facebookId = fbTestUsers[1].id;
      request(app)
        .post(`/users/${userFixture2._id}`)
        .set('Authorization', `Bearer ${testAccessToken2}`)
        .send({
          facebookId,
          facebookAccessToken: fbTestUsers[1].access_token,
          facebookAppId: fbAppId,
          facebookVerified: true,
        })
        .expect(errors.unconfirmedEmail.code)
        .expect((res) => {
          expect(res.body.error).to.equal(errors.unconfirmedEmail.message);
        })
        .end(done);
    });

    it('should accept Facebook ID for a confirmed user', (done) => {
      mochaContext.timeout(15000);
      const facebookId = fbTestUsers[2].id;
      request(app)
        .post(`/users/${userFixture3._id}`)
        .set('Authorization', `Bearer ${testAccessToken3}`)
        .send({
          facebookId,
          facebookAccessToken: fbTestUsers[2].access_token,
          facebookAppId: fbAppId,
          facebookVerified: true,
        })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture3._id);
          expect(body.facebookId).to.equal(facebookId);
        })
        .end(done);
    });

    it('should accept Facebook ID and email for unconfirmed user and update user to confirm', (done) => {
      mochaContext.timeout(15000);
      expect(userFixture4.isConfirmed).to.be.false;
      const facebookId = fbTestUsers[3].id;
      request(app)
        .post(`/users/${userFixture4._id}`)
        .set('Authorization', `Bearer ${testAccessToken4}`)
        .send({
          facebookId,
          facebookAccessToken: fbTestUsers[3].access_token,
          facebookAppId: fbAppId,
          facebookVerified: true,
          facebookEmail: userFixture4.email,
        })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body._id).to.equal(userFixture4._id);
          expect(body.facebookId).to.equal(facebookId);
          expect(body.isConfirmed).to.be.true;
        })
        .end(done);
    });
  });

  describe('POST /settings/:id', () => {
    let url;

    const assertRequest = body => request(app)
      .post(url)
      .set('Authorization', `Bearer ${testAccessToken1}`)
      .send(body);

    before(() => {
      url = `/users/settings/${userFixture1._id}`;
    });

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .post(url)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .post(url)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should not allow unknown fields', (done) => {
      assertRequest({ foo: 'bar' })
        .expect(400)
        .expect({ error: '"foo" is not allowed' })
        .end(done);
    });

    it('should update settings', (done) => {
      const postureThreshold = 0.25;
      assertRequest({ postureThreshold })
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body.postureThreshold).to.equal(postureThreshold);
        })
        .end(done);
    });
  });

  describe('GET /sessions/:id', () => {
    const url = '/users/sessions';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const params = `?from=${yesterday.toISOString()}&to=${today.toISOString()}`;

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}${params}`)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}${params}`)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with a 401 if access token does not belong to the user id', (done) => {
      request(app)
        .get(`${url}/abcdef123456abcdef123456${params}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(401)
        .expect({ error: 'Invalid credentials' })
        .end(done);
    });

    it('should respond with a 400 if `from` query is not in ISO 8601', (done) => {
      const fromDate = `${yesterday.getMonth() + 1}-${yesterday.getDate()}-${yesterday.getFullYear()}`;
      request(app)
        .get(`${url}/${userFixture1._id}?from=${fromDate}&to=${today.toISOString()}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(400)
        .end(done);
    });

    it('should respond with a 400 if `to` query is not in ISO 8601', (done) => {
      const toDate = `${today.getMonth() + 1}-${today.getDate()}-${today.getFullYear()}`;
      request(app)
        .get(`${url}/${userFixture1._id}?from=${yesterday.toISOString()}&to=${toDate}}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(400)
        .end(done);
    });

    it('should return an array', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}${params}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).to.be.instanceOf(Array);
        })
        .end(done);
    });
  });

  describe('GET /workouts/:id', () => {
    const url = '/users/workouts';

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with a 401 if access token does not belong to the user id', (done) => {
      request(app)
        .get(`${url}/abcdef123456abcdef123456`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(401)
        .expect({ error: 'Invalid credentials' })
        .end(done);
    });

    it('should return an array', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).to.be.instanceOf(Array);
        })
        .end(done);
    });
  });

  describe('POST /send-confirmation-email/:id', () => {
    const url = '/users/send-confirmation-email';
    let generateTokenSpy;
    let sendConfirmationEmailStub;

    before(() => {
      emailUtility = EmailUtility.init({
        apiKey: process.env.BL_MAILGUN_API,
        domain: process.env.BL_MAILGUN_DOMAIN,
        silentEmail: false,
      });
      sendConfirmationEmailStub = sinon.stub(emailUtility, 'sendConfirmationEmail', () => Promise.resolve());
      generateTokenSpy = sinon.spy(tokenFactory, 'generateToken');
    });

    after(() => {
      generateTokenSpy.restore();
    });

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .post(`${url}/${userFixture1._id}`)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with a 401 if access token does not belong to the user id', (done) => {
      request(app)
        .post(`${url}/abcdef123456abcdef123456`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(401)
        .expect({ error: 'Invalid credentials' })
        .end(done);
    });

    it('should send confirmation email', (done) => {
      request(app)
        .post(`${url}/${userFixture1._id}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(200)
        .expect(() => {
          expect(generateTokenSpy.callCount).to.equal(1);
          expect(sendConfirmationEmailStub.callCount).to.equal(1);
        })
        .end(done);
    });
  });

  describe('GET /research-videos/:id', () => {
    const url = '/users/research-videos';
    it('should return an array of research videos', (done) => {
      request(app)
        .get(`${url}/${userFixture1._id}`)
        .set('Authorization', `Bearer ${testAccessToken1}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).to.be.instanceOf(Array);
        })
        .end(done);
    });
  });
});
