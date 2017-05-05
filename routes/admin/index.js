import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import requireAdminAuth from '../../lib/requireAdminAuth';
import login from './login';
import logout from './logout';
import getUsers from './getUsers';
import updateUser from '../users/updateUser';

const router = Router();

router.post('/login', handleRoute(login));
router.post('/logout', handleRoute(logout));
router.get('/users', requireAdminAuth, handleRoute(getUsers));
router.post('/users/:id', requireAdminAuth, handleRoute(updateUser));

export default router;
