# 🔄 MIGRATION GUIDE: Old vs. New Code Changes

If you are coming from the "Old" MaxMiner code, you **MUST** apply these changes to make your backend functional and stable.

## 1. File Structure Changes
**Old**: `src/services/` was empty or missing.  
**New**: Created `src/services/payout.service.ts`.
> **Action**: You must have this file if your `index.ts` imports it, or the server will crash on start.

## 2. `package.json` Fixes
**Old**: 
```json
"scripts": {
    "postinstall": "prisma generate"
}
```
**New**:
```json
"scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
}
```
> **Action**: Delete the `postinstall` script. It causes infinite loops on some servers. Always add a `build` script to compile TypeScript to JavaScript.

## 3. Ad Reward Route (`src/routes/ad.routes.ts`)
**Old**: Missing the callback endpoint.
**New**: 
```typescript
router.get('/callback', adNetworkCallback);
```
> **Action**: Without this, your ad system will NOT reward users. The ad network needs a URL to ping after a user watches an ad.

## 4. Environment Variables (`.env`)
**Old**: Missing critical Telegram and Engine flags.
**New**: Added:
- `TELEGRAM_BOT_TOKEN`: Required for auth validation.
- `NODE_ENV=production`: Optmizes performance.
- `ENABLE_PAYOUTS=true`: Activates the background worker.

## 5. Prisma Configuration
**Old**: Using default engine.
**New**: Using Binary engine.
> **Action**: When running your server, if Prisma fails to find the engine, use:
> `PRISMA_CLI_QUERY_ENGINE_TYPE=binary PRISMA_CLIENT_ENGINE_TYPE=binary npx prisma generate`

---

### Migration Summary Table
| Component | What to Change | Reason |
|---|---|---|
| **Build Loop** | Remove `postinstall` | Prevents VPS CPU freeze |
| **Missing File** | Add `payout.service.ts` | Prevents startup crash |
| **Ad System** | Register `/callback` route | Enables ad rewards |
| **Auth** | Add `TELEGRAM_BOT_TOKEN` | Enables Telegram login |
| **Prisma** | Set Engine to `binary` | Fixes VPS compatibility |
| **Transport** | Use Base64 for upload | Prevents code corruption |
