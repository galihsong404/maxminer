import { Router } from 'express';
import { getProfile } from '../controllers/user.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Protect ALL user routes
router.use(authenticateJWT);

router.get('/profile', getProfile);

export default router;
