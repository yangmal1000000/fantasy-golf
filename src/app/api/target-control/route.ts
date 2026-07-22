import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import {
  TARGET_JUDGE_ROUND_SLUG,
  TARGET_SCENARIO_VERSION,
  isTargetJudgeStatus,
  validateJudgeSubmission,
  validateOfficialTargetsRecord,
  validateTargetJudgePanel,
  type TargetJudgeControlDto,
  type TargetJudgeRoundDto,
} from "@/lib/target-judge-core";
import {
  TargetJudgeAccessError,
  requireTargetJudgeCoordinator,
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
  });
}

async function openInitialMarking(actorEmail: string) {
  await prisma.$transaction(async (tx) => {
    const round = await requireDraftRound(tx);
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
      auditEvents: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!round) return { round: null, assignments: [], auditEvents: [] };
  if (!isTargetJudgeStatus(round.status)) throw new Error("Unknown judging status");
  const revealInitial = ["INITIAL_COMPLETE", "FINAL_MARKING", "CALCULATED"].includes(round.status);
  const revealFinal = round.status === "CALCULATED";

  const roundDto: TargetJudgeRoundDto = {
    id: round.id,
    slug: round.slug,
    name: round.name,
    scenarioVersion: round.scenarioVersion,
    scenarioHash: round.scenarioHash,
    status: round.status,
    officialTargets: round.officialTargets
      ? validateOfficialTargetsRecord(round.officialTargets)
      : null,
    officialTargetsHash: round.officialTargetsHash,
    calculatedAt: round.calculatedAt?.toISOString() ?? null,
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
