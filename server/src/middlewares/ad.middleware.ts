import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { prisma } from '../prisma/client';

export const validateAdRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
            || req.socket.remoteAddress
            || 'unknown';

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        /* 
         * GATE #2: IP CHECK (Anti-Sybil)
         * [HIGH FIX H2] Check count BEFORE adding. Only add if under limit.
         */
        if (clientIp !== 'unknown') {
            const ipKey = `ip_users:${clientIp}`;

            // Check existing count FIRST
            const currentCount = await redis.scard(ipKey);

            // If at limit and this user is NOT already in the set, block them
            if (currentCount >= 3) {
                const isMember = await redis.sismember(ipKey, userId);
                if (!isMember) {
                    console.warn(`[GATE #2 FAILED] IP ${clientIp} has ${currentCount} users. Blocking new user ${userId}.`);
                    return res.status(403).json({ error: 'Too many accounts from this IP. Sybil protection active.' });
                }
            }

            // Safe to add (either under limit, or user already exists in set)
            await redis.sadd(ipKey, userId);
            await redis.expire(ipKey, 86400);
        }

        /*
         * GATE #3: RATE LIMITING & COOLDOWN
         */
        const cooldownKey = `ad_cooldown:${userId}`;
        const lastRequestStr = await redis.get(cooldownKey);

        if (lastRequestStr) {
            const timeSinceLast = Date.now() - parseInt(lastRequestStr, 10);
            if (timeSinceLast < 840000) {
                return res.status(429).json({
                    error: 'Fuel not empty. Wait for fuel depletion before refueling.',
                    remainingSeconds: Math.ceil((840000 - timeSinceLast) / 1000)
                });
            }
        }

        // Rolling 24h check against Postgres
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const adCountToday = await prisma.adSession.count({
            where: {
                userId,
                status: 'VALIDATED',
                createdAt: { gte: twentyFourHoursAgo }
            }
        });

        if (adCountToday >= 50) {
            return res.status(403).json({ error: 'Daily Limit Reached (Max 50 Ads / 24h).' });
        }

        req.body.clientIp = clientIp;
        next();
    } catch (error) {
        console.error('Validation Gate Error:', error);
        res.status(500).json({ error: 'Internal server error during validation' });
    }
};
