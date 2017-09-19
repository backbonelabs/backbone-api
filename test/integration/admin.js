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
let totalUsers = 0;

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
        .insertMany(generateUsers(10))
    ))
    .then((results) => {
      const { ops } = results;
      ops.forEach(user => userFixtures.push(user));
      userFixtures.forEach((user) => {
        user._id = user._id.toHexString();
      });
    })
    .then(() => db.collection('users').find().toArray())
    .then((results) => {
      totalUsers = results.length;
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
          const { body: { users, count } } = res;
          expect(users).to.be.an('array');
          expect(users).to.have.length.at.least(userFixtures.length);
          expect(count).to.be.at.least(userFixtures.length);
          const userFixtureIds = userFixtures.map(userFixture => userFixture._id);
          const responseUserIds = users.map(user => user._id);
          expect(responseUserIds).to.include.members(userFixtureIds);
        })
        .end(done);
    });

    it('should reject invalid limit parameter values', () => {
      const invalidRequestWithLimit = limit => (
        new Promise((resolve, reject) => {
          request(app)
            .get(url)
            .query({ limit })
            .set('Authorization', `Bearer ${testAccessToken}`)
            .expect(400, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
        })
      );

      return Promise.all([
        invalidRequestWithLimit(0),
        invalidRequestWithLimit(-1),
        invalidRequestWithLimit(1.01),
      ]);
    });

    it('should return max users based on the limit parameter', (done) => {
      const limit = userFixtures.length / 2;
      request(app)
        .get(url)
        .query({ limit })
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect((res) => {
          const { body: { users, count } } = res;
          expect(users).to.be.an('array');
          expect(users).to.have.length.at.least(1).at.most(limit);
          expect(count).to.be.at.least(userFixtures.length);
        })
        .end(done);
    });

    it('should reject invalid page parameter values', () => {
      const invalidRequestWithPage = page => (
        new Promise((resolve, reject) => {
          request(app)
            .get(url)
            .query({ page })
            .set('Authorization', `Bearer ${testAccessToken}`)
            .expect(400, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
        })
      );

      return Promise.all([
        invalidRequestWithPage(0),
        invalidRequestWithPage(-1),
        invalidRequestWithPage(1.01),
      ]);
    });

    it('should return max users based on the limit and page parameter', (done) => {
      const limit = userFixtures.length / 2;
      request(app)
        .get(url)
        .query({ limit, page: 2 })
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect((res) => {
          const { body: { users, count } } = res;
          expect(users).to.be.an('array');
          expect(users).to.have.length.at.least(1).at.most(limit);
          expect(count).to.be.at.least(userFixtures.length);
        })
        .end(done);
    });

    it('should return no users if the starting page doesn\'t exist', (done) => {
      const limit = userFixtures.length / 2;
      request(app)
        .get(url)
        .query({ limit, page: Math.floor(totalUsers / limit) + 2 })
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200)
        .expect((res) => {
          const { body: { users, count } } = res;
          expect(users).to.be.an('array');
          expect(users).to.have.lengthOf(0);
          expect(count).to.be.at.least(userFixtures.length);
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
          const { body: { users, count } } = res;
          expect(users).to.be.an('array');
          expect(users).to.have.length.at.least(1).at.most(userFixtures.length);
          expect(count).to.be.at.least(1).at.most(userFixtures.length);
          const responseUserIds = users.map(user => user._id);
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
          const { body: { users, count } } = res;
          expect(users).to.be.an('array');
          expect(users).to.have.length.at.least(1).at.most(userFixtures.length);
          expect(count).to.be.at.least(1).at.most(userFixtures.length);
          const responseUserIds = users.map(user => user._id);
          expect(responseUserIds).to.include(userFixtures[1]._id);
        })
        .end(done);
    });
  });
});
