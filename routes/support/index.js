import Router from 'express';
import requireAuth from '../../lib/requireAuth';
import handleRoute from '../../lib/handleRoute';
import createTicket from './createTicket';

const router = Router();

router.post('/', requireAuth, handleRoute(createTicket));

export default router;
