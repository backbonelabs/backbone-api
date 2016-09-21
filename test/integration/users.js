import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import server from '../../index';
import userDefaults from '../../lib/userDefaults';

let app;
let db;
let userFixtureNoSettings = {};
let userFixtureWithSettings = {};

const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const testSettings = { postureThreshold: 0.6, foo: 'bar' };
const testAccessToken = 'testAccessToken';
const userIdsToDelete = [];

before(() => Promise.resolve(server)
  .then(expressApp => {
    app = expressApp;
  })
  .then(() => MongoClient.connect(process.env.BL_DATABASE_URL))
  .then(mDb => {
    db = mDb;
  })
  .then(() => db.collection('users').insertMany([{
    email: testEmail1,
    password: testPasswordHash,
  }, {
    email: testEmail2,
    password: testPasswordHash,
    settings: testSettings,
  }]))
  .then(results => {
    userFixtureNoSettings = results.ops[0];
    userFixtureWithSettings = results.ops[1];
    userFixtureNoSettings._id = userFixtureNoSettings._id.toHexString();
    userFixtureWithSettings._id = userFixtureWithSettings._id.toHexString();
    userIdsToDelete.push(userFixtureNoSettings._id, userFixtureWithSettings._id);
  })
  .then(() => db.collection('accessTokens').insertOne({ accessToken: testAccessToken }))
);

after(() => db.collection('accessTokens')
  .deleteOne({ accessToken: testAccessToken })
  .then(() => db.collection('users').deleteMany({
    _id: {
      $in: userIdsToDelete.map(id => mongodb.ObjectID(id)),
    },
  }))
);

describe('/users router', () => {
  describe('POST /', () => {
    const url = '/users';
    const assert400Request = body => new Promise((resolve, reject) => {
      request(app)
        .post(url)
        .send(body)
        .expect(400)
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
      verifyPassword: testPassword,
    }));

    it('should reject when only one password field is in request body', () => Promise.all([
      assert400Request({ email: testEmail1, password: testPassword }),
      assert400Request({ email: testEmail1, verifyPassword: testPassword }),
    ]));

    it('should reject invalid email formats', () => {
      const passwords = { password: testPassword, verifyPassword: testPassword };
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
      const email = { email: testEmail1 };
      const tooShort = 'fO0';
      const tooLong = 'fO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@rfO0b@r';
      const allLowerCase = 'melatoninislife';
      const allUpperCase = 'MELATONINISLIFE';
      const allNumbers = '1234567890';
      const missingUpperCase = 'melatoninislife1';
      const missingLowerCase = 'MELATONINISLIFE1';
      const missingNumber = 'MelatoninIsLife';

      return Promise.all([
        assert400Request(Object.assign({ password: tooShort, verifyPassword: tooShort }, email)),
        assert400Request(Object.assign({ password: tooLong, verifyPassword: tooLong }, email)),
        assert400Request(Object.assign({ password: allLowerCase, verifyPassword: allLowerCase }, email)),
        assert400Request(Object.assign({ password: allUpperCase, verifyPassword: allUpperCase }, email)),
        assert400Request(Object.assign({ password: allNumbers, verifyPassword: allNumbers }, email)),
        assert400Request(Object.assign({ password: missingUpperCase, verifyPassword: missingUpperCase }, email)),
        assert400Request(Object.assign({ password: missingLowerCase, verifyPassword: missingLowerCase }, email)),
        assert400Request(Object.assign({ password: missingNumber, verifyPassword: missingNumber }, email)),
      ]);
      /* eslint-enable max-len */
    });

    it('should reject mismatching passwords', () => assert400Request({
      email: testEmail1,
      password: testPassword,
      verifyPassword: `${testPassword}foo`,
    }));

    it('should reject when email is already taken', () => assert400Request({
      email: userFixtureNoSettings.email,
      password: testPassword,
      verifyPassword: testPassword,
    }));

    // TODO: Re-write test to take into account email operation time
    // it('should create a new user', done => {
    //   request(app)
    //     .post(url)
    //     .send({
    //       email: `test.${randomString()}@${randomString()}.com`,
    //       password: testPassword,
    //       verifyPassword: testPassword,
    //     })
    //     .expect(200)
    //     .expect(res => {
    //       expect(res.body).to.be.ok;
    //     })
    //     .end((err, res) => {
    //       userIdsToDelete.push(res.body.id);
    //       done(err, res);
    //     });
    // });
  });

  describe('POST /:id', () => {
    let url;

    const assertRequest = (body) => request(app)
      .post(url)
      .set('Authorization', `Bearer ${testAccessToken}`)
      .send(body);

    before(() => {
      url = `/users/${userFixtureNoSettings._id}`;
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

    it('should not allow mismatching password fields', done => {
      assertRequest({
        password: testPassword,
        verifyPassword: `${testPassword}1`,
      })
        .expect(400)
        .expect({ error: 'Passwords must match' })
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
      const newEmail = `aaa${userFixtureNoSettings.email}`;
      assertRequest({ email: newEmail })
        .expect(200)
        .expect(res => {
          const { body } = res;
          expect(body._id).to.equal(userFixtureNoSettings._id);
          expect(body.email).to.equal(newEmail);
          expect(body.password).to.not.exist;
        })
        .end(done);
    });

    it('should update password', () => {
      const newPassword = 'Abcdef02';

      return new Promise((resolve, reject) => {
        assertRequest({ password: newPassword, verifyPassword: newPassword })
          .expect(200)
          .expect(res => {
            const { body } = res;
            expect(body._id).to.equal(userFixtureNoSettings._id);
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
          .findOne({ _id: mongodb.ObjectID(userFixtureNoSettings._id) })
        )
        .then(user => bcrypt.compareSync(newPassword, user.password))
        .then(isPasswordMatches => {
          expect(isPasswordMatches).to.be.true;
        });
    });
  });

  describe('GET /settings/:id', () => {
    let url;

    before(() => {
      url = `/users/settings/${userFixtureNoSettings._id}`;
    });

    it('should respond with 401 on missing authorization credentials', done => {
      request(app)
        .get(url)
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', done => {
      request(app)
        .get(url)
        .set('Authorization', 'Bearer 123')
        .expect(401)
        .end(done);
    });

    it('should respond with 400 on invalid user id', done => {
      request(app)
        .get(`/users/settings/${randomString({ length: 24 })}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(400)
        .end(done);
    });

    it('should return default user settings when no settings exist', done => {
      request(app)
        .get(url)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body).to.deep.equal(userDefaults.settings);
        })
        .end(done);
    });

    it('should return merged user settings when settings exist', done => {
      request(app)
        .get(`/users/settings/${userFixtureWithSettings._id}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect(res => {
          const mergedSettings = userDefaults.mergeWithDefaultData(testSettings);
          expect(res.body).to.deep.equal(mergedSettings);
        })
        .end(done);
    });
  });

  describe('POST /settings/:id', () => {
    let url;

    const assertRequest = (body) => request(app)
      .post(url)
      .set('Authorization', `Bearer ${testAccessToken}`)
      .send(body);

    before(() => {
      url = `/users/settings/${userFixtureNoSettings._id}`;
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
