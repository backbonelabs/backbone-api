import Router from 'express';
import handleRoute from '../../lib/handleRoute';

const router = Router();

// Retuns the latest version for a specific version and the file url
const handleFirmwareVersions = (req) => {
  // Extracts requested version from URL
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

// Returns information for a specific firmware version from URL
router.get(/v\d+/, handleRoute(handleFirmwareVersions));

export default router;
