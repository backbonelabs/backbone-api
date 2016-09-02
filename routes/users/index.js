import Router from 'express';
import requireAuth from '../../lib/requireAuth';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';
import updateUser from './updateUser';
import getUserSettings from './getUserSettings';
import updateUserSettings from './updateUserSettings';
import getUserConfirmed from './getUserConfirmed';

const router = Router();

router.post('/', handleRoute(createUser));
router.get('/:id', requireAuth, handleRoute(getUser));
router.post('/:id', requireAuth, handleRoute(updateUser));
router.get('/settings/:id', requireAuth, handleRoute(getUserSettings));
router.post('/settings/:id', requireAuth, handleRoute(updateUserSettings));
router.get('/confirm/:email', handleRoute(getUserConfirmed));

export default router;
