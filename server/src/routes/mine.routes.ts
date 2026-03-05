import { Router, Request, Response, NextFunction } from 'express';
import { syncMining } from '../controllers/mine.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireNotBanned } from '../middlewares/antiCheat.middleware';
import { redis } from '../config/redis';

// [HIGH FIX H1] Rate limiter for mine/sync — max 1 request per 5 seconds per user
const mineSyncRateLimit = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.sendStatus(401);

    const key = `mine_sync_rl:${userId}`;
    const exists = await redis.exists(key);

    if (exists) {
        return res.status(429).json({ error: 'Sync too fast. Max 1 sync per 5 seconds.' });
    }

    await redis.set(key, '1', 'EX', 5);
    next();
};

const router = Router();

router.post('/sync', authenticateJWT, requireNotBanned, mineSyncRateLimit, syncMining);

export default router;
