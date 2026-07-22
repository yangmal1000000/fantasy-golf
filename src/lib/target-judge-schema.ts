import { prisma } from "@/lib/prisma";

let schemaReady: Promise<void> | null = null;

/**
 * The repository's historical migrations were created for SQLite even though
 * production now runs PostgreSQL. Until that wider migration debt is repaired,
 * use the same idempotent PostgreSQL bootstrap pattern as the rest of this app.
 * Every statement is additive and limited to the private judging tables.
 */
export function ensureTargetJudgeSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = createTargetJudgeSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function createTargetJudgeSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TargetJudgingRound" (
      "id" TEXT PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "scenarioVersion" TEXT NOT NULL,
      "scenarioHash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "createdByEmail" TEXT NOT NULL,
      "officialTargets" JSONB,
      "officialTargetsHash" TEXT,
      "calculatedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TargetJudgeAssignment" (
      "id" TEXT PRIMARY KEY,
      "roundId" TEXT NOT NULL REFERENCES "TargetJudgingRound"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "email" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "credential" TEXT NOT NULL,
      "seat" INTEGER NOT NULL,
      "declarationConfirmedAt" TIMESTAMPTZ,
      "initialSubmission" JSONB,
      "initialLockedAt" TIMESTAMPTZ,
      "finalSubmission" JSONB,
      "finalLockedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TargetJudgeAssignment_roundId_email_key" UNIQUE ("roundId", "email"),
      CONSTRAINT "TargetJudgeAssignment_roundId_seat_key" UNIQUE ("roundId", "seat")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TargetJudgeAudit" (
      "id" TEXT PRIMARY KEY,
      "roundId" TEXT NOT NULL REFERENCES "TargetJudgingRound"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "actorEmail" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "payload" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "TargetJudgeAssignment_email_idx" ON "TargetJudgeAssignment"("email")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "TargetJudgeAudit_roundId_createdAt_idx" ON "TargetJudgeAudit"("roundId", "createdAt")`,
  );
}
