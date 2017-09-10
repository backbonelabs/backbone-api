import Router from 'express';
import requireAuth from '../../lib/requireAuth';
import handleRoute from '../../lib/handleRoute';
import createTicket from './createTicket';
import resendEmail from './resendEmail';

const router = Router();

router.post('/', requireAuth, handleRoute(createTicket));
router.post('/resend-email', requireAuth, handleRoute(resendEmail));

export default router;
