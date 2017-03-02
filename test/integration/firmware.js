import request from 'supertest';
import { MongoClient } from 'mongodb';
import server from '../../index';

let app;

before(() => Promise.resolve(server)
  .then((expressApp) => {
    app = expressApp;
  })
  .then(() => MongoClient.connect(process.env.BL_DATABASE_URL)),
);

describe('/firmware router', () => {
  describe('GET /', () => {
    const url = '/firmware';
    it('should return the latest firmware details', (done) => {
      request(app)
        .get(url)
        .send({})
        .expect(200)
        .expect({
          version: process.env.BL_LATEST_FIRMWARE_VERSION,
          url: process.env.BL_LATEST_FIRMWARE_URL,
        }, done);
    });
  });
});
