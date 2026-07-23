import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import { TARGET_SCENARIOS } from "@/lib/target-challenge";
import { isTargetJudgeCoordinator } from "@/lib/target-judge-access";
import {
  TARGET_JUDGE_ROUND_SLUG,
  calculateOfficialTargets,
  isTargetJudgePanelMode,
  isTargetJudgeStatus,
  validateJudgeSubmission,
  validateOfficialTargetsRecord,
  type TargetJudgeAssignmentDto,
  type TargetJudgeContextDto,
  type TargetJudgePhase,
  type TargetJudgeRoundDto,
  type TargetJudgeSubmission,
  type TargetOfficialTargetsRecord,
} from "@/lib/target-judge-core";
import {
  rankTargetPilotEntries,
  targetPilotWinners,
  validateTargetPilotSubmission,
} from "@/lib/target-pilot-core";
import {
  TargetJudgeAccessError,
  getVerifiedTargetEmail,
  targetOfficialTargetsHash,
  targetPilotEntrySetHash,
  targetPilotResultsHash,
  targetScenarioHash,
} from "@/lib/target-judge-server";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

class TargetJudgeRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

type TargetJudgeIdentity = {
  actorEmail: string;
  coordinatorRehearsal: boolean;
  rehearsalSeat?: number;
};

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveJudgeIdentity(request);
    await ensureTargetJudgeSchema();
    return privateJson(await readJudgeContext(identity));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const identity = await resolveJudgeIdentity(request);
    await ensureTargetJudgeSchema();
    const body = (await request.json()) as {
      phase?: unknown;
      declaration?: unknown;
      submission?: unknown;
    };
    if (body.phase !== "initial" && body.phase !== "final") {
      throw new TargetJudgeRequestError("Unknown judging phase");
    }
    const phase: TargetJudgePhase = body.phase;
    const submission = validateJudgeSubmission(body.submission);

    if (phase === "initial" && !identity.coordinatorRehearsal) {
      const declaration = body.declaration as
        | { qualified?: unknown; independent?: unknown; noConflict?: unknown }
        | undefined;
      if (
        declaration?.qualified !== true ||
        declaration.independent !== true ||
        declaration.noConflict !== true
      ) {
        throw new TargetJudgeRequestError("All independence declarations must be confirmed");
      }
    }
    if (phase === "initial") await lockInitialSubmission(identity, submission);
    else await lockFinalSubmission(identity, submission);

    return privateJson({ ok: true, ...(await readJudgeContext(identity)) });
  } catch (error) {
    return handleError(error);
  }
}

async function lockInitialSubmission(identity: TargetJudgeIdentity, submission: TargetJudgeSubmission) {
  await prisma.$transaction(async (tx) => {
    const assignment = await findAssignment(tx, identity);
    assertScenarioHash(assignment.round.scenarioHash);
    if (assignment.round.status !== "INITIAL_MARKING") {
      throw new TargetJudgeRequestError("Initial marking is not open", 409);
    }
    if (assignment.initialLockedAt) {
      throw new TargetJudgeRequestError("Your initial marks are already locked", 409);
    }

    const now = new Date();
    const updated = await tx.targetJudgeAssignment.updateMany({
      where: { id: assignment.id, initialLockedAt: null },
      data: {
        declarationConfirmedAt: identity.coordinatorRehearsal ? null : now,
        initialSubmission: submission as unknown as Prisma.InputJsonValue,
        initialLockedAt: now,
      },
    });
    if (updated.count !== 1) throw new TargetJudgeRequestError("Initial marks were already locked", 409);

    await tx.targetJudgeAudit.create({
      data: {
        roundId: assignment.roundId,
        actorEmail: identity.actorEmail,
        action: identity.coordinatorRehearsal
          ? "coordinator_rehearsal_initial_locked"
          : "judge_initial_locked",
        payload: {
          seat: assignment.seat,
          panelMode: assignment.round.panelMode,
          scenarioIds: TARGET_SCENARIOS.map((item) => item.id),
        },
      },
    });

    const locked = await tx.targetJudgeAssignment.count({
      where: { roundId: assignment.roundId, initialLockedAt: { not: null } },
    });
    if (locked === 3) {
      const transitioned = await tx.targetJudgingRound.updateMany({
        where: { id: assignment.roundId, status: "INITIAL_MARKING" },
        data: { status: "INITIAL_COMPLETE" },
      });
      if (transitioned.count === 1) {
        await tx.targetJudgeAudit.create({
          data: {
            roundId: assignment.roundId,
            actorEmail: "system",
            action: "initial_panel_complete",
            payload: { lockedJudges: 3 },
          },
        });
      }
    }
  });
}

