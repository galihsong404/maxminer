import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';

export const requireNotBanned = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isBanned: true, fraudScore: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Auto-ban logic: if fraud score crosses threshold, ban them now
        if (!user.isBanned && user.fraudScore >= 5) {
            await prisma.user.update({
                where: { id: userId },
                data: { isBanned: true }
            });
            console.warn(`[ANTI-CHEAT] User ${userId} auto-banned. Fraud Score: ${user.fraudScore}`);
            return res.status(403).json({ error: 'Account suspended due to suspicious activity.' });
        }

        if (user.isBanned) {
            return res.status(403).json({ error: 'Account suspended.' });
        }

        next();
    } catch (error) {
        console.error('Anti-Cheat Middleware Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
