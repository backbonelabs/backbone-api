import Router from 'express';
import handleRoute from '../../lib/handleRoute';

const router = Router();

// Returns a RegExp of the avaiable versions from .env for node routing
const avaiableVersions = () => {
  const fw = Object.keys(process.env)
               .filter(v => v.match(/BL_LATEST_FIRMWARE_VERSION_/))
               .map(v => `/v${v.match(/\d+/)[0]}$`) // regex: /v1$|v2$|v12$...
               .join('|');
  return new RegExp(fw);
};

// Returns the latest version for the major software version and the file url
// from aws
const handleFirmwareVersions = (req) => {
  const reqVersion = req.url.match(/\d+/);
  const version = process.env[`BL_LATEST_FIRMWARE_VERSION_${reqVersion}`];
  const baseUrl = process.env.BL_FIRMWARE_URL;
  const url = `${baseUrl}Backbone_${version}.cyacd`;

  return { version, url };
};

// Returns information about the latest firmware
router.get('/', handleRoute(() => ({
  version: process.env.BL_LATEST_FIRMWARE_VERSION,
  url: process.env.BL_LATEST_FIRMWARE_URL,
})));

// Route handler for GET request that includes a version number
router.get(avaiableVersions(), handleRoute(handleFirmwareVersions));

export default router;
