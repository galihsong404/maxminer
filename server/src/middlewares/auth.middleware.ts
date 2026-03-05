import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

// Extend Express Request to include user data
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                isPremium: boolean;
                telegramUsername?: string;
                iat?: number;
            };
        }
    }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.sendStatus(401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    // [HIGH FIX H4] Use promise-based verify for cleaner error handling
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Validate the decoded payload has required fields
        if (!decoded || !decoded.id || typeof decoded.id !== 'string') {
            return res.status(403).json({ error: 'Invalid token payload' });
        }

        req.user = {
            id: decoded.id,
            isPremium: decoded.isPremium === true,
            telegramUsername: decoded.telegramUsername,
            iat: decoded.iat
        };

        next();
    } catch (err) {
        // jwt.verify throws on expired/invalid tokens
        return res.status(403).json({ error: 'Token expired or invalid' });
    }
};
