import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import randomString from 'random-string';
import server from '../../index';
import userDefaults from '../../lib/userDefaults';

let app;
let db;
let userFixture = {};

const { mergeWithDefaultData } = userDefaults;
const testEmail1 = `test.${randomString()}@${randomString()}.com`;
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
  .then(() => db.collection('users')
    .insertOne(mergeWithDefaultData({
      email: testEmail1,
    }))
  )
  .then(result => {
    const { ops } = result;
    userFixture = ops[0];

    userFixture._id = userFixture._id.toHexString();
    userIdsToDelete.push(userFixture._id);
  })
  .then(() => db.collection('accessTokens').insertOne({ accessToken: testAccessToken }))
);

after(() => db.collection('accessTokens')
  .deleteOne({ accessToken: testAccessToken })
  .then(() => db.collection('users').deleteOne({
    _id: mongodb.ObjectID(userFixture._id),
  }))
);

describe('/support router', () => {
  describe('POST /', () => {
    const url = '/support';
    const supportMessage = 'Help me';

    const assert400Request = body => new Promise((resolve, reject) => {
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${testAccessToken}`)
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

    it('should respond with 401 on missing authorization credentials', done => {
      request(app)
        .post(url)
        .send({})
        .expect(401, done);
    });

    it('should respond with 401 on invalid access token', done => {
      request(app)
        .post(url)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .end(done);
    });

    it('should not allow unknown fields', () => (
      assert400Request({
        _id: userFixture._id,
        message: supportMessage,
        foo: 'bar',
      })
        .then(res => expect(res.body.error).to.exist)
    ));

    it('should reject when _id is not in request body', () => (
      assert400Request({
        message: supportMessage,
      })
        .then(res => expect(res.body.error).to.exist)
    ));

    it('should reject when message is not in request body', () => (
      assert400Request({
        _id: userFixture._id,
      })
        .then(res => expect(res.body.error).to.exist)
    ));

    it('should reject when _id is not valid', () => (
      assert400Request({
        _id: 'fake',
        message: supportMessage,
      })
        .then(res => expect(res.body.error).to.exist)
    ));

    it('should send the support email', done => {
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          _id: userFixture._id,
          message: supportMessage,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).to.deep.equal({});
          // TODO: Figure out how to stub the mailgun.messages().send() method
        })
        .end(done);
    });
  });
});
