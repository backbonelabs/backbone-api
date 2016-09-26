import { expect } from 'chai';
import request from 'supertest';
import mongodb, { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import randomString from 'random-string';
import server from '../../index';

let app;
let db;
let unconfirmedUserFixture;
let confirmedUserFixture;
let accessTokenFixture;

const testEmail1 = `test.${randomString()}@${randomString()}.com`;
const testEmail2 = `test.${randomString()}@${randomString()}.com`;
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
    .insertMany([{
      email: testEmail1,
      password: testPasswordHash,
    }, {
      email: testEmail2,
      password: testPasswordHash,
      isConfirmed: true,
    }])
  )
  .then(results => {
    const ops = results.ops.map(op => ({
      ...op,
      _id: op._id.toHexString(),
    }));
    unconfirmedUserFixture = ops[0];
    confirmedUserFixture = ops[1];
  })
  .then(() => db.collection('accessTokens')
    .insertOne({
      userId: mongodb.ObjectID(confirmedUserFixture._id),
      accessToken: randomString({ length: 64 }),
    })
  )
  .then(results => {
    accessTokenFixture = results.ops[0];
    accessTokenFixture.userId = accessTokenFixture.userId.toHexString();
    accessTokensToDelete.push(accessTokenFixture.accessToken);
  })
);

after(() => db.collection('accessTokens')
  .deleteMany({ accessToken: { $in: accessTokensToDelete } })
  .then(() => db.collection('users')
    .deleteMany({
      _id: {
        $in: [
          mongodb.ObjectID(unconfirmedUserFixture._id),
          mongodb.ObjectID(confirmedUserFixture._id),
        ],
      },
    })
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
      email: testEmail1,
    }));

    it('should reject when email, password, and access token are not in request body', () => (
      assertRequestStatusCode(400, {})
    ));

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
      email: testEmail1,
      password: `${testPassword}1`,
    }));

    it('should reject an invalid access token', () => assertRequestStatusCode(401, {
      accessToken: randomString({ length: 64 }),
    }));

    // TODO: Write tests that include check for whether user `isConfirmed`
    // it('should return email and access token on confirmed email/password combination', done => {
    //   request(app)
    //     .post(url)
    //     .send({
    //       email: unconfirmedUserFixture.email,
    //       password: testPassword,
    //     })
    //     .expect(200)
    //     .expect(res => {
    //       expect(res.body).to.contain.all.keys(['email', 'accessToken']);
    //       expect(res.body.email).to.equal(unconfirmedUserFixture.email);
    //     })
    //     .end((err, res) => {
    //       accessTokensToDelete.push(res.body.accessToken);
    //       done(err, res);
    //     });
    // });

    it('should reject on unconfirmed email/password combination', done => {
      request(app)
        .post(url)
        .send({
          email: unconfirmedUserFixture.email,
          password: testPassword,
        })
        .expect(401)
        .expect(res => {
          expect(res.body).to.contain.all.keys(['error']);
        })
        .end(done);
    });

    it('should return user profile and access token on valid email/password combination', done => {
      request(app)
        .post(url)
        .send({
          email: confirmedUserFixture.email,
          password: testPassword,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).to.contain.all.keys(['_id', 'email']);
          expect(res.body).to.not.contain.all.keys(['password']);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
          done(err, res);
        });
    });

    it('should return user profile and new access token on valid access token', done => {
      request(app)
        .post(url)
        .send({ accessToken: accessTokenFixture.accessToken })
        .expect(200)
        .expect(res => {
          expect(res.body).to.contain.all.keys(['_id', 'email']);
          expect(res.body).to.not.contain.all.keys(['password']);
          expect(res.body.accessToken).to.not.equal(accessTokenFixture.accessToken);
          expect(res.body.accessToken.length).to.equal(64);
        })
        .end((err, res) => {
          if (!err) {
            accessTokensToDelete.push(res.body.accessToken);
          }
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
        .set('Authorization', `Basic ${accessTokensToDelete[1]}`)
        .expect(401)
        .end(done);
    });

    // TODO: Create tests for making sure user isConfirmed, to have accessToken to delete
    // it('should delete an access token', done => {
    //   request(app)
    //     .post(url)
    //     .set('Authorization', `Bearer ${accessTokensToDelete[1]}`)
    //     .expect(200)
    //     .end(requestErr => {
    //       db.collection('accessTokens')
    //         .find({ accessToken: accessTokensToDelete[1] })
    //         .limit(1)
    //         .next((dbErr, accessToken) => {
    //           expect(accessToken).to.be.null;
    //           done(requestErr || dbErr, accessToken);
    //         });
    //     });
    // });
  });

  describe('POST /reset', () => {
    const url = '/auth/reset';
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

    it('should reject when email is not in request body', () => assertRequestStatusCode(400, {}));

    it('should reject invalid email formats', () => {
      const simpleWord = 'email';
      const noAtSymbol = 'bb.com';
      const noLocal = '@b.com';
      const noDomain = 'b@';

      return Promise.all([
        assertRequestStatusCode(400, { email: simpleWord }),
        assertRequestStatusCode(400, { email: noAtSymbol }),
        assertRequestStatusCode(400, { email: noLocal }),
        assertRequestStatusCode(400, { email: noDomain }),
      ]);
    });

    it('should send a password reset email in less than 1000ms', function (done) {
      // Have to use anonymous function or else `this` is in the wrong context
      this.timeout(1000);

      // Send a password reset email and invoke done when operation complete
      request(app)
        .post(url)
        .send({ email: confirmedUserFixture.email })
        .expect(200)
        .end(done);
    });
  });
});
