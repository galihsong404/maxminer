import { Router } from 'express';
import { getProfile, getReferrals } from '../controllers/user.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/profile', authenticateJWT, getProfile);
router.get('/referrals', authenticateJWT, getReferrals);

export default router;
