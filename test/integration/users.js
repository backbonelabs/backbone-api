import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import server from '../../index';

let app;
let db;
let userFixture = {};

const testEmail = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
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
  .then(() => db.collection('users').insertOne({
    email: testEmail,
    password: testPasswordHash,
  }))
  .then(results => {
    userFixture = results.ops[0];
    userFixture._id = userFixture._id.toHexString();
    userIdsToDelete.push(userFixture._id);
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
      assert400Request({ email: testEmail, password: testPassword }),
      assert400Request({ email: testEmail, verifyPassword: testPassword }),
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
      const email = { email: testEmail };
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
      email: testEmail,
      password: testPassword,
      verifyPassword: `${testPassword}foo`,
    }));

    it('should reject when email is already taken', () => assert400Request({
      email: userFixture.email,
      password: testPassword,
      verifyPassword: testPassword,
    }));

    it('should create a new user', done => {
      request(app)
        .post(url)
        .send({
          email: `test.${randomString()}@${randomString()}.com`,
          password: testPassword,
          verifyPassword: testPassword,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).to.be.ok;
        })
        .end((err, res) => {
          userIdsToDelete.push(res.body.id);
          done(err, res);
        });
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
      const newEmail = `aaa${userFixture.email}`;
      assertRequest({ email: newEmail })
        .expect(200)
        .expect(res => {
          expect(res.body._id).to.equal(userFixture._id);
          expect(res.body.email).to.equal(newEmail);
        })
        .end(done);
    });

    it('should update password', () => {
      const newPassword = 'Abcdef02';

      return new Promise((resolve, reject) => {
        assertRequest({ password: newPassword, verifyPassword: newPassword })
          .expect(200)
          .expect(res => {
            expect(res.body._id).to.equal(userFixture._id);
          })
          .end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
      })
        .then(() => db.collection('users').findOne({ _id: mongodb.ObjectID(userFixture._id) }))
        .then(user => bcrypt.compareSync(newPassword, user.password))
        .then(isPasswordMatches => {
          expect(isPasswordMatches).to.be.true;
        });
    });
  });
});
