import { Router, Request, Response } from 'express';
import { requestAd, adNetworkCallback } from '../controllers/ad.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireNotBanned } from '../middlewares/antiCheat.middleware';
import { validateAdRequest } from '../middlewares/ad.middleware';

const router = Router();

// Endpoint called by frontend to get a Session ID to watch an ad
// Protected by Auth AND the strictly enforced 14-min / 50-limit Gate logic
router.post('/request', authenticateJWT, requireNotBanned, validateAdRequest, requestAd);

// S2S Webhook called by the Ad Network (Monetag/AdsGram) AFTER the user finishes the ad.
// NOT PROTECTED BY JWT. Protected by HMAC signature.
// [DEV ONLY] Helper to simulate ad network callbacks from the frontend
if (process.env.NODE_ENV !== 'production') {
    router.get('/dev-callback', (req: Request, res: Response) => {
        const crypto = require('crypto');
        const { uid, custom, reward_event_type } = req.query;
        if (!uid || !custom || !reward_event_type) return res.send('Missing params');

        const dataCheckString = `uid=${uid}&custom=${custom}&reward_event_type=${reward_event_type}`;
        const MONETAG_SECRET = process.env.MONETAG_SECRET || 'test_secret';
        const hmac = crypto.createHmac('sha256', MONETAG_SECRET).update(dataCheckString).digest('hex');

        res.redirect(`/api/ad/callback?uid=${uid}&custom=${custom}&reward_event_type=${reward_event_type}&hmac=${hmac}`);
    });
}

export default router;
