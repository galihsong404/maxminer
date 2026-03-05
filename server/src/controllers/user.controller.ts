import { Request, Response } from 'express';
import { prisma } from '../prisma/client';

const FUEL_DURATION_SECONDS = 900; // 15 minutes

export const getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const profile = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                minerLevel: true,
                goldBalance: true,
                maxBalance: true,
                fuelUpdatedAt: true,
                lastAdWatch: true,
                lastWithdrawAt: true,
                createdAt: true
            }
        });

        if (!profile) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // [HIGH FIX #1] Calculate fuel remaining SERVER-SIDE (not frontend-trusted)
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - profile.fuelUpdatedAt.getTime()) / 1000);
        const fuelRemaining = Math.max(0, FUEL_DURATION_SECONDS - elapsedSeconds);
        const isFuelDepleted = fuelRemaining === 0;

        // [CRITICAL FIX #4] Rolling 24h ad count from AdSession table instead of stored counter
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const adCountToday = await prisma.adSession.count({
            where: {
                userId: userId,
                status: 'VALIDATED',
                createdAt: { gte: twentyFourHoursAgo }
            }
        });

        // Determine Tier based on rolling 24h ad count
        let tierName = 'BRONZE';
        let multiplier = 1.0;

        if (adCountToday >= 40) { tierName = 'DIAMOND'; multiplier = 2.0; }
        else if (adCountToday >= 25) { tierName = 'GOLD'; multiplier = 1.5; }
        else if (adCountToday >= 10) { tierName = 'SILVER'; multiplier = 1.2; }

        res.status(200).json({
            success: true,
            data: {
                minerLevel: profile.minerLevel,
                goldBalance: profile.goldBalance.toString(),
                maxBalance: profile.maxBalance,
                fuel: {
                    remainingSeconds: fuelRemaining,
                    isDepleted: isFuelDepleted,
                    lastUpdated: profile.fuelUpdatedAt
                },
                ads: {
                    todayCount: adCountToday,
                    maxDaily: 50,
                    canRefuel: isFuelDepleted && adCountToday < 50,
                    tier: tierName,
                    multiplier: multiplier
                },
                withdrawal: {
                    lastWithdrawAt: profile.lastWithdrawAt,
                    canWithdraw: !profile.lastWithdrawAt ||
                        (now.getTime() - profile.lastWithdrawAt.getTime()) > 24 * 60 * 60 * 1000
                }
            }
        });
    } catch (error) {
        console.error('Profile Fetch Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
