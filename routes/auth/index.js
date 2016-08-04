import Router from 'express';
import verify from './verify';

const router = Router();

router.post('/', verify);

export default router;
