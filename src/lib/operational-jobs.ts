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

export interface OperationalRunHandle {
  id: string;
  correlationId: string;
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

function bounded(value: string, length: number): string {
  return value.trim().slice(0, length);
}
