-- Applied to the PostgreSQL production database on 25 July 2026.
-- Kept outside prisma/migrations because this repository's historical Prisma
-- migration lock is SQLite-era and cannot safely represent the live database.
--
-- Add role-based admin access while preserving the legacy isAdmin flag during
-- the transition. Only explicitly approved accounts receive a role.
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'OPERATOR', 'SUPPORT', 'READ_ONLY');

ALTER TABLE "User" ADD COLUMN "adminRole" "AdminRole";

UPDATE "User"
SET "adminRole" = 'OWNER'
WHERE lower("email") = 'yangmal1000000@gmail.com';

UPDATE "User"
SET "adminRole" = 'READ_ONLY',
    "isAdmin" = false
WHERE lower("email") = 'russglenn2@gmail.com';

CREATE TABLE "AdminAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "actorRole" "AdminRole" NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalJob" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "expectedIntervalMinutes" INTEGER,
  "staleAfterMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalJobRun" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "recordsProcessed" INTEGER,
  "summary" TEXT,
  "errorSummary" TEXT,
  "correlationId" TEXT,
  CONSTRAINT "OperationalJobRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminAuditEvent_requestId_key" ON "AdminAuditEvent"("requestId");
CREATE INDEX "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");
CREATE INDEX "AdminAuditEvent_actorUserId_createdAt_idx" ON "AdminAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AdminAuditEvent_resourceType_resourceId_createdAt_idx" ON "AdminAuditEvent"("resourceType", "resourceId", "createdAt");

CREATE UNIQUE INDEX "OperationalJob_key_key" ON "OperationalJob"("key");
CREATE UNIQUE INDEX "OperationalJobRun_correlationId_key" ON "OperationalJobRun"("correlationId");
CREATE INDEX "OperationalJobRun_jobId_startedAt_idx" ON "OperationalJobRun"("jobId", "startedAt");
CREATE INDEX "OperationalJobRun_status_startedAt_idx" ON "OperationalJobRun"("status", "startedAt");

INSERT INTO "OperationalJob" (
  "id",
  "key",
  "name",
  "source",
  "enabled",
  "expectedIntervalMinutes",
  "staleAfterMinutes",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'ops-rocket-field',
    'rocket-field-reconciliation',
    'Rocket final-field reconciliation',
    'github-actions',
    true,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'ops-rocket-live',
    'rocket-live-scoring',
    'Rocket live scoring',
    'github-actions',
    true,
    5,
    15,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

ALTER TABLE "AdminAuditEvent"
  ADD CONSTRAINT "AdminAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationalJobRun"
  ADD CONSTRAINT "OperationalJobRun_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "OperationalJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The runtime application role may read and append audit events but cannot
-- rewrite or erase them.
GRANT SELECT, INSERT ON TABLE "AdminAuditEvent" TO fantasy_golf_app;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AdminAuditEvent" FROM fantasy_golf_app;

GRANT SELECT, INSERT, UPDATE ON TABLE "OperationalJob", "OperationalJobRun" TO fantasy_golf_app;
REVOKE DELETE, TRUNCATE ON TABLE "OperationalJob", "OperationalJobRun" FROM fantasy_golf_app;
