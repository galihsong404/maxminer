CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN', 'SUPER_ADMIN');

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'PLAYER';

CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "id" TEXT NOT NULL,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "goldToMaxRate" DECIMAL(18,2) NOT NULL DEFAULT 4.0,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);
