import crypto from 'crypto';

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * Uses timing-safe comparison to prevent timing attacks (CRITICAL FIX #3).
 */
export function validateInitData(initDataRaw: string, botToken: string): boolean {
    try {
        const params = new URLSearchParams(initDataRaw);
        const hash = params.get('hash');

        if (!hash) {
            return false;
        }

        params.delete('hash');

        // [FIX] Reject missing auth_date entirely (required field)
        const authDate = params.get('auth_date');
        if (!authDate) {
            return false;
        }

        // Check if initData is older than 5 MINUTES (was 24h, too permissive for replay)
        const now = Math.floor(Date.now() / 1000);
        const authTimestamp = parseInt(authDate, 10);
        if (isNaN(authTimestamp) || now - authTimestamp > 300) { // 5 minutes
            return false;
        }

        // Sort params alphabetically
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        // HMAC verification
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        // [CRITICAL FIX #3] Timing-safe comparison to prevent byte-by-byte brute force
        const hashBuffer = Buffer.from(hash, 'hex');
        const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

        if (hashBuffer.length !== calculatedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(hashBuffer, calculatedBuffer);
    } catch (error) {
        return false;
    }
}
