import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Creating SystemConfig table manually...");
    try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "SystemConfig"`);
        await prisma.$executeRawUnsafe(`
      CREATE TABLE "SystemConfig" (
          "id" TEXT NOT NULL,
          "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
          "goldToMaxRate" DECIMAL(18,2) NOT NULL DEFAULT 1250,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
      )
    `);
        console.log("Table created (or already exists).");

        console.log("Seeding GLOBAL config...");
        await prisma.systemConfig.upsert({
            where: { id: "GLOBAL" },
            update: {},
            create: {
                id: "GLOBAL",
                maintenanceMode: false,
                goldToMaxRate: 1250
            }
        });
        console.log("GLOBAL config seeded.");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