async function lockFinalSubmission(identity: TargetJudgeIdentity, submission: TargetJudgeSubmission) {
  await prisma.$transaction(async (tx) => {
    const assignment = await findAssignment(tx, identity);
    assertScenarioHash(assignment.round.scenarioHash);
    if (assignment.round.status !== "FINAL_MARKING") {
      throw new TargetJudgeRequestError("Final marking is not open", 409);
    }
    if (!assignment.initialLockedAt) {
      throw new TargetJudgeRequestError("Lock initial marks before final marking", 409);
    }
    if (assignment.finalLockedAt) {
      throw new TargetJudgeRequestError("Your final marks are already locked", 409);
    }

    const now = new Date();
    const updated = await tx.targetJudgeAssignment.updateMany({
      where: { id: assignment.id, finalLockedAt: null },
      data: {
        finalSubmission: submission as unknown as Prisma.InputJsonValue,
        finalLockedAt: now,
      },
    });
    if (updated.count !== 1) throw new TargetJudgeRequestError("Final marks were already locked", 409);

    await tx.targetJudgeAudit.create({
      data: {
        roundId: assignment.roundId,
        actorEmail: identity.actorEmail,
        action: identity.coordinatorRehearsal
          ? "coordinator_rehearsal_final_locked"
          : "judge_final_locked",
        payload: {
          seat: assignment.seat,
          panelMode: assignment.round.panelMode,
          scenarioIds: TARGET_SCENARIOS.map((item) => item.id),
        },
      },
    });

    const assignments = await tx.targetJudgeAssignment.findMany({
      where: { roundId: assignment.roundId, finalLockedAt: { not: null } },
      orderBy: { seat: "asc" },
    });
    if (assignments.length !== 3) return;

    const finalSubmissions = assignments.map((item) => ({
      seat: item.seat,
      submission: validateJudgeSubmission(item.finalSubmission),
    }));
    const points = calculateOfficialTargets(finalSubmissions.map((item) => item.submission));
    const officialTargets: TargetOfficialTargetsRecord = {
      algorithm: "weiszfeld-map-v1",
      targets: TARGET_SCENARIOS.map((scenario, index) => ({
        scenarioId: scenario.id,
        point: points[index],
      })),
    };
    const officialTargetsHash = targetOfficialTargetsHash({
      scenarioHash: assignment.round.scenarioHash,
      finalSubmissions,
      officialTargets,
    });
    if (
      !assignment.round.pilotEntriesSealedAt ||
      !assignment.round.pilotEntrySetHash ||
      !assignment.round.pilotEntryCount
    ) {
      throw new TargetJudgeRequestError("The pilot entry set is not sealed", 409);
    }
    const pilotEntries = await tx.targetPilotEntry.findMany({
      where: { roundId: assignment.roundId },
      orderBy: { email: "asc" },
    });
    const entrySetHash = targetPilotEntrySetHash({
      scenarioHash: assignment.round.scenarioHash,
      entries: pilotEntries.map((entry) => ({
        email: entry.email,
        submissionHash: entry.submissionHash,
      })),
    });
    if (
      pilotEntries.length !== assignment.round.pilotEntryCount ||
      entrySetHash !== assignment.round.pilotEntrySetHash
    ) {
      throw new TargetJudgeRequestError("The sealed pilot entry set failed integrity checks", 409);
    }
    const pilotResults = rankTargetPilotEntries(
      pilotEntries.map((entry) => ({
        entryId: entry.id,
        submission: validateTargetPilotSubmission(entry.submission),
      })),
      points,
    );
    const pilotResultsHash = targetPilotResultsHash({
      scenarioHash: assignment.round.scenarioHash,
      entrySetHash,
      officialTargetsHash,
      results: pilotResults,
    });
    const winners = targetPilotWinners(pilotResults);
    const transitioned = await tx.targetJudgingRound.updateMany({
      where: { id: assignment.roundId, status: "FINAL_MARKING" },
      data: {
        status: "CALCULATED",
        officialTargets: officialTargets as unknown as Prisma.InputJsonValue,
        officialTargetsHash,
        calculatedAt: now,
        pilotResults: pilotResults as unknown as Prisma.InputJsonValue,
        pilotResultsHash,
        pilotScoredAt: now,
      },
    });
    if (transitioned.count === 1) {
      await tx.targetJudgeAudit.create({
        data: {
          roundId: assignment.roundId,
          actorEmail: "system",
          action: assignment.round.panelMode === "COORDINATOR_REHEARSAL"
            ? "rehearsal_targets_calculated"
            : "official_targets_calculated",
          payload: {
            algorithm: officialTargets.algorithm,
            officialTargetsHash,
            entrySetHash,
            pilotResultsHash,
            pilotEntryCount: pilotEntries.length,
            panelMode: assignment.round.panelMode,
            inputSeats: finalSubmissions.map((item) => item.seat),
          },
        },
      });
      await tx.targetJudgeAudit.create({
        data: {
          roundId: assignment.roundId,
          actorEmail: "system",
          action: "pilot_winner_confirmed",
          payload: {
            panelMode: assignment.round.panelMode,
            resultType: assignment.round.panelMode === "COORDINATOR_REHEARSAL"
              ? "development_rehearsal"
              : "official_pilot",
            winnerEntryIds: winners.map((winner) => winner.entryId),
            jointWinner: winners.length > 1,
            pilotResultsHash,
            confirmedAt: now.toISOString(),
          },
        },
      });
    }
  });
}

