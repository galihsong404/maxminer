const { Client } = require('pg');

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
    console.error("No DIRECT_URL found in env");
    process.exit(1);
}

const client = new Client({
    connectionString: directUrl,
});

async function runHardReset() {
    await client.connect();
    console.log("Connected to Supabase DIRECT_URL.");

    const resetSql = `
-- TAHAP 1: DESTROY SEMUA TABEL DAN ENUM (HARD RESET)
DROP TABLE IF EXISTS "public"."Withdrawal" CASCADE;
DROP TABLE IF EXISTS "public"."AdSession" CASCADE;
DROP TABLE IF EXISTS "public"."Transaction" CASCADE;
DROP TABLE IF EXISTS "public"."User" CASCADE;

DROP TYPE IF EXISTS "public"."TxType" CASCADE;
DROP TYPE IF EXISTS "public"."Currency" CASCADE;
DROP TYPE IF EXISTS "public"."SessionStatus" CASCADE;
DROP TYPE IF EXISTS "public"."RewardType" CASCADE;
DROP TYPE IF EXISTS "public"."WithdrawStatus" CASCADE;

-- TAHAP 2: CREATE ENUM BARU
CREATE TYPE "public"."TxType" AS ENUM ('GOLD_MINE', 'BOX_OPEN', 'CONVERT', 'WITHDRAW', 'REFERRAL_PAYOUT', 'UPGRADE');
CREATE TYPE "public"."Currency" AS ENUM ('GOLD', 'MAX');
CREATE TYPE "public"."SessionStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');
CREATE TYPE "public"."RewardType" AS ENUM ('VALUED', 'NOT_VALUED');
CREATE TYPE "public"."WithdrawStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'FAILED');

-- TAHAP 3: CREATE TABEL BARU (STRUKTUR TERBARU)
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "minerLevel" INTEGER NOT NULL DEFAULT 1,
    "goldBalance" BIGINT NOT NULL DEFAULT 0,
    "maxBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fuelUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastAdWatch" TIMESTAMP(3),
    "fraudScore" INTEGER NOT NULL DEFAULT 0,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginIp" TEXT,
    "referrerId" TEXT,
    "lastWithdrawAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."TxType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."AdSession" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'PENDING',
    "rewardType" "public"."RewardType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AdSession_pkey" PRIMARY KEY ("sessionId")
);

CREATE TABLE "public"."Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "status" "public"."WithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- TAHAP 4: CREATE RELASI (FOREIGN KEYS) & INDEX
ALTER TABLE "public"."User" ADD CONSTRAINT "User_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AdSession" ADD CONSTRAINT "AdSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_referrerId_idx" ON "public"."User"("referrerId");
CREATE INDEX "Transaction_userId_type_idx" ON "public"."Transaction"("userId", "type");
CREATE INDEX "Transaction_userId_createdAt_idx" ON "public"."Transaction"("userId", "createdAt");
CREATE INDEX "AdSession_userId_status_idx" ON "public"."AdSession"("userId", "status");
CREATE INDEX "AdSession_userId_createdAt_idx" ON "public"."AdSession"("userId", "createdAt");
CREATE INDEX "Withdrawal_userId_createdAt_idx" ON "public"."Withdrawal"("userId", "createdAt");
  `;

    try {
        console.log("Executing hard reset SQL script...");
        await client.query(resetSql);
        console.log("✅ ALL TABLES AND SCHEMAS SUCCESSFULLY HARD RESET.");
    } catch (err) {
        console.error("SQL Execution Error:", err);
    } finally {
        await client.end();
    }
}

runHardReset();
