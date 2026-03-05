import { Request, Response } from 'express';
import { prisma } from '../prisma/client';

const MINER_LEVEL_CONFIG: Record<number, { goldPerHr: number }> = {
    1: { goldPerHr: 20000 },
    2: { goldPerHr: 32000 },
    3: { goldPerHr: 48000 },
    4: { goldPerHr: 72000 },
    5: { goldPerHr: 100000 },
    6: { goldPerHr: 140000 },
    7: { goldPerHr: 200000 },
    8: { goldPerHr: 300000 },
    9: { goldPerHr: 440000 },
    10: { goldPerHr: 640000 },
};

// [CRITICAL FIX C1] Custom error class to safely abort transactions without res-after-send
class MineError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const syncMining = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { claimedGold, lastSyncTimestamp } = req.body;

        if (!userId || typeof claimedGold !== 'number' || typeof lastSyncTimestamp !== 'number') {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }

        // [FIX C1] Reject negative gold claims
        if (claimedGold <= 0 || !Number.isFinite(claimedGold)) {
            res.status(400).json({ error: 'Invalid gold amount' });
            return;
        }

        const now = Date.now();
        if (lastSyncTimestamp > now + 5000) {
            res.status(400).json({ error: 'Invalid timestamp' });
            return;
        }

        // [CRITICAL FIX C1] All DB logic inside transaction, errors thrown not res'd
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    minerLevel: true,
                    fuelUpdatedAt: true,
                    fraudScore: true
                }
            });

            if (!user) {
                throw new MineError('User not found', 404);
            }

            const fuelStartMs = user.fuelUpdatedAt.getTime();
            const fuelExpiryMs = fuelStartMs + (15 * 60 * 1000);
            const maxValidMineToMs = Math.min(now, fuelExpiryMs);

            if (maxValidMineToMs <= lastSyncTimestamp) {
                throw new MineError('Fuel depleted', 403);
            }

            let elapsedSeconds = (maxValidMineToMs - lastSyncTimestamp) / 1000;
            if (elapsedSeconds < 0) elapsedSeconds = 0;
            if (elapsedSeconds > 16 * 60) elapsedSeconds = 15 * 60;

            const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
            const adCountToday = await tx.adSession.count({
                where: { userId, status: 'VALIDATED', createdAt: { gte: twentyFourHoursAgo } }
            });

            // Calculate active downlines (L1 referrals) for "Referral Power" speed boost (5% per ref)
            const activeRefsCount = await tx.user.count({
                where: { referrerId: userId }
            });
            const refPowerMultiplier = 1.0 + (activeRefsCount * 0.05);

            let adMultiplier = 1.0;
            if (adCountToday >= 40) adMultiplier = 2.0;
            else if (adCountToday >= 25) adMultiplier = 1.5;
            else if (adCountToday >= 10) adMultiplier = 1.2;

            const totalMultiplier = adMultiplier * refPowerMultiplier;

            const levelConfig = MINER_LEVEL_CONFIG[user.minerLevel] || MINER_LEVEL_CONFIG[1];
            const baseGoldPerSecond = levelConfig.goldPerHr / 3600;
            const maxTheoreticalGold = Math.ceil((baseGoldPerSecond * totalMultiplier * elapsedSeconds) * 1.02)
                + Math.ceil(baseGoldPerSecond * totalMultiplier * 5);

            let finalGoldToAdd = claimedGold;
            let incrementFraud = false;

            if (claimedGold > maxTheoreticalGold) {
                console.warn(`[SPEEDHACK] User ${userId} claimed ${claimedGold}g max=${maxTheoreticalGold}g`);
                finalGoldToAdd = maxTheoreticalGold;
                incrementFraud = true;
            }

            await tx.user.update({
                where: { id: userId },
                data: {
                    goldBalance: { increment: Math.floor(finalGoldToAdd) },
                    fraudScore: incrementFraud ? { increment: 1 } : undefined
                }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    type: 'GOLD_MINE',
                    amount: Math.floor(finalGoldToAdd),
                    currency: 'GOLD',
                    description: `Sync: ${elapsedSeconds.toFixed(1)}s`
                }
            });

            return { goldAdded: Math.floor(finalGoldToAdd) };
        });

        // [FIX C1] Response ONLY sent here, outside the transaction
        res.status(200).json({ success: true, serverTime: now, goldAdded: result.goldAdded });

    } catch (error: any) {
        console.error('Mine Sync Error:', error);
        if (!res.headersSent) {
            const statusCode = error instanceof MineError ? error.statusCode : 500;
            res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
        }
    }
};
