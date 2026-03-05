import { Router } from 'express';
import { convertGoldToMax, requestWithdrawal, upgradeMiner } from '../controllers/economy.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint for converting Gold -> $MAX token (applies 20% tax)
router.post('/convert', authenticateJWT, convertGoldToMax);

// Endpoint for requesting a on-chain withdrawal (checks 24h cooldown)
router.post('/withdraw', authenticateJWT, requestWithdrawal);

// Endpoint for upgrading miner level
router.post('/upgrade', authenticateJWT, upgradeMiner);

export default router;
