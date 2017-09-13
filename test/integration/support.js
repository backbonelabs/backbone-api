import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import randomString from 'random-string';
import sinon from 'sinon';
import server from '../../index';
import userDefaults from '../../lib/userDefaults';
import EmailUtility from '../../lib/EmailUtility';

let emailUtility;
let app;
let db;
let userFixture = {};

const { mergeWithDefaultData } = userDefaults;
const testEmail = `test.${randomString()}@${randomString()}.com`;
const testAccessToken = 'testAccessToken';
const userIdsToDelete = [];

describe('/support router', () => {
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
        db.collection('users')
          .insertOne(mergeWithDefaultData({
            email: testEmail,
          }))
      ))
      .then((result) => {
        const { ops } = result;
        userFixture = ops[0];

        userFixture._id = userFixture._id.toHexString();
        userIdsToDelete.push(userFixture._id);
      })
      .then(() => db.collection('accessTokens').insertOne({ accessToken: testAccessToken }))
  ));

  after(() => (
    db.collection('accessTokens')
      .deleteOne({ accessToken: testAccessToken })
      .then(() => db.collection('users').deleteOne({
        _id: mongodb.ObjectID(userFixture._id),
      }))
  ));

  let sendSupportEmailStub;

  beforeEach(() => {
    emailUtility = EmailUtility.init({
      apiKey: process.env.BL_MAILGUN_API,
      domain: process.env.BL_MAILGUN_DOMAIN,
      silentEmail: false,
    });
    sendSupportEmailStub = sinon.stub(emailUtility, 'sendSupportEmail', () => Promise.resolve());
  });

  describe('POST /', () => {
    const url = '/support';
    const supportMessage = 'Help me';

    const assert400Request = body => new Promise((resolve, reject) => {
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send(body)
        .expect(400)
        .expect(() => expect(sendSupportEmailStub.callCount).to.equal(0))
        .end((err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
    });

    it('should respond with 401 on missing authorization credentials', (done) => {
      request(app)
        .post(url)
        .send({})
        .expect(401)
        .expect(() => expect(sendSupportEmailStub.callCount).to.equal(0))
        .end(done);
    });

    it('should respond with 401 on invalid access token', (done) => {
      request(app)
        .post(url)
        .set('Authorization', 'Bearer 123')
        .send({})
        .expect(401)
        .expect(() => expect(sendSupportEmailStub.callCount).to.equal(0))
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

    it('should send the support email', (done) => {
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          _id: userFixture._id,
          message: supportMessage,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).to.deep.equal({});
          expect(sendSupportEmailStub.callCount).to.equal(1);
          expect(sendSupportEmailStub.calledWith(testEmail)).to.be.true;
        })
        .end(done);
    });
  });
});
