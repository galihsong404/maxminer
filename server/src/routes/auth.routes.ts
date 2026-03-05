import { Router } from 'express';
import { authenticateTelegram } from '../controllers/auth.controller';

const router = Router();

// Endpoint for Telegram Mini App authentication
router.post('/telegram', authenticateTelegram);

export default router;
