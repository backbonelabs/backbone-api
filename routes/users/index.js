import Router from 'express';
import requireAuth from '../../lib/requireAuth';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';
import updateUser from './updateUser';
import checkConfirmation from './checkConfirmation';
import resendConfirmation from './resendConfirmation';

const router = Router();

router.get('/:id', requireAuth, handleRoute(getUser));
router.get('/confirm/:email', handleRoute(checkConfirmation));
router.post('/', handleRoute(createUser));
router.post('/resend', handleRoute(resendConfirmation));
router.post('/:id', requireAuth, handleRoute(updateUser));

export default router;
