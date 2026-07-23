import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";

let schemaReady: Promise<void> | null = null;

/**
 * Production still carries historical SQLite migrations while running on
 * PostgreSQL. Keep this beta additive and idempotent until that migration debt
 * is repaired; no existing customer or tournament table is altered here.
 */
export function ensureRocketBetaSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createRocketBetaSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function createRocketBetaSchema() {
  await ensureTargetJudgeSchema();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RocketBetaCampaign" (
      "id" TEXT PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "tournamentId" TEXT NOT NULL UNIQUE REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "targetRoundId" TEXT NOT NULL UNIQUE REFERENCES "TargetJudgingRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "entryOpensAt" TIMESTAMPTZ,
      "entryClosesAt" TIMESTAMPTZ,
      "fieldVersion" TEXT,
      "fieldHash" TEXT,
      "fieldFrozenAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RocketBetaMember" (
      "id" TEXT PRIMARY KEY,
      "campaignId" TEXT NOT NULL REFERENCES "RocketBetaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "email" TEXT NOT NULL,
      "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "displayName" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT TRUE,
      "invitedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "acceptedAt" TIMESTAMPTZ,
      CONSTRAINT "RocketBetaMember_campaignId_email_key" UNIQUE ("campaignId", "email"),
      CONSTRAINT "RocketBetaMember_campaignId_userId_key" UNIQUE ("campaignId", "userId")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RocketBetaPass" (
      "id" TEXT PRIMARY KEY,
      "campaignId" TEXT NOT NULL REFERENCES "RocketBetaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "memberId" TEXT NOT NULL REFERENCES "RocketBetaMember"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "sourceTargetEntryId" TEXT NOT NULL UNIQUE REFERENCES "TargetPilotEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'UNLOCKED',
      "unlockedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "redeemedAt" TIMESTAMPTZ,
      "teamId" TEXT UNIQUE REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "RocketBetaPass_campaignId_userId_key" UNIQUE ("campaignId", "userId")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RocketBetaAudit" (
      "id" TEXT PRIMARY KEY,
      "campaignId" TEXT NOT NULL REFERENCES "RocketBetaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "actorEmail" TEXT,
      "action" TEXT NOT NULL,
      "payload" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RocketBetaMember_email_idx" ON "RocketBetaMember"("email")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RocketBetaPass_userId_idx" ON "RocketBetaPass"("userId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "RocketBetaAudit_campaignId_createdAt_idx" ON "RocketBetaAudit"("campaignId", "createdAt")`,
  );
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RocketBetaCampaign"
      ADD COLUMN IF NOT EXISTS "results" JSONB,
      ADD COLUMN IF NOT EXISTS "resultsHash" TEXT,
      ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMPTZ
  `);
}
