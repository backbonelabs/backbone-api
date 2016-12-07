import Router from 'express';
import handleRoute from '../../lib/handleRoute';

const router = Router();

// Returns information about the latest firmware
router.get('/', handleRoute(() => ({
  version: process.env.BL_LATEST_FIRMWARE_VERSION,
  url: process.env.BL_LATEST_FIRMWARE_URL,
})));

export default router;
