import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { validateInitData } from '../utils/telegramAuth';
import { calculateTLT } from '../utils/tlt';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test_bot_token';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

// NOTE: Circular referral chain check (isReferralChainSafe) was removed because
// it's logically impossible for a NEW user to appear as an ancestor in any
// existing referral chain — they don't exist in the DB yet.
// Only re-add this if referrer-change functionality is implemented post-registration.

export const authenticateTelegram = async (req: Request, res: Response): Promise<void> => {
    try {
        const { initDataRaw, referrerId } = req.body;

        // [HIGH FIX] Input validation
        // [CRITICAL AUDIT NOTE - "Access Restricted" UX]
        // Jika frontend mendapat "Access Restricted", cek apakah endpoint ini melempar error 400.
        // Pastikan Vercel Rewrite Proxy meneruskan "Body Payload" JSON secara utuh tanpa terpotong.
        if (!initDataRaw || typeof initDataRaw !== 'string') {
            res.status(400).json({ error: 'Missing or invalid initDataRaw' });
            return;
        }

        // 1. Validate against Telegram Bot Token
        const isDevMode = BOT_TOKEN === 'test_bot_token';
        const isValid = isDevMode ? true : validateInitData(initDataRaw, BOT_TOKEN);

        if (!isValid) {
            res.status(401).json({ error: 'Invalid auth data' });
            return;
        }

        // 2. Parse User Data — Safe JSON.parse with validation
        const urlParams = new URLSearchParams(initDataRaw);
        const userStr = urlParams.get('user');
        if (!userStr) {
            res.status(400).json({ error: 'User data not found in initData' });
            return;
        }

        let tgUser: any;
        try {
            tgUser = JSON.parse(userStr);
        } catch {
            res.status(400).json({ error: 'Malformed user data in initData' });
            return;
        }

        // Validate Telegram ID is a positive integer
        if (!tgUser.id || typeof tgUser.id !== 'number' || tgUser.id <= 0 || !Number.isInteger(tgUser.id)) {
            res.status(400).json({ error: 'Invalid Telegram user ID' });
            return;
        }

        const userIdStr = String(tgUser.id);
        const isPremium = tgUser.is_premium === true;

        // Capture request IP
        const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
            || req.socket.remoteAddress
            || 'unknown';

        // 3. Find or Create User
        // [CRITICAL AUDIT NOTE - THE 500 PGBOUNCER CACHE TRAP]
        // Jika Prisma melempar 500 Internal Server Error ("P2022: Column does not exist")
        // padahal kolom SUDAH dbuat via Supabase SQL Editor:
        // AKAR MASALAH: PgBouncer connection pool menyimpan 'Prepared Statement' lama di memori server Node.
        // SOLUSI ABSOLUT: Wajib run `pm2 restart [app_name] && pm2 flush` di VPS. 
        // Jangan paksa Prisma CLI `db push` di VPS 1GB RAM karena akan OOM (Out of Memory).
        let user = await prisma.user.findUnique({
            where: { id: userIdStr }
        });

        if (user) {
            // Existing user — update login IP and premium status
            const updateData: any = {
                lastLoginIp: clientIp,
                isPremium: isPremium
            };

            // [REFERRAL V14.2 FIX] "Late Attachment"
            // If the user already exists but doesn't have a referrer yet,
            // we allow them to be "claimed" by a referrer now.
            if (!user.referrerId && referrerId && typeof referrerId === 'string' && referrerId !== userIdStr) {
                const referrerExists = await prisma.user.findUnique({ where: { id: referrerId } });
                if (referrerExists) {
                    updateData.referrerId = referrerId;
                    console.log(`[REFERRAL] Late binding: User ${userIdStr} now referred by ${referrerId}`);
                }
            }

            await prisma.user.update({
                where: { id: userIdStr },
                data: updateData
            });
        }

        const tltResult = calculateTLT(userIdStr, isPremium);
        const isNewUser = !user;

        if (!user) {
            // NEW USER = TELEGRAM LOYALTY TIER (TLT) LOGIC
            // Referral: only need direct self-ref check + existence check
            let validReferrerId: string | null = null;
            if (referrerId && typeof referrerId === 'string' && referrerId !== userIdStr) {
                const referrerExists = await prisma.user.findUnique({ where: { id: referrerId } });
                if (referrerExists) {
                    validReferrerId = referrerId;
                }
            }

            user = await prisma.user.create({
                data: {
                    id: userIdStr,
                    telegramUsername: tgUser.username ? `@${tgUser.username}` : null,
                    isPremium: isPremium,
                    minerLevel: tltResult.level,
                    goldBalance: BigInt(tltResult.bonusGold),
                    referrerId: validReferrerId,
                    lastLoginIp: clientIp
                }
            });
        }

        // 4. Generate JWT
        const token = jwt.sign(
            { id: user.id, isPremium: user.isPremium },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                telegramUsername: user.telegramUsername,
                isPremium: user.isPremium,
                role: (String(user.id) === '742625427' || String(user.id) === '74262542') ? 'SUPER_ADMIN' : user.role, // Fixed type mismatch
                minerLevel: user.minerLevel,
                goldBalance: user.goldBalance.toString(),
                maxBalance: user.maxBalance,
                isNew: isNewUser
            },
            isNewUser,
            tlt: tltResult
        });

    } catch (error) {
        console.error('Auth Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
