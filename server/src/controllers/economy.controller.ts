import { Request, Response } from 'express';
import { prisma } from '../prisma/client';

// [CRITICAL FIX C2/C5] Custom error to safely abort transactions
class EconomyError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

// [CRITICAL FIX C4] Validate EVM wallet address format
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const convertGoldToMax = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { goldAmount } = req.body;

        // [CRITICAL FIX C2] Strict input validation
        if (!userId || typeof goldAmount !== 'number') {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }

        // Must be a positive integer, minimum 1000
        if (!Number.isInteger(goldAmount) || goldAmount < 1000) {
            res.status(400).json({ error: 'goldAmount must be a positive integer (minimum 1000)' });
            return;
        }

        // [CRITICAL FIX C2/C5] All logic in transaction, response outside
        const result = await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { goldBalance: true, referrerId: true }
            });

            if (!user) {
                throw new EconomyError('User not found', 404);
            }

            if (user.goldBalance < BigInt(goldAmount)) {
                throw new EconomyError('Insufficient Gold Balance', 400);
            }

            const netMaxTokens = (goldAmount / 1000) * 0.8;

            await tx.user.update({
                where: { id: userId },
                data: {
                    goldBalance: { decrement: goldAmount },
                    maxBalance: { increment: netMaxTokens }
                }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    type: 'CONVERT',
                    amount: netMaxTokens,
                    currency: 'MAX',
                    description: `Converted ${goldAmount} Gold (-20% Tax)`
                }
            });

            // [PHASE 12] Referral Payout — triggered on CONVERSION, not on ad watch
            // Upline chain (up to 5 levels) receives a % of converted $MAX as bonus
            if (user.referrerId) {
                let currentReferrerId: string | null = user.referrerId;
                const payoutLevels = [5.0, 2.5, 1.0, 0.5, 0.5]; // L1→L5

                for (let i = 0; i < 5 && currentReferrerId; i++) {
                    const payoutMax = payoutLevels[i];

                    await tx.user.update({
                        where: { id: currentReferrerId },
                        data: { maxBalance: { increment: payoutMax } }
                    });

                    await tx.transaction.create({
                        data: {
                            userId: currentReferrerId,
                            type: 'REFERRAL_PAYOUT',
                            amount: payoutMax,
                            currency: 'MAX',
                            description: `L${i + 1} Referral bonus from ${userId} conversion`
                        }
                    });

                    const parentData: any = await tx.user.findUnique({
                        where: { id: currentReferrerId },
                        select: { referrerId: true }
                    });
                    currentReferrerId = parentData?.referrerId ?? null;
                }
            }

            return { netMaxReceived: netMaxTokens };
        });

        res.status(200).json({ success: true, netMaxReceived: result.netMaxReceived });

    } catch (error: any) {
        console.error('Convert Error:', error);
        if (!res.headersSent) {
            const statusCode = error instanceof EconomyError ? error.statusCode : 500;
            res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
        }
    }
};

export const requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { amount, walletAddress } = req.body;

        if (!userId || typeof amount !== 'number' || typeof walletAddress !== 'string') {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }

        // [CRITICAL FIX C4] Validate wallet address format
        if (!EVM_ADDRESS_REGEX.test(walletAddress)) {
            res.status(400).json({ error: 'Invalid wallet address. Must be a valid EVM address (0x + 40 hex chars).' });
            return;
        }

        // Must be integer and minimum 1000
        if (!Number.isInteger(amount) || amount < 1000) {
            res.status(400).json({ error: 'Minimum withdrawal is 1,000 $MAX (integer only)' });
            return;
        }

        // [CRITICAL FIX C5] All logic in transaction, response outside
        const result = await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { maxBalance: true, lastWithdrawAt: true }
            });

            if (!user) throw new EconomyError('User not found', 404);

            // 24-Hour Cooldown
            if (user.lastWithdrawAt) {
                const msSinceLast = Date.now() - user.lastWithdrawAt.getTime();
                if (msSinceLast < 24 * 60 * 60 * 1000) {
                    const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - msSinceLast) / 3600000);
                    throw new EconomyError(`Withdrawal cooldown active. Try again in ~${remainingHours}h.`, 429);
                }
            }

            const WITHDRAWAL_FEE = 100;
            const totalRequired = amount + WITHDRAWAL_FEE;

            if (Number(user.maxBalance) < totalRequired) {
                throw new EconomyError(`Insufficient $MAX (need ${totalRequired}, including ${WITHDRAWAL_FEE} fee)`, 400);
            }

            await tx.user.update({
                where: { id: userId },
                data: {
                    maxBalance: { decrement: totalRequired },
                    lastWithdrawAt: new Date()
                }
            });

            await tx.withdrawal.create({
                data: {
                    userId,
                    amount: amount,
                    fee: WITHDRAWAL_FEE,
                    walletAddress,
                    status: 'PENDING'
                }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    type: 'WITHDRAW',
                    amount: -totalRequired,
                    currency: 'MAX',
                    description: `Withdraw to ${walletAddress} (Fee: ${WITHDRAWAL_FEE})`
                }
            });

            return { message: 'Withdrawal submitted', netAmount: amount, fee: WITHDRAWAL_FEE };
        });

        res.status(200).json({ success: true, ...result });

    } catch (error: any) {
        console.error('Withdraw Error:', error);
        if (!res.headersSent) {
            const statusCode = error instanceof EconomyError ? error.statusCode : 500;
            res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
        }
    }
};

const levels = [
    { level: 1, cost: 0, goldPerHr: 20000 },
    { level: 2, cost: 50000, goldPerHr: 32000 },
    { level: 3, cost: 150000, goldPerHr: 48000 },
    { level: 4, cost: 400000, goldPerHr: 72000 },
    { level: 5, cost: 1000000, goldPerHr: 100000 },
    { level: 6, cost: 2500000, goldPerHr: 140000 },
    { level: 7, cost: 6000000, goldPerHr: 200000 },
    { level: 8, cost: 15000000, goldPerHr: 300000 },
    { level: 9, cost: 40000000, goldPerHr: 440000 },
    { level: 10, cost: 100000000, goldPerHr: 640000 },
];

export const upgradeMiner = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const result = await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { goldBalance: true, minerLevel: true }
            });

            if (!user) throw new EconomyError('User not found', 404);

            const nextLevel = user.minerLevel + 1;
            if (nextLevel > 10) {
                throw new EconomyError('Already at max level', 400);
            }

            const nextLevelConfig = levels.find(l => l.level === nextLevel);
            if (!nextLevelConfig) throw new EconomyError('Level config not found', 500);

            const cost = nextLevelConfig.cost;
            if (user.goldBalance < BigInt(cost)) {
                throw new EconomyError(`Insufficient Gold to upgrade. Need ${cost}.`, 400);
            }

            await tx.user.update({
                where: { id: userId },
                data: {
                    goldBalance: { decrement: cost },
                    minerLevel: nextLevel
                }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    type: 'UPGRADE',
                    amount: cost,
                    currency: 'GOLD',
                    description: `Upgraded to Level ${nextLevel}`
                }
            });

            return { newLevel: nextLevel, costDeducted: cost };
        });

        res.status(200).json({ success: true, ...result });

    } catch (error: any) {
        console.error('Upgrade Error:', error);
        if (!res.headersSent) {
            const statusCode = error instanceof EconomyError ? error.statusCode : 500;
            res.status(statusCode).json({ error: error.message || 'Internal Server Error' });
        }
    }
};
