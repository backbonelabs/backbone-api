import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import requireAuth from '../../lib/requireAuth';
import login from './login';
import logout from './logout';
import verify from './verify';

const router = Router();

router.post('/login', handleRoute(login));
router.post('/logout', requireAuth, handleRoute(logout));
router.post('/verify', handleRoute(verify));

export default router;
