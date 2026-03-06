import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma/client';

// [MEDIUM FIX M2] Removed unused 'uuid' import — Prisma handles UUIDs

const MONETAG_SECRET = process.env.MONETAG_SECRET || 'test_secret';

export const requestAd = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const clientIp = req.body.clientIp || 'unknown';

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // [CRITICAL FIX C3] Check for existing PENDING session before creating new one
        // This prevents DB flooding by spamming /request without watching ads
        const existingPending = await prisma.adSession.findFirst({
            where: {
                userId,
                status: 'PENDING'
            },
            orderBy: { createdAt: 'desc' }
        });

        if (existingPending) {
            // Check if the pending session is still within its 120s TTL window
            const sessionAgeMs = Date.now() - existingPending.createdAt.getTime();
            if (sessionAgeMs < 120000) {
                // Reuse the existing valid session
                res.status(200).json({
                    success: true,
                    sessionId: existingPending.sessionId,
                    reused: true
                });
                return;
            } else {
                // Stale PENDING session — mark as REJECTED (user never watched the ad)
                await prisma.adSession.update({
                    where: { sessionId: existingPending.sessionId },
                    data: { status: 'REJECTED' }
                });
            }
        }

        // Create fresh DB Session
        const session = await prisma.adSession.create({
            data: {
                userId,
                ipAddress: clientIp,
                status: 'PENDING'
            }
        });

        // Session is stored in DB — no Redis needed

        res.status(200).json({
            success: true,
            sessionId: session.sessionId
        });
    } catch (error) {
        console.error('Request Ad Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const adNetworkCallback = async (req: Request, res: Response): Promise<void> => {
    try {
        const { custom, uid, reward_event_type } = req.query;

        // Monetag TMA (Telegram Mini Apps) direct links do not provide an HMAC signature.
        // Security relies entirely on the short-lived UUID sessionId matching the user.
        if (!custom || !uid || !reward_event_type) {
            res.status(400).send('Missing parameters');
            return;
        }

        const sessionId = custom as string;
        const userId = uid as string;
        const rewardType = reward_event_type as string;

        const session = await prisma.adSession.findUnique({ where: { sessionId } });

        if (!session || session.status !== 'PENDING' || session.userId !== userId) {
            res.status(400).send('Invalid or already processed session');
            return;
        }

        // Determine if this is a VALUED impression (Monetag sends 'yes' or 'no')
        const isValued = rewardType === 'yes';

        await prisma.$transaction(async (tx: any) => {
            // 1. Mark session as validated
            await tx.adSession.update({
                where: { sessionId },
                data: {
                    status: 'VALIDATED',
                    rewardType: isValued ? 'VALUED' : 'NOT_VALUED',
                    completedAt: new Date()
                }
            });

            // 2. Determine Tier (rolling 24h count)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const adCountToday = await tx.adSession.count({
                where: { userId, status: 'VALIDATED', createdAt: { gte: twentyFourHoursAgo } }
            });

            // 3. Mystery Box Logic
            let goldReward = 0;
            let maxReward = 0;
            const rand = Math.random() * 100;

            if (adCountToday <= 10) {
                goldReward = 500;
            } else if (adCountToday <= 25) {
                if (rand < 90) goldReward = 1000; else maxReward = 1;
            } else if (adCountToday <= 40) {
                if (rand < 80) goldReward = 2500; else maxReward = 5;
            } else {
                if (rand < 90) goldReward = 5000; else if (rand < 99.9) maxReward = 10; else maxReward = 1000;
            }

            // 4. Create Transaction record
            await tx.transaction.create({
                data: {
                    userId,
                    type: 'BOX_OPEN',
                    amount: maxReward > 0 ? maxReward : goldReward,
                    currency: maxReward > 0 ? 'MAX' : 'GOLD',
                    description: `Mystery Box (Ad #${adCountToday})`
                }
            });

            // 5. Update User Balance & Refill Fuel
            const user = await tx.user.update({
                where: { id: userId },
                data: {
                    goldBalance: { increment: goldReward },
                    maxBalance: { increment: maxReward },
                    fuelUpdatedAt: new Date(),
                    lastAdWatch: new Date()
                }
            });

            // 6. Cooldown is enforced by `lastAdWatch` field (set above) — no Redis needed

            // [PHASE 12] Referral payouts moved to convertGoldToMax in economy.controller.ts
            // Referrers now get paid when downlines CONVERT gold → $MAX, not on ad watch
        });

        res.status(200).send('OK');

    } catch (error) {
        console.error('Ad Callback Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

/**
 * [PHASE 11 FIX] Client-side Ad Claim Endpoint
 * Called by the frontend AFTER the Monetag SDK's show() promise resolves.
 * This bypasses the unreliable S2S postback which never arrives in TMA context.
 * Security: JWT-authenticated + PENDING session with matching userId + Redis TTL.
 */
export const claimAdSDK = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { sessionId } = req.body;

        if (!userId || !sessionId) {
            res.status(400).json({ error: 'Missing userId or sessionId' });
            return;
        }

        // Validate the session exists, is PENDING, and belongs to this user
        const session = await prisma.adSession.findUnique({ where: { sessionId } });

        if (!session || session.userId !== userId) {
            res.status(400).json({ error: 'Invalid session' });
            return;
        }

        if (session.status !== 'PENDING') {
            // Already claimed — just return current profile (idempotent)
            res.status(200).json({ success: true, alreadyClaimed: true });
            return;
        }

        // Check DB TTL — session must still be within the 120s window
        const sessionAgeMs = Date.now() - session.createdAt.getTime();
        if (sessionAgeMs > 120000) {
            res.status(400).json({ error: 'Session expired' });
            return;
        }

        // Process the claim (same logic as adNetworkCallback)
        await prisma.$transaction(async (tx: any) => {
            // 1. Mark session as validated
            await tx.adSession.update({
                where: { sessionId },
                data: {
                    status: 'VALIDATED',
                    rewardType: 'VALUED',
                    completedAt: new Date()
                }
            });

            // 2. Determine Tier (rolling 24h count)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const adCountToday = await tx.adSession.count({
                where: { userId, status: 'VALIDATED', createdAt: { gte: twentyFourHoursAgo } }
            });

            // 3. Mystery Box Logic
            let goldReward = 0;
            let maxReward = 0;
            const rand = Math.random() * 100;

            if (adCountToday <= 10) {
                goldReward = 500;
            } else if (adCountToday <= 25) {
                if (rand < 90) goldReward = 1000; else maxReward = 1;
            } else if (adCountToday <= 40) {
                if (rand < 80) goldReward = 2500; else maxReward = 5;
            } else {
                if (rand < 90) goldReward = 5000; else if (rand < 99.9) maxReward = 10; else maxReward = 1000;
            }

            // 4. Create Transaction record
            await tx.transaction.create({
                data: {
                    userId,
                    type: 'BOX_OPEN',
                    amount: maxReward > 0 ? maxReward : goldReward,
                    currency: maxReward > 0 ? 'MAX' : 'GOLD',
                    description: `Mystery Box (Ad #${adCountToday})`
                }
            });

            // 5. Update User Balance & Refill Fuel
            const user = await tx.user.update({
                where: { id: userId },
                data: {
                    goldBalance: { increment: goldReward },
                    maxBalance: { increment: maxReward },
                    fuelUpdatedAt: new Date(),
                    lastAdWatch: new Date()
                }
            });

            // 6. Cooldown is enforced by `lastAdWatch` field (set above) — no Redis needed

            // [PHASE 12] Referral payouts moved to convertGoldToMax in economy.controller.ts
        });

        res.status(200).json({ success: true, message: 'Ad reward claimed successfully' });

    } catch (error) {
        console.error('Claim Ad SDK Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
