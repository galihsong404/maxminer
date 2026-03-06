import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

// [HIGH FIX #3] Crash at startup if JWT_SECRET missing in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set in production!');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' })); // Restrict in production
app.use(express.json({ limit: '10kb' })); // [HIGH FIX #2] Prevent memory exhaustion DoS

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import adRoutes from './routes/ad.routes';
import mineRoutes from './routes/mine.routes';
import economyRoutes from './routes/economy.routes';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ad', adRoutes);
app.use('/api/mine', mineRoutes);
app.use('/api/economy', economyRoutes);

// [SENIOR SECURITY AUDIT NOTE - FIXED ROUTING]
// Previously mounted straight to `/health`, causing 404s when pinged via Vercel proxy.
// Moving to `/api/health` synchronizes the backend routing with the frontend proxy expectations.
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'W2E Miner API is running.' });
});

// [IMPORTANT] Keeping the improved Payout Service in Production
import { startPayoutService } from './services/payout.service';
import { botService } from './services/bot.service';

// Start Telegram Bot
botService.init();

// Start Background Worker for Withdrawals
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_PAYOUTS === 'true') {
    startPayoutService();
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
