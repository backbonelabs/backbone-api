import Router from 'express';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';

const router = Router();

router.get('/:id', handleRoute(getUser));
router.post('/', handleRoute(createUser));

export default router;
