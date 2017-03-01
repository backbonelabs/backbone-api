import Router from 'express';
import requireSelfAuth from '../../lib/requireSelfAuth';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';
import updateUser from './updateUser';
import updateUserSettings from './updateUserSettings';

const router = Router();

router.post('/', handleRoute(createUser));
router.get('/:id', requireSelfAuth, handleRoute(getUser));
router.post('/:id', requireSelfAuth, handleRoute(updateUser));
router.post('/settings/:id', requireSelfAuth, handleRoute(updateUserSettings));

export default router;
