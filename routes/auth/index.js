import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import login from './login';

const router = Router();

router.post('/login', handleRoute(login));

export default router;
