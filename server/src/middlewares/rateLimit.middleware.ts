import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

export const rateLimit = (options: { windowMs: number, max: number }) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
                || req.socket.remoteAddress
                || 'unknown_ip';

            // Prefix the key with the path and IP
            const key = `rl:${req.path}:${ip}`;

            // Increment the counter
            const currentCount = await redis.incr(key);

            // If it's the first request, set the expiry window
            if (currentCount === 1) {
                await redis.pexpire(key, options.windowMs);
            }

            // Check if the limit has been exceeded
            if (currentCount > options.max) {
                return res.status(429).json({
                    error: 'Too many requests, please try again later.'
                });
            }

            next();
        } catch (error) {
            console.error('Rate Limit Error:', error);
            // Fail open if Redis is down, so we don't block legitimate traffic
            next();
        }
    };
};
