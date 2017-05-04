import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import requireAuth from '../../lib/requireAuth';
import login from './login';
import logout from './logout';
import passwordReset from './passwordReset';
import passwordResetToken from './passwordResetToken';
import confirmEmail from './confirmEmail';
import confirmPassword from './confirmPassword';
import fbLogin from './fbLogin';

const router = Router();

router.post('/login', handleRoute(login));
router.post('/logout', requireAuth, handleRoute(logout));
router.post('/fbLogin', handleRoute(fbLogin));
router.post('/password-reset-token', handleRoute(passwordResetToken));
router.post('/password-reset', handleRoute(passwordReset));
router.get('/confirm/email', handleRoute(confirmEmail));
router.get('/confirm/password', handleRoute(confirmPassword));

export default router;
