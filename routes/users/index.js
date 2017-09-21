import Router from 'express';
import requireSelfAuth from '../../lib/requireSelfAuth';
import handleRoute from '../../lib/handleRoute';
import getUser from './getUser';
import createUser from './createUser';
import updateUser from './updateUser';
import updateUserSettings from './updateUserSettings';
import getUserSessions from './getUserSessions';
import getUserWorkouts from './getUserWorkouts';
import resendEmail from './resendEmail';
import getUserResearchVideos from './getUserResearchVideos';

const router = Router();

router.post('/', handleRoute(createUser));
router.get('/:id', requireSelfAuth, handleRoute(getUser));
router.get('/sessions/:id', requireSelfAuth, handleRoute(getUserSessions));
router.post('/:id', requireSelfAuth, handleRoute(updateUser));
router.post('/settings/:id', requireSelfAuth, handleRoute(updateUserSettings));
router.get('/workouts/:id', requireSelfAuth, handleRoute(getUserWorkouts));
router.post('/send-confirmation-email/:id', requireSelfAuth, handleRoute(resendEmail));
router.get('/researchVideos/:id', requireSelfAuth, handleRoute(getUserResearchVideos));

export default router;
