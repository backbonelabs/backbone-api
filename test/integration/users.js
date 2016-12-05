import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import sinon from 'sinon';
import server from '../../index';
import userDefaults from '../../lib/userDefaults';
import constants from '../../lib/constants';
import EmailUtility from '../../lib/EmailUtility';

let emailUtility;
let app;
let db;
let userFixture = {};
let confirmedUserFixture;
let unconfirmedUserFixture;

const { mergeWithDefaultData } = userDefaults;
const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
const testEmail3 = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const testAccessToken = 'testAccessToken';
const userIdsToDelete = [];
const accessTokensToDelete = [testAccessToken];

before(() => Promise.resolve(server)
  .then(expressApp => {
    app = expressApp;
  })
  .then(() => MongoClient.connect(process.env.BL_DATABASE_URL))
  .then(mDb => {
    db = mDb;
  })
  .then(() => (
    db.collection('users')
    .insertMany([
      mergeWithDefaultData({
        email: testEmail1,
        password: testPasswordHash,
      }),
      {
        email: testEmail2,
        password: testPasswordHash,
        isConfirmed: true,
      },
      {
        email: testEmail3,
        password: testPasswordHash,
        isConfirmed: false,
      },
    ])
  ))
  .then(results => {
    const { ops } = results;
    userFixture = ops[0];
    confirmedUserFixture = ops[1];
    unconfirmedUserFixture = ops[2];

    [userFixture, confirmedUserFixture, unconfirmedUserFixture].forEach(value => {
      value._id = value._id.toHexString();
      userIdsToDelete.push(value._id);
    });
  })
  .then(() => db.collection('accessTokens').insertOne({ accessToken: testAccessToken }))
);

after(() => db.collection('accessTokens')
  .deleteMany({ accessToken: { $in: accessTokensToDelete } })
  .then(() => db.collection('users').deleteMany({
    _id: {
      $in: userIdsToDelete.map(id => mongodb.ObjectID(id)),
    },
  }))
);

describe('/users router', () => {
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

      return Promise.all([
        assert400Request(Object.assign({ email: simpleWord }, passwords)),
        assert400Request(Object.assign({ email: noAtSymbol }, passwords)),
        assert400Request(Object.assign({ email: noLocal }, passwords)),
        assert400Request(Object.assign({ email: noDomain }, passwords)),
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
      email: userFixture.email,
      password: testPassword,
    }));

    it('should create a new user', done => {
      request(app)
        .post(url)
        .send({
          email: `test.${randomString()}@${randomString()}.com`,
          password: testPassword,
        })
        .expect(200)
        .expect(res => {
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
            'lastName',
            'settings',
            'isConfirmed',
            'createdAt',
            'confirmationToken',
            'confirmationTokenExpiry',
            'dailyStreak',
            'lastSession'
          );
          expect(res.body.user).to.have.property('heightUnitPreference', constants.heightUnits.IN);
          expect(res.body.user).to.have.property('weightUnitPreference', constants.weightUnits.LB);
          expect(res.body.user.settings).to.have.all.keys(
            'postureThreshold',
            'backboneVibration',
            'phoneVibration',
            'vibrationStrength',
            'vibrationPattern',
            'slouchTimeThreshold'
          );
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

    it('should respond with 401 on missing authorization credentials', done => {
      request(app)
        .get(`${url}/${userFixture._id}`)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', done => {
      request(app)
        .get(`${url}/${userFixture._id}`)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with a 400 on an invalid id', done => {
      request(app)
        .get(`${url}/abcdef123456abcdef123456`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(400)
        .expect({ error: 'No user found' })
        .end(done);
    });

    it('should return a user object without password data', done => {
      request(app)
        .get(`${url}/${userFixture._id}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body).to.not.have.ownProperty('password');
        })
        .end(done);
    });
  });

  describe('POST /:id', () => {
    let url;

    const assertRequest = (body) => request(app)
      .post(url)
      .set('Authorization', `Bearer ${testAccessToken}`)
      .send(body);

    before(() => {
      url = `/users/${userFixture._id}`;
    });

    it('should respond with 401 on missing authorization credentials', done => {
      request(app)
        .post(url)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', done => {
      request(app)
        .post(url)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should not allow unknown fields', done => {
      assertRequest({ foo: 'bar' })
        .expect(400)
        .expect({ error: '"foo" is not allowed' })
        .end(done);
    });

    it('should not allow forbidden fields', done => {
      assertRequest({ _id: 'abc123' })
        .expect(400)
        .expect({ error: 'child "_id" fails because ["_id" is not allowed]' })
        .end(done);
    });

    it('should not update or create users for an invalid id', done => {
      request(app)
        .post('/users/123456789012')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({ email: 'new@email.com' })
        .expect(400)
        .expect({ error: 'Invalid user' })
        .end(done);
    });

    it('should update non-password fields', done => {
      const newEmail = `aaa${userFixture.email}`;
      assertRequest({ email: newEmail })
        .expect(200)
        .expect(res => {
          const { body } = res;
          expect(body._id).to.equal(userFixture._id);
          expect(body.email).to.equal(newEmail);
          expect(body.password).to.not.exist;
        })
        .end(done);
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
          .expect(res => {
            const { body } = res;
            expect(body._id).to.equal(userFixture._id);
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
        .then(() => db.collection('users')
          .findOne({ _id: mongodb.ObjectID(userFixture._id) })
        )
        .then(user => bcrypt.compareSync(newPassword, user.password))
        .then(isPasswordMatches => {
          expect(isPasswordMatches).to.be.true;
        });
    });
  });

  describe('POST /settings/:id', () => {
    let url;

    const assertRequest = (body) => request(app)
      .post(url)
      .set('Authorization', `Bearer ${testAccessToken}`)
      .send(body);

    before(() => {
      url = `/users/settings/${userFixture._id}`;
    });

    it('should respond with 401 on missing authorization credentials', done => {
      request(app)
        .post(url)
        .send({})
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', done => {
      request(app)
        .post(url)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should not allow unknown fields', done => {
      assertRequest({ foo: 'bar' })
        .expect(400)
        .expect({ error: '"foo" is not allowed' })
        .end(done);
    });

    it('should update settings', done => {
      const postureThreshold = 0.5;
      assertRequest({ postureThreshold })
        .expect(200)
        .expect(res => {
          const { body } = res;
          expect(body.postureThreshold).to.equal(postureThreshold);
        })
        .end(done);
    });
  });
});
