import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface OperationalJobDefinition {
  key: string;
  name: string;
  source: string;
  expectedIntervalMinutes?: number;
  staleAfterMinutes?: number;
}

export interface OperationalJobContract extends OperationalJobDefinition {
  firstExpectedAt?: Date;
  windowEndsAt?: Date;
  scheduleKind: "recurring" | "one-shot" | "event" | "manual";
}

export interface OperationalRunHandle {
  id: string;
  correlationId: string;
}

export const OPERATIONAL_JOB_CONTRACTS: readonly OperationalJobContract[] = [
  {
    key: "rocket-field-reconciliation",
    name: "Rocket final-field reconciliation",
    source: "github-actions",
    scheduleKind: "manual",
  },
  {
    key: "rocket-live-scoring",
    name: "Rocket live scoring",
    source: "github-actions",
    expectedIntervalMinutes: 5,
    staleAfterMinutes: 15,
    firstExpectedAt: new Date("2026-07-30T10:00:00.000Z"),
    windowEndsAt: new Date("2026-08-03T02:00:00.000Z"),
    scheduleKind: "recurring",
  },
  {
    key: "tournament-results-sync",
    name: "Tournament results sync",
    source: "vercel-cron",
    expectedIntervalMinutes: 24 * 60,
    staleAfterMinutes: 26 * 60,
    firstExpectedAt: new Date("2026-07-25T22:00:00.000Z"),
    scheduleKind: "recurring",
  },
  {
    key: "world-ranking-sync",
    name: "World ranking sync",
    source: "vercel-cron",
    expectedIntervalMinutes: 7 * 24 * 60,
    staleAfterMinutes: 8 * 24 * 60,
    firstExpectedAt: new Date("2026-07-27T06:00:00.000Z"),
    scheduleKind: "recurring",
  },
  {
    key: "tournament-schedule-sync",
    name: "Tournament schedule sync",
    source: "vercel-cron",
    expectedIntervalMinutes: 31 * 24 * 60,
    staleAfterMinutes: 35 * 24 * 60,
    firstExpectedAt: new Date("2026-08-01T06:00:00.000Z"),
    scheduleKind: "recurring",
  },
  {
    key: "push-delivery",
    name: "Push delivery",
    source: "web-push",
    scheduleKind: "event",
  },
  {
    key: "openclaw-field-watcher",
    name: "Monday final-field watcher",
    source: "openclaw",
    expectedIntervalMinutes: 10,
    staleAfterMinutes: 25,
    firstExpectedAt: new Date("2026-07-27T16:00:00.000Z"),
    windowEndsAt: new Date("2026-07-28T08:00:00.000Z"),
    scheduleKind: "recurring",
  },
  {
    key: "openclaw-field-delay-warning",
    name: "Monday field delay warning",
    source: "openclaw",
    staleAfterMinutes: 30,
    firstExpectedAt: new Date("2026-07-27T22:30:00.000Z"),
    scheduleKind: "one-shot",
  },
  {
    key: "openclaw-field-manual-review",
    name: "Tuesday field release review",
    source: "openclaw",
    staleAfterMinutes: 60,
    firstExpectedAt: new Date("2026-07-28T08:00:00.000Z"),
    scheduleKind: "one-shot",
  },
  {
    key: "openclaw-live-first-run-check",
    name: "Live scoring first-run check",
    source: "openclaw",
    staleAfterMinutes: 30,
    firstExpectedAt: new Date("2026-07-30T10:12:00.000Z"),
    scheduleKind: "one-shot",
  },
  {
    key: "openclaw-live-cleanup",
    name: "Live scoring cleanup",
    source: "openclaw",
    staleAfterMinutes: 60,
    firstExpectedAt: new Date("2026-08-03T03:00:00.000Z"),
    scheduleKind: "one-shot",
  },
] as const;

export function operationalJobContract(
  key: string,
): OperationalJobContract | null {
  return OPERATIONAL_JOB_CONTRACTS.find((job) => job.key === key) ?? null;
}

export async function beginOperationalRun(
  definition: OperationalJobDefinition,
  trigger: string,
): Promise<OperationalRunHandle | null> {
  try {
    const correlationId = randomUUID();
    const job = await prisma.operationalJob.upsert({
      where: { key: definition.key },
      update: {
        name: definition.name,
        source: definition.source,
        enabled: true,
        expectedIntervalMinutes: definition.expectedIntervalMinutes,
        staleAfterMinutes: definition.staleAfterMinutes,
      },
      create: {
        key: definition.key,
        name: definition.name,
        source: definition.source,
        expectedIntervalMinutes: definition.expectedIntervalMinutes,
        staleAfterMinutes: definition.staleAfterMinutes,
      },
      select: { id: true },
    });
    const run = await prisma.operationalJobRun.create({
      data: {
        jobId: job.id,
        trigger: bounded(trigger, 80),
        status: "RUNNING",
        correlationId,
      },
      select: { id: true },
    });
    return { id: run.id, correlationId };
  } catch {
    console.warn("Operational heartbeat could not be started");
    return null;
  }
}

export async function completeOperationalRun(
  run: OperationalRunHandle | null,
  input: {
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    recordsProcessed?: number;
    summary?: string;
    errorSummary?: string;
  },
): Promise<void> {
  if (!run) return;
  try {
    await prisma.operationalJobRun.update({
      where: { id: run.id },
      data: {
        status: input.status,
        completedAt: new Date(),
        recordsProcessed:
          typeof input.recordsProcessed === "number"
            ? Math.max(0, Math.trunc(input.recordsProcessed))
            : null,
        summary: input.summary ? bounded(input.summary, 240) : null,
        errorSummary: input.errorSummary
          ? bounded(input.errorSummary, 240)
          : null,
      },
    });
  } catch {
    console.warn("Operational heartbeat could not be completed");
  }
}

export async function recordOperationalRun(
  definition: OperationalJobDefinition,
  trigger: string,
  input: {
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    recordsProcessed?: number;
    summary?: string;
    errorSummary?: string;
  },
): Promise<boolean> {
  try {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const job = await tx.operationalJob.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          source: definition.source,
          enabled: true,
          expectedIntervalMinutes: definition.expectedIntervalMinutes,
          staleAfterMinutes: definition.staleAfterMinutes,
        },
        create: {
          key: definition.key,
          name: definition.name,
          source: definition.source,
          expectedIntervalMinutes: definition.expectedIntervalMinutes,
          staleAfterMinutes: definition.staleAfterMinutes,
        },
        select: { id: true },
      });
      await tx.operationalJobRun.create({
        data: {
          jobId: job.id,
          trigger: bounded(trigger, 80),
          status: input.status,
          startedAt: now,
          completedAt: now,
          recordsProcessed:
            typeof input.recordsProcessed === "number"
              ? Math.max(0, Math.trunc(input.recordsProcessed))
              : null,
          summary: input.summary ? bounded(input.summary, 240) : null,
          errorSummary: input.errorSummary
            ? bounded(input.errorSummary, 240)
            : null,
          correlationId: randomUUID(),
        },
      });
    });
    return true;
  } catch {
    console.warn("Operational heartbeat could not be recorded");
    return false;
  }
}

function bounded(value: string, length: number): string {
  return value.trim().slice(0, length);
}
