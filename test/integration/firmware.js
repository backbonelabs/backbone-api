import request from 'supertest';
import { MongoClient } from 'mongodb';
import server from '../../index';

let app;

describe('/firmware router', () => {
  before(() => Promise.resolve(server)
    .then((expressApp) => {
      app = expressApp;
    })
    .then(() => MongoClient.connect(process.env.BL_DATABASE_URL)),
  );

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
  describe('GET /vX', () => {
    it('should return the latest firmware details', () => {
      const baseUrl = '/firmware/v';
      const baseFileUrl = process.env.BL_FIRMWARE_URL;
      const firmwareVersions = Object.keys(process.env)
                                 .filter(v => /BL_LATEST_FIRMWARE_VERSION_/.test(v));
      const promises = firmwareVersions.map((v) => {
        const firmware = process.env[v];
        const majorSoftwareVersion = firmware.split('.')[2];
        const testUrl = `${baseUrl}${majorSoftwareVersion}`;
        const fileUrl = `${baseFileUrl}Backbone_${firmware}.cyacd`;
        return request(app)
          .get(testUrl)
          .send({})
          .expect(200)
          .expect({
            version: firmware,
            url: fileUrl,
          });
      });
      return Promise.all(promises);
    });
  });
  describe('GET /vY', () => {
    it('should return 404 not found for unknown firmware versions', (done) => {
      request(app)
        .get('/firmware/v1234')
        .send({})
        .expect(404, done);
    });
  });
});
