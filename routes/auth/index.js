import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import requireAuth from '../../lib/requireAuth';
import login from './login';
import logout from './logout';
import confirm from './confirm';
import reset from './reset';

const router = Router();

router.post('/login', handleRoute(login));
router.post('/reset', handleRoute(reset));
router.post('/logout', requireAuth, handleRoute(logout));
router.get('/confirm', handleRoute(confirm));

export default router;
