import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import {
  TARGET_JUDGE_ROUND_SLUG,
  TARGET_SCENARIO_VERSION,
  isTargetJudgePanelMode,
  isTargetJudgeStatus,
  validateJudgeSubmission,
  validateOfficialTargetsRecord,
  validateTargetJudgePanel,
  type TargetJudgeControlDto,
  type TargetJudgeRoundDto,
} from "@/lib/target-judge-core";
import {
  targetPilotReference,
  validateTargetPilotResults,
  validateTargetPilotSubmission,
} from "@/lib/target-pilot-core";
import {
  TargetJudgeAccessError,
  requireTargetJudgeCoordinator,
  targetPilotEntrySetHash,
  targetScenarioHash,
} from "@/lib/target-judge-server";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

class TargetControlRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function GET() {
  try {
    await requireTargetJudgeCoordinator();
    await ensureTargetJudgeSchema();
    return privateJson(await readControlDto());
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actorEmail = await requireTargetJudgeCoordinator();
    await ensureTargetJudgeSchema();
    const body = (await request.json()) as { action?: unknown; panel?: unknown };

    switch (body.action) {
      case "create_round":
        await createRound(actorEmail);
        break;
      case "save_panel":
        await savePanel(actorEmail, body.panel);
        break;
      case "clear_pilot_entries":
        await clearPilotEntries(actorEmail);
        break;
      case "seal_pilot_entries":
        await sealPilotEntries(actorEmail);
        break;
      case "start_coordinator_rehearsal":
        await startCoordinatorRehearsal(actorEmail);
        break;
      case "open_initial":
        await openInitialMarking(actorEmail);
        break;
      case "open_final":
        await openFinalMarking(actorEmail);
        break;
      default:
        throw new TargetControlRequestError("Unknown coordinator action");
    }

    return privateJson({ ok: true, ...(await readControlDto()) });
  } catch (error) {
    return handleError(error);
  }
}

async function createRound(actorEmail: string) {
  const existing = await prisma.targetJudgingRound.findUnique({
    where: { slug: TARGET_JUDGE_ROUND_SLUG },
  });
  if (existing) return;

  const scenarioHash = targetScenarioHash();
  await prisma.targetJudgingRound.create({
    data: {
      slug: TARGET_JUDGE_ROUND_SLUG,
      name: "Hawthorn Vale Judge Rehearsal",
      scenarioVersion: TARGET_SCENARIO_VERSION,
      scenarioHash,
      createdByEmail: actorEmail,
      auditEvents: {
        create: {
          actorEmail,
          action: "round_created",
          payload: { scenarioVersion: TARGET_SCENARIO_VERSION, scenarioHash },
        },
      },
    },
  });
}

async function savePanel(actorEmail: string, rawPanel: unknown) {
  const panel = validateTargetJudgePanel(rawPanel);
  await prisma.$transaction(async (tx) => {
    const round = await requireDraftRound(tx);
    await tx.targetJudgeAssignment.deleteMany({ where: { roundId: round.id } });
    await tx.targetJudgeAssignment.createMany({
      data: panel.map((member, index) => ({
        roundId: round.id,
        seat: index + 1,
        email: member.email,
        displayName: member.displayName,
        credential: member.credential,
      })),
    });
    await tx.targetJudgeAudit.create({
      data: {
        roundId: round.id,
        actorEmail,
        action: "panel_saved",
        payload: panel.map((member, index) => ({
          seat: index + 1,
          email: member.email,
          displayName: member.displayName,
          credential: member.credential,
        })),
      },
    });
    await tx.targetJudgingRound.update({
      where: { id: round.id },
      data: { panelMode: "OFFICIAL" },
    });
  });
}