async function findAssignment(tx: Prisma.TransactionClient, identity: TargetJudgeIdentity) {
  const assignment = await tx.targetJudgeAssignment.findFirst({
    where: {
      ...(identity.coordinatorRehearsal
        ? { seat: identity.rehearsalSeat }
        : { email: identity.actorEmail }),
      round: { slug: TARGET_JUDGE_ROUND_SLUG },
    },
    include: { round: true },
  });
  if (!assignment) throw new TargetJudgeAccessError("Judge assignment not found", 404);
  if (
    identity.coordinatorRehearsal &&
    assignment.round.panelMode !== "COORDINATOR_REHEARSAL"
  ) {
    throw new TargetJudgeAccessError("Coordinator rehearsal is not active", 404);
  }
  if (!identity.coordinatorRehearsal && assignment.round.panelMode !== "OFFICIAL") {
    throw new TargetJudgeAccessError("This round is a coordinator rehearsal", 404);
  }
  return assignment;
}

async function readJudgeContext(identity: TargetJudgeIdentity): Promise<TargetJudgeContextDto> {
  const assignment = await prisma.targetJudgeAssignment.findFirst({
    where: {
      ...(identity.coordinatorRehearsal
        ? { seat: identity.rehearsalSeat }
        : { email: identity.actorEmail }),
      round: { slug: TARGET_JUDGE_ROUND_SLUG },
    },
    include: {
      round: {
        include: { assignments: { orderBy: { seat: "asc" } } },
      },
    },
  });
  if (!assignment) throw new TargetJudgeAccessError("Judge assignment not found", 404);
  const { round } = assignment;
  if (!isTargetJudgeStatus(round.status)) throw new Error("Unknown judging status");
  if (!isTargetJudgePanelMode(round.panelMode)) throw new Error("Unknown judging panel mode");
  if (identity.coordinatorRehearsal && round.panelMode !== "COORDINATOR_REHEARSAL") {
    throw new TargetJudgeAccessError("Coordinator rehearsal is not active", 404);
  }
  if (!identity.coordinatorRehearsal && round.panelMode !== "OFFICIAL") {
    throw new TargetJudgeAccessError("This round is a coordinator rehearsal", 404);
  }

  const canSeeInitial = ["INITIAL_COMPLETE", "FINAL_MARKING", "CALCULATED"].includes(round.status);
  const canSeeFinal = round.status === "CALCULATED";
  const roundDto: TargetJudgeRoundDto = {
    id: round.id,
    slug: round.slug,
    name: round.name,
    scenarioVersion: round.scenarioVersion,
    scenarioHash: round.scenarioHash,
    status: round.status,
    panelMode: round.panelMode,
    officialTargets: canSeeFinal && round.officialTargets
      ? validateOfficialTargetsRecord(round.officialTargets)
      : null,
    officialTargetsHash: canSeeFinal ? round.officialTargetsHash : null,
    calculatedAt: canSeeFinal ? round.calculatedAt?.toISOString() ?? null : null,
    pilotEntriesSealedAt: round.pilotEntriesSealedAt?.toISOString() ?? null,
    pilotEntrySetHash: round.pilotEntrySetHash,
    pilotEntryCount: round.pilotEntryCount,
    pilotResults: null,
    pilotResultsHash: null,
    pilotScoredAt: null,
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
  };

  const toDto = (
    item: (typeof round.assignments)[number],
    revealInitial: boolean,
    revealFinal: boolean,
  ): TargetJudgeAssignmentDto => ({
    id: item.id,
    seat: item.seat,
    displayName: item.displayName,
    credential: item.credential,
    declarationConfirmedAt: item.declarationConfirmedAt?.toISOString() ?? null,
    initialLockedAt: item.initialLockedAt?.toISOString() ?? null,
    finalLockedAt: item.finalLockedAt?.toISOString() ?? null,
    initialSubmission: revealInitial && item.initialSubmission
      ? validateJudgeSubmission(item.initialSubmission)
      : null,
    finalSubmission: revealFinal && item.finalSubmission
      ? validateJudgeSubmission(item.finalSubmission)
      : null,
  });

  return {
    round: roundDto,
    assignment: {
      ...toDto(assignment, true, true),
      initialSubmission: assignment.initialSubmission
        ? validateJudgeSubmission(assignment.initialSubmission)
        : null,
      finalSubmission: assignment.finalSubmission
        ? validateJudgeSubmission(assignment.finalSubmission)
        : null,
    },
    panelInitial: canSeeInitial
      ? round.assignments.map((item) => toDto(item, true, false))
      : null,
    panelFinal: canSeeFinal
      ? round.assignments.map((item) => toDto(item, true, true))
      : null,
  };
}

