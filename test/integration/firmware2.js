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
    it('response with JSON of latest firmware', (done) => {
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
          })
          .then();
      });
      Promise.all(promises).then(() => {
        done();
      }).catch(reason => done(reason));
    });
  });
});
