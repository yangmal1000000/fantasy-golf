import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import { TARGET_SCENARIOS } from "@/lib/target-challenge";
import {
  TARGET_JUDGE_ROUND_SLUG,
  calculateOfficialTargets,
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
  TargetJudgeAccessError,
  getVerifiedTargetEmail,
  targetOfficialTargetsHash,
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

export async function GET() {
  try {
    const email = await requireVerifiedEmail();
    await ensureTargetJudgeSchema();
    return privateJson(await readJudgeContext(email));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const email = await requireVerifiedEmail();
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

    if (phase === "initial") {
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
      await lockInitialSubmission(email, submission);
    } else {
      await lockFinalSubmission(email, submission);
    }

    return privateJson({ ok: true, ...(await readJudgeContext(email)) });
  } catch (error) {
    return handleError(error);
  }
}

async function lockInitialSubmission(email: string, submission: TargetJudgeSubmission) {
  await prisma.$transaction(async (tx) => {
    const assignment = await findAssignment(tx, email);
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
        declarationConfirmedAt: now,
        initialSubmission: submission as unknown as Prisma.InputJsonValue,
        initialLockedAt: now,
      },
    });
    if (updated.count !== 1) throw new TargetJudgeRequestError("Initial marks were already locked", 409);

    await tx.targetJudgeAudit.create({
      data: {
        roundId: assignment.roundId,
        actorEmail: email,
        action: "judge_initial_locked",
        payload: { seat: assignment.seat, scenarioIds: TARGET_SCENARIOS.map((item) => item.id) },
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

async function lockFinalSubmission(email: string, submission: TargetJudgeSubmission) {
  await prisma.$transaction(async (tx) => {
    const assignment = await findAssignment(tx, email);
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
        actorEmail: email,
        action: "judge_final_locked",
        payload: { seat: assignment.seat, scenarioIds: TARGET_SCENARIOS.map((item) => item.id) },
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
    const transitioned = await tx.targetJudgingRound.updateMany({
      where: { id: assignment.roundId, status: "FINAL_MARKING" },
      data: {
        status: "CALCULATED",
        officialTargets: officialTargets as unknown as Prisma.InputJsonValue,
        officialTargetsHash,
        calculatedAt: now,
      },
    });
    if (transitioned.count === 1) {
      await tx.targetJudgeAudit.create({
        data: {
          roundId: assignment.roundId,
          actorEmail: "system",
          action: "official_targets_calculated",
          payload: {
            algorithm: officialTargets.algorithm,
            officialTargetsHash,
            inputSeats: finalSubmissions.map((item) => item.seat),
          },
        },
      });
    }
  });
}

async function findAssignment(tx: Prisma.TransactionClient, email: string) {
  const assignment = await tx.targetJudgeAssignment.findFirst({
    where: { email, round: { slug: TARGET_JUDGE_ROUND_SLUG } },
    include: { round: true },
  });
  if (!assignment) throw new TargetJudgeAccessError("Judge assignment not found", 404);
  return assignment;
}

async function readJudgeContext(email: string): Promise<TargetJudgeContextDto> {
  const assignment = await prisma.targetJudgeAssignment.findFirst({
    where: { email, round: { slug: TARGET_JUDGE_ROUND_SLUG } },
    include: {
      round: {
        include: { assignments: { orderBy: { seat: "asc" } } },
      },
    },
  });
  if (!assignment) throw new TargetJudgeAccessError("Judge assignment not found", 404);
  const { round } = assignment;
  if (!isTargetJudgeStatus(round.status)) throw new Error("Unknown judging status");

  const canSeeInitial = ["INITIAL_COMPLETE", "FINAL_MARKING", "CALCULATED"].includes(round.status);
  const canSeeFinal = round.status === "CALCULATED";
  const roundDto: TargetJudgeRoundDto = {
    id: round.id,
    slug: round.slug,
    name: round.name,
    scenarioVersion: round.scenarioVersion,
    scenarioHash: round.scenarioHash,
    status: round.status,
    officialTargets: canSeeFinal && round.officialTargets
      ? validateOfficialTargetsRecord(round.officialTargets)
      : null,
    officialTargetsHash: canSeeFinal ? round.officialTargetsHash : null,
    calculatedAt: canSeeFinal ? round.calculatedAt?.toISOString() ?? null : null,
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
