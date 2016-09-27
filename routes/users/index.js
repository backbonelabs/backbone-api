import Router from 'express';
import requireAuth from '../../lib/requireAuth';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';
import updateUser from './updateUser';
import updateUserSettings from './updateUserSettings';

const router = Router();

router.post('/', handleRoute(createUser));
router.get('/:id', requireAuth, handleRoute(getUser));
router.post('/:id', requireAuth, handleRoute(updateUser));
router.post('/settings/:id', requireAuth, handleRoute(updateUserSettings));

export default router;
