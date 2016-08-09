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
      email: testEmail,
    }));

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
      email: testEmail,
      password: randomString(),
    }));

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

  describe('POST /logout', () => {
    const url = '/auth/logout';

    it('should require authorization header', done => {
      request(app)
        .post(url)
        .expect(401)
        .end(done);
    });

    it('should require bearer authorization scheme', done => {
      request(app)
        .post(url)
        .set('Authorization', `Basic ${accessTokensToDelete[0]}`)
        .expect(401)
        .end(done);
    });

    it('should delete an access token', done => {
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${accessTokensToDelete[0]}`)
        .expect(200)
        .end(requestErr => {
          db.collection('accessTokens')
            .find({ accessToken: accessTokensToDelete[0] })
            .limit(1)
            .next((dbErr, accessToken) => {
              expect(accessToken).to.be.null;
              done(requestErr || dbErr, accessToken);
            });
        });
    });
  });
});
