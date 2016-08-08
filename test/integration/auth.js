import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import server from '../../index';

let app;
let db;
let userFixture;

const testEmail = `test.${randomString()}@${randomString()}.com`;
const testPassword = 'Abcdef01';
const testPasswordHash = bcrypt.hashSync(testPassword, 10);
const accessTokensToDelete = [];

before(() => Promise.resolve(server)
  .then(expressApp => {
    app = expressApp;
  })
  .then(() => MongoClient.connect(process.env.BL_DATABASE_URL))
  .then(mDb => {
    db = mDb;
  })
  .then(() => db.collection('users')
    .insertOne({
      email: testEmail,
      password: testPasswordHash,
      createdAt: new Date(),
    })
  )
  .then(results => {
    userFixture = results.ops[0];
  })
);

after(() => db.collection('accessTokens')
  .deleteMany({ accessToken: { $in: accessTokensToDelete } })
  .then(() => db.collection('users')
    .deleteOne({ _id: mongodb.ObjectID(userFixture._id) })
  )
);

describe('/auth', () => {
  describe('POST /login', () => {
    const url = '/auth/login';

    it('should reject when email is not in request body', done => {
      request(app)
        .post(url)
        .send({ password: testPassword })
        .expect(400)
        .end(done);
    });

    it('should reject when password is not in request body', done => {
      request(app)
        .post(url)
        .send({ email: testEmail })
        .expect(400)
        .end(done);
    });

    it('should reject invalid email formats', () => {
      const simpleWord = 'email';
      const noAtSymbol = 'bb.com';
      const noLocal = '@b.com';
      const noDomain = 'b@';

      const makeRequestWithEmail = email => new Promise((resolve, reject) => {
        request(app)
          .post(url)
          .send({
            email,
            password: testPassword,
          })
          .expect(400)
          .end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
      });

      return Promise.all([
        makeRequestWithEmail(simpleWord),
        makeRequestWithEmail(noAtSymbol),
        makeRequestWithEmail(noLocal),
        makeRequestWithEmail(noDomain),
      ]);
    });

    it('should reject an invalid email/password combination', done => {
      const email = testEmail;
      const password = randomString();

      request(app)
        .post(url)
        .send({
          email,
          password,
        })
        .expect(401)
        .end(done);
    });

    it('should return email and access token on valid email/password combination', done => {
      request(app)
        .post(url)
        .send({
          email: userFixture.email,
          password: testPassword,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).to.contain.all.keys(['email', 'accessToken']);
          expect(res.body.email).to.equal(userFixture.email);
        })
        .end((err, res) => {
          accessTokensToDelete.push(res.body.accessToken);
          done(err, res);
        });
    });

    it('should return a 64-character access token on valid email/password combination', done => {
      request(app)
        .post(url)
        .send({
          email: userFixture.email,
          password: testPassword,
        })
        .expect(200)
        .expect(res => {
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          accessTokensToDelete.push(res.body.accessToken);
          done(err, res);
        });
    });
  });
});
