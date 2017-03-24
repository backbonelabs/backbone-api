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
      for(var key in process.env) {
        if(/BL_LATEST_FIRMWARE_VERSION_/.test(key)) {
          const baseUrl = '/firmware/v';
          const firmware = process.env[key];
          const majorSoftwareVersion = firmware.split('.')[2];
          const testUrl = `${baseUrl}${majorSoftwareVersion}`;
          const baseFileUrl = process.env.BL_FIRMWARE_URL;
          const fileUrl = `${baseFileUrl}Backbone_${firmware}.cyacd`;
          request(app)
            .get(testUrl)
            .send({})
            .expect(200)
            .expect({
              version: process.env[key],
              url: fileUrl,
            });
        }
      }
      done();
    });
  });
});
