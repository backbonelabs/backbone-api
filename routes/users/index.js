import Router from 'express';
import requireAuth from '../../lib/requireAuth';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';
import confirmUser from './confirmUser';
import updateUser from './updateUser';

const router = Router();

router.get('/confirm', handleRoute(confirmUser));
router.get('/:id', requireAuth, handleRoute(getUser));
router.post('/:id', requireAuth, handleRoute(updateUser));
router.post('/', handleRoute(createUser));

export default router;
