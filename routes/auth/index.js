import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import requireAuth from '../../lib/requireAuth';
import login from './login';
import logout from './logout';

const router = Router();

router.post('/login', handleRoute(login));
router.post('/logout', requireAuth, handleRoute(logout));

export default router;
