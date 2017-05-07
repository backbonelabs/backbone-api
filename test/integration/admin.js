import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import server from '../../index';
import userDefaults from '../../lib/userDefaults';

let app;
let db;

const { mergeWithDefaultData } = userDefaults;
const generateUsers = (n, collection = []) => {
  if (n < 1) return collection;

  collection.push(mergeWithDefaultData({
    nickname: `test.${randomString()}`,
    email: `test.${randomString()}@${randomString()}.com`,
    password: bcrypt.hashSync(randomString({ length: 8 }), 10),
  }));

  return generateUsers(n - 1, collection);
};

const userFixtures = [];
const testAccessToken = randomString({ length: 64 });

before(() => (
  Promise.resolve(server)
    .then((expressApp) => {
      app = expressApp;
    })
    .then(() => MongoClient.connect(process.env.BL_DATABASE_URL))
    .then((mDb) => {
      db = mDb;
    })
    .then(() => (
      db.collection('internalUsers')
        .insertOne({
          accessToken: testAccessToken,
        })
    ))
    .then(() => (
      db.collection('users')
        .insertMany(generateUsers(2))
    ))
    .then((results) => {
      const { ops } = results;
      ops.forEach(user => userFixtures.push(user));
      userFixtures.forEach((user) => {
        user._id = user._id.toHexString();
      });
    })
));

after(() => (
  db.collection('internalUsers')
    .deleteOne({ accessToken: testAccessToken })
    .then(() => (
      db.collection('users').deleteMany({
        _id: {
          $in: userFixtures.map(user => mongodb.ObjectID(user._id)),
        },
      })
    ),
)));

describe('/admin router', () => {
  describe('GET /users', () => {
    const url = '/admin/users';
    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .get(url)
        .expect(401)
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .get(url)
        .set('Authorization', 'Bearer 123')
        .expect(401)
        .end(done);
    });

    it('should return a collection of all users', (done) => {
      request(app)
        .get(url)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body).to.be.an('array');
          expect(body).to.have.length.at.least(2);
          const userFixtureIds = userFixtures.map(userFixture => userFixture._id);
          const responseUserIds = body.map(user => user._id);
          expect(responseUserIds).to.include.members(userFixtureIds);
        })
        .end(done);
    });

    it('should return a subset collection of users based on a query matching nickname', (done) => {
      request(app)
        .get(url)
        .query({ q: `${userFixtures[0].nickname.substring(2, 10)}` })
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body).to.be.an('array');
          expect(body).to.have.length.at.least(1);
          const responseUserIds = body.map(user => user._id);
          expect(responseUserIds).to.include(userFixtures[0]._id);
        })
        .end(done);
    });

    it('should return a subset collection of users based on a query matching email', (done) => {
      request(app)
        .get(url)
        .query({ q: `${userFixtures[1].email.substring(2, 10)}` })
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect((res) => {
          const { body } = res;
          expect(body).to.be.an('array');
          expect(body).to.have.length.at.least(1);
          const responseUserIds = body.map(user => user._id);
          expect(responseUserIds).to.include(userFixtures[1]._id);
        })
        .end(done);
    });
  });
});