async function startCoordinatorRehearsal(actorEmail: string) {
  await prisma.$transaction(async (tx) => {
    const round = await requireDraftRound(tx);
    if (round.scenarioHash !== targetScenarioHash()) {
      throw new TargetControlRequestError("The live scenarios no longer match this round", 409);
    }
    if (!round.pilotEntriesSealedAt || !round.pilotEntrySetHash || !round.pilotEntryCount) {
      throw new TargetControlRequestError("Seal at least one pilot entry before starting the rehearsal", 409);
    }
    const entries = await tx.targetPilotEntry.findMany({
      where: { roundId: round.id },
      select: { email: true, submissionHash: true },
    });
    const currentEntrySetHash = targetPilotEntrySetHash({
      scenarioHash: round.scenarioHash,
      entries,
    });
    if (entries.length !== round.pilotEntryCount || currentEntrySetHash !== round.pilotEntrySetHash) {
      throw new TargetControlRequestError("The sealed pilot entry set failed integrity checks", 409);
    }

    await tx.targetJudgeAssignment.deleteMany({ where: { roundId: round.id } });
    await tx.targetJudgeAssignment.createMany({
      data: [1, 2, 3].map((seat) => ({
        roundId: round.id,
        seat,
        email: `coordinator-rehearsal-seat-${seat}@fantasy-golf.invalid`,
        displayName: `Development panel seat ${seat}`,
        credential: "Coordinator-operated rehearsal seat · not an independent PGA judge",
      })),
    });
    await tx.targetJudgingRound.update({
      where: { id: round.id },
      data: {
        panelMode: "COORDINATOR_REHEARSAL",
        status: "INITIAL_MARKING",
      },
    });
    await tx.targetJudgeAudit.create({
      data: {
        roundId: round.id,
        actorEmail,
        action: "coordinator_rehearsal_started",
        payload: {
          entryCount: entries.length,
          entrySetHash: currentEntrySetHash,
          seats: 3,
          independentPanel: false,
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function openInitialMarking(actorEmail: string) {
  await prisma.$transaction(async (tx) => {
    const round = await requireDraftRound(tx);
    if (round.panelMode !== "OFFICIAL") {
      throw new TargetControlRequestError("The coordinator rehearsal uses its own judging path", 409);
    }
    if (round.scenarioHash !== targetScenarioHash()) {
      throw new TargetControlRequestError(
        "The live scenario bundle no longer matches the frozen round. Create a new version before judging.",
        409,
      );
    }
    const assignments = await tx.targetJudgeAssignment.count({ where: { roundId: round.id } });
    if (assignments !== 3) {
      throw new TargetControlRequestError("Save exactly three judges before opening judging", 409);
    }
    if (!round.pilotEntriesSealedAt || !round.pilotEntrySetHash || !round.pilotEntryCount) {
      throw new TargetControlRequestError("Seal at least one pilot entry before opening judging", 409);
    }
    const pilotEntries = await tx.targetPilotEntry.findMany({
      where: { roundId: round.id },
      select: { email: true, submissionHash: true },
    });
    const currentEntrySetHash = targetPilotEntrySetHash({
      scenarioHash: round.scenarioHash,
      entries: pilotEntries,
    });
    if (
      pilotEntries.length !== round.pilotEntryCount ||
      currentEntrySetHash !== round.pilotEntrySetHash
    ) {
      throw new TargetControlRequestError("The sealed pilot entry set failed integrity checks", 409);
    }
    await tx.targetJudgingRound.update({
      where: { id: round.id },
      data: { status: "INITIAL_MARKING" },
    });
    await tx.targetJudgeAudit.create({
      data: {
        roundId: round.id,
        actorEmail,
        action: "initial_marking_opened",
        payload: { scenarioHash: round.scenarioHash },
      },
    });
  });
}

async function clearPilotEntries(actorEmail: string) {
  await prisma.$transaction(async (tx) => {
    const round = await requireDraftRound(tx);
    if (round.pilotEntriesSealedAt) {
      throw new TargetControlRequestError("Sealed pilot evidence cannot be cleared", 409);
    }
    const deleted = await tx.targetPilotEntry.deleteMany({ where: { roundId: round.id } });
    await tx.targetJudgeAudit.create({
      data: {
        roundId: round.id,
        actorEmail,
        action: "unsealed_pilot_entries_cleared",
        payload: { deletedEntries: deleted.count },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function sealPilotEntries(actorEmail: string) {
  await prisma.$transaction(async (tx) => {
    const round = await requireDraftRound(tx);
    if (round.pilotEntriesSealedAt) {
      throw new TargetControlRequestError("Pilot entries are already sealed", 409);
    }
    if (round.scenarioHash !== targetScenarioHash()) {
      throw new TargetControlRequestError("The live scenarios no longer match this round", 409);
    }
    const entries = await tx.targetPilotEntry.findMany({
      where: { roundId: round.id },
      select: { email: true, submissionHash: true },
    });
    if (entries.length === 0) {
      throw new TargetControlRequestError("Collect at least one pilot entry before sealing", 409);
    }
    const entrySetHash = targetPilotEntrySetHash({
      scenarioHash: round.scenarioHash,
      entries,
    });
    const sealedAt = new Date();
    const updated = await tx.targetJudgingRound.updateMany({
      where: { id: round.id, pilotEntriesSealedAt: null, status: "DRAFT" },
      data: {
        pilotEntriesSealedAt: sealedAt,
        pilotEntrySetHash: entrySetHash,
        pilotEntryCount: entries.length,
      },
    });
    if (updated.count !== 1) throw new TargetControlRequestError("Pilot entries were already sealed", 409);
    await tx.targetJudgeAudit.create({
      data: {
        roundId: round.id,
        actorEmail,
        action: "pilot_entry_set_sealed",
        payload: { entryCount: entries.length, entrySetHash },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function openFinalMarking(actorEmail: string) {
  await prisma.$transaction(async (tx) => {
    const round = await tx.targetJudgingRound.findUnique({
      where: { slug: TARGET_JUDGE_ROUND_SLUG },
    });
    if (!round) throw new TargetControlRequestError("Create the judging round first", 404);
    if (round.status !== "INITIAL_COMPLETE") {
      throw new TargetControlRequestError("All three initial marks must be locked first", 409);
    }
    const locked = await tx.targetJudgeAssignment.count({
      where: { roundId: round.id, initialLockedAt: { not: null } },
    });
    if (locked !== 3) throw new TargetControlRequestError("Initial panel is incomplete", 409);
    await tx.targetJudgingRound.update({
      where: { id: round.id },
      data: { status: "FINAL_MARKING" },
    });
    await tx.targetJudgeAudit.create({
      data: {
        roundId: round.id,
        actorEmail,
        action: "final_marking_opened",
        payload: { initialMarksLocked: locked },
      },
    });
  });
}

async function requireDraftRound(tx: Prisma.TransactionClient) {
  const round = await tx.targetJudgingRound.findUnique({
    where: { slug: TARGET_JUDGE_ROUND_SLUG },
  });
  if (!round) throw new TargetControlRequestError("Create the judging round first", 404);
  if (round.status !== "DRAFT") {
    throw new TargetControlRequestError("The panel is frozen because judging has opened", 409);
  }
  return round;
}

async function readControlDto(): Promise<TargetJudgeControlDto> {
  const round = await prisma.targetJudgingRound.findUnique({
    where: { slug: TARGET_JUDGE_ROUND_SLUG },
    include: {
      assignments: { orderBy: { seat: "asc" } },
      pilotEntries: { orderBy: { submittedAt: "asc" } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!round) return { round: null, assignments: [], pilotEntries: [], auditEvents: [] };
  if (!isTargetJudgeStatus(round.status)) throw new Error("Unknown judging status");
  if (!isTargetJudgePanelMode(round.panelMode)) throw new Error("Unknown judging panel mode");
  const revealInitial = ["INITIAL_COMPLETE", "FINAL_MARKING", "CALCULATED"].includes(round.status);
  const revealFinal = round.status === "CALCULATED";

  const roundDto: TargetJudgeRoundDto = {
    id: round.id,
    slug: round.slug,
    name: round.name,
    scenarioVersion: round.scenarioVersion,
    scenarioHash: round.scenarioHash,
    status: round.status,
    panelMode: round.panelMode,
    officialTargets: round.officialTargets
      ? validateOfficialTargetsRecord(round.officialTargets)
      : null,
    officialTargetsHash: round.officialTargetsHash,
    calculatedAt: round.calculatedAt?.toISOString() ?? null,
    pilotEntriesSealedAt: round.pilotEntriesSealedAt?.toISOString() ?? null,
    pilotEntrySetHash: round.pilotEntrySetHash,
    pilotEntryCount: round.pilotEntryCount,
    pilotResults: round.pilotResults ? validateTargetPilotResults(round.pilotResults) : null,
    pilotResultsHash: round.pilotResultsHash,
    pilotScoredAt: round.pilotScoredAt?.toISOString() ?? null,
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
  };

  return {
    round: roundDto,
    assignments: round.assignments.map((assignment) => ({
      id: assignment.id,
      seat: assignment.seat,
      email: assignment.email,
      displayName: assignment.displayName,
      credential: assignment.credential,
      declarationConfirmedAt: assignment.declarationConfirmedAt?.toISOString() ?? null,
      initialLockedAt: assignment.initialLockedAt?.toISOString() ?? null,
      finalLockedAt: assignment.finalLockedAt?.toISOString() ?? null,
      initialSubmission: revealInitial && assignment.initialSubmission
        ? validateJudgeSubmission(assignment.initialSubmission)
        : null,
      finalSubmission: revealFinal && assignment.finalSubmission
        ? validateJudgeSubmission(assignment.finalSubmission)
        : null,
    })),
    pilotEntries: round.pilotEntries.map((entry) => ({
      id: entry.id,
      reference: targetPilotReference(entry.id),
      email: entry.email,
      submission: validateTargetPilotSubmission(entry.submission),
      submissionHash: entry.submissionHash,
      submittedAt: entry.submittedAt.toISOString(),
    })),
    auditEvents: round.auditEvents.map((event) => ({
      id: event.id,
      actorEmail: event.actorEmail,
      action: event.action,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new TargetJudgeAccessError("Cross-site request blocked", 403);
  }
}

function privateJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...init?.headers },
  });
}

function handleError(error: unknown) {
  if (error instanceof TargetJudgeAccessError || error instanceof TargetControlRequestError) {
    return privateJson({ error: error.message }, { status: error.status });
  }
  console.error("Target control error", error);
  return privateJson({ error: "Unable to update Judge Mode" }, { status: 500 });
}
