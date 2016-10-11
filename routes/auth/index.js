import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import requireAuth from '../../lib/requireAuth';
import login from './login';
import logout from './logout';
import reset from './reset';
import confirmEmail from './confirmEmail';
import confirmPassword from './confirmPassword';

const router = Router();

router.post('/login', handleRoute(login));
router.post('/logout', requireAuth, handleRoute(logout));
router.post('/reset', handleRoute(reset));
router.get('/confirm/email', handleRoute(confirmEmail));
router.get('/confirm/password', handleRoute(confirmPassword));

export default router;
