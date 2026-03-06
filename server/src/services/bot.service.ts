import { Telegraf, Markup } from 'telegraf';
import { prisma } from '../prisma/client';
import { calculateTLT } from '../utils/tlt';

export class BotService {
    private bot: Telegraf;

    constructor() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            console.error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
            throw new Error('Missing TELEGRAM_BOT_TOKEN');
        }
        this.bot = new Telegraf(token);
    }

    public async init() {
        // Handle /start command
        this.bot.start(async (ctx) => {
            try {
                const tgId = ctx.from.id.toString();
                const startParam = ctx.payload; // This is the 'start' parameter (e.g. 742625427)
                const username = ctx.from.username || ctx.from.first_name || 'Miner';

                console.log(`[BOT] User ${tgId} (${username}) started bot with param: ${startParam || 'NONE'}`);

                // 1. Check if user already exists
                let user = await prisma.user.findUnique({
                    where: { id: tgId }
                });

                const isPremium = ctx.from.is_premium || false;
                const { level, bonusGold, tierName } = calculateTLT(tgId, isPremium);

                if (!user) {
                    // Referral linkage: Only if startParam is a valid user ID and not self
                    let validReferrerId: string | null = null;
                    if (startParam && startParam !== tgId) {
                        const referrerExists = await prisma.user.findUnique({ where: { id: startParam } });
                        if (referrerExists) {
                            validReferrerId = startParam;
                        }
                    }

                    // 3. Create user immediately from Bot API
                    // This is the "Sakti" part: Recording it the moment they hit /start
                    user = await prisma.user.create({
                        data: {
                            id: tgId,
                            telegramUsername: ctx.from.username || null,
                            isPremium: isPremium,
                            minerLevel: level,
                            goldBalance: BigInt(bonusGold),
                            referrerId: validReferrerId
                        }
                    });

                    if (validReferrerId) {
                        console.log(`[BOT] Referral Linked: User ${tgId} referred by ${validReferrerId}`);
                    }
                } else {
                    // 4. Late Binding Logic for existing users without a referrer
                    if (!user.referrerId && startParam && startParam !== tgId) {
                        const referrerExists = await prisma.user.findUnique({ where: { id: startParam } });
                        if (referrerExists) {
                            await prisma.user.update({
                                where: { id: tgId },
                                data: { referrerId: startParam }
                            });
                            console.log(`[BOT] Late Binding: User ${tgId} linked to referrer ${startParam}`);
                        }
                    }
                }

                // 5. Send Welcome Message with Mini App Button
                const webAppUrl = process.env.FRONTEND_URL || 'https://maxminer.vercel.app';

                await ctx.replyWithHTML(
                    `<b>Welcome to Max Miner, ${username}!</b>\n\n` +
                    `🎖 <b>Loyalty Tier:</b> ${tierName}\n` +
                    `⛏ <b>Start Level:</b> Lv. ${level}\n` +
                    `💰 <b>Initial Reward:</b> ${bonusGold.toLocaleString()} Gold\n\n` +
                    `Start your mining journey and earn $MAX tokens. Keep your rig fueled to maximize yields!`,
                    Markup.inlineKeyboard([
                        [Markup.button.webApp('🚀 PLAY NOW', webAppUrl)]
                    ])
                );

            } catch (error) {
                console.error('[BOT ERROR]', error);
            }
        });

        // Launch the bot
        this.bot.launch().then(() => {
            console.log('[BOT] Telegram Bot Service is online!');
        }).catch((err) => {
            console.error('[BOT] Failed to launch:', err);
        });

        // Enable graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }
}

export const botService = new BotService();