function assertScenarioHash(frozenHash: string) {
  if (frozenHash !== targetScenarioHash()) {
    throw new TargetJudgeRequestError(
      "The scenario bundle differs from the frozen round. Judging is blocked.",
      409,
    );
  }
}

async function requireVerifiedEmail() {
  const email = await getVerifiedTargetEmail();
  if (!email) throw new TargetJudgeAccessError("Sign in required", 401);
  return email;
}

async function resolveJudgeIdentity(request: NextRequest): Promise<TargetJudgeIdentity> {
  const actorEmail = await requireVerifiedEmail();
  const seatValue = request.nextUrl.searchParams.get("rehearsalSeat");
  if (!seatValue) return { actorEmail, coordinatorRehearsal: false };
  if (!isTargetJudgeCoordinator(actorEmail)) {
    throw new TargetJudgeAccessError("Coordinator access required", 404);
  }
  const rehearsalSeat = Number(seatValue);
  if (!Number.isInteger(rehearsalSeat) || rehearsalSeat < 1 || rehearsalSeat > 3) {
    throw new TargetJudgeRequestError("Unknown rehearsal seat");
  }
  return { actorEmail, coordinatorRehearsal: true, rehearsalSeat };
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
  if (error instanceof TargetJudgeAccessError || error instanceof TargetJudgeRequestError) {
    return privateJson({ error: error.message }, { status: error.status });
  }
  console.error("Target judge error", error);
  return privateJson({ error: "Unable to update judge submission" }, { status: 500 });
}
