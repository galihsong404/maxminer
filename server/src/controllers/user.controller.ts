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
                id: true, // [FAST FIX] Expose ID to frontend to fix undefined invite links
                role: true, // [ADMIN FIX] Ensure role is fetched
                minerLevel: true,
                goldBalance: true,
                maxBalance: true,
                fuelUpdatedAt: true,
                // @ts-ignore
                lastSyncAt: true,
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

        // [PHASE 14.1 - SILENT HARVEST]
        // If a session has ended (isFuelDepleted) and there's unclaimed gold from that session, 
        // automatically "harvest" it into the Gold Vault so user doesn't lose it if they forget to manual claim.
        let finalGoldBalance = profile.goldBalance;
        let finalLastSyncAt = profile.lastSyncAt;

        if (isFuelDepleted) {
            const fuelStartMs = profile.fuelUpdatedAt.getTime();
            const miningWindowEndMs = fuelStartMs + (FUEL_DURATION_SECONDS * 1000);
            // @ts-ignore
            const lastSyncMs = profile.lastSyncAt ? profile.lastSyncAt.getTime() : fuelStartMs;

            const claimStartMs = Math.max(lastSyncMs, fuelStartMs);
            const claimEndMs = Math.min(now.getTime(), miningWindowEndMs);

            if (claimEndMs > claimStartMs) {
                const earnedSeconds = (claimEndMs - claimStartMs) / 1000;
                const levelConfigs = [
                    { level: 1, goldPerHr: 20000 }, { level: 2, goldPerHr: 32000 },
                    { level: 3, goldPerHr: 48000 }, { level: 4, goldPerHr: 72000 },
                    { level: 5, goldPerHr: 100000 }, { level: 6, goldPerHr: 140000 },
                    { level: 7, goldPerHr: 200000 }, { level: 8, goldPerHr: 300000 },
                    { level: 9, goldPerHr: 440000 }, { level: 10, goldPerHr: 640000 }
                ];
                const cfg = levelConfigs[profile.minerLevel - 1] || levelConfigs[0];
                const goldPerSec = cfg.goldPerHr / 3600;
                const goldEarned = Math.floor(earnedSeconds * goldPerSec * multiplier);

                if (goldEarned > 0) {
                    const updatedUser = await prisma.user.update({
                        where: { id: userId },
                        data: {
                            goldBalance: { increment: BigInt(goldEarned) },
                            // @ts-ignore
                            lastSyncAt: new Date(miningWindowEndMs)
                        }
                    });
                    finalGoldBalance = updatedUser.goldBalance;
                    finalLastSyncAt = updatedUser.lastSyncAt;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                id: profile.id, // [HOTFIX] Expose ID to frontend to fix undefined invite links
                role: (String(profile.id) === '742625427' || String(profile.id) === '74262542') ? 'SUPER_ADMIN' : profile.role, // [ADMIN FIX] Master override and sync
                // @ts-ignore
                lastSyncAt: finalLastSyncAt,
                minerLevel: profile.minerLevel,
                goldBalance: finalGoldBalance.toString(),
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

export const getReferrals = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // [VIP FEATURE] Fetch Level 1 (Direct Downlines)
        const level1Users = await prisma.user.findMany({
            where: { referrerId: userId },
            select: { id: true, telegramUsername: true, minerLevel: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });

        const usersByLevel: any[][] = [level1Users, [], [], [], []];

        // Iteratively fetch L2 to L5 in optimized batches
        for (let i = 0; i < 4; i++) {
            const parentIds = usersByLevel[i].map(u => u.id);
            if (parentIds.length === 0) break;

            usersByLevel[i + 1] = await prisma.user.findMany({
                where: { referrerId: { in: parentIds } },
                select: { id: true, telegramUsername: true, minerLevel: true, createdAt: true },
                orderBy: { createdAt: 'desc' }
            });
        }

        // Formatter: Hide raw ID, prioritize Username
        const formatUser = (u: any) => ({
            username: u.telegramUsername ? `@${u.telegramUsername.replace(/^@+/, '')}` : `Miner_${u.id.substring(0, 4)}`,
            minerLevel: u.minerLevel,
            joinedAt: u.createdAt
        });

        res.status(200).json({
            success: true,
            data: {
                level1: usersByLevel[0].map(formatUser),
                level2: usersByLevel[1].map(formatUser),
                level3: usersByLevel[2].map(formatUser),
                level4: usersByLevel[3].map(formatUser),
                level5: usersByLevel[4].map(formatUser),
                stats: {
                    totalLevel1: usersByLevel[0].length,
                    totalLevel2: usersByLevel[1].length,
                    totalLevel3: usersByLevel[2].length,
                    totalLevel4: usersByLevel[3].length,
                    totalLevel5: usersByLevel[4].length
                }
            }
        });
    } catch (error) {
        console.error('Referral Fetch Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
