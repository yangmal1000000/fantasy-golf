import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  RocketBetaError,
  ensureRocketBetaCampaign,
  getRocketBetaStateForUser,
  grantRocketBetaPass,
} from "@/lib/rocket-beta";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import { TARGET_JUDGE_ROUND_SLUG } from "@/lib/target-judge-core";
import {
  targetPilotReference,
  validateTargetPilotSubmission,
  type TargetPilotStatusDto,
} from "@/lib/target-pilot-core";
import {
  TargetJudgeAccessError,
  targetPilotSubmissionHash,
  targetScenarioHash,
} from "@/lib/target-judge-server";
import { isTargetPreviewAllowed } from "@/lib/target-preview-access";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

class TargetPilotRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function GET() {
  try {
    const user = await requireApprovedPilotUser();
    await ensureTargetJudgeSchema();
    return privateJson(await readPilotStatus(user));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApprovedPilotUser();
    const email = user.email.trim().toLowerCase();
    await ensureTargetJudgeSchema();
    const campaign = await ensureRocketBetaCampaign();
    if (!campaign) {
      throw new TargetPilotRequestError("The Rocket Classic beta is not ready", 404);
    }
    const body = (await request.json()) as { submission?: unknown };
    const submission = validateTargetPilotSubmission(body.submission);

    await prisma.$transaction(async (tx) => {
      const round = await tx.targetJudgingRound.findUnique({
        where: { slug: TARGET_JUDGE_ROUND_SLUG },
      });
      if (!round) throw new TargetPilotRequestError("The closed pilot round is not ready", 404);
      if (round.status !== "DRAFT" || round.pilotEntriesSealedAt) {
        throw new TargetPilotRequestError("Pilot entries are closed and sealed", 409);
      }
      const currentScenarioHash = targetScenarioHash();
      if (round.scenarioHash !== currentScenarioHash) {
        throw new TargetPilotRequestError("The pilot scenario version has changed", 409);
      }
      const member = await tx.rocketBetaMember.findUnique({
        where: { campaignId_email: { campaignId: campaign.id, email } },
      });
      if (!member?.active || (member.userId && member.userId !== user.id)) {
        throw new TargetJudgeAccessError("Pilot access required", 404);
      }
      const acceptedMember = await tx.rocketBetaMember.update({
        where: { id: member.id },
        data: {
          userId: user.id,
          acceptedAt: member.acceptedAt ?? new Date(),
          displayName: member.displayName ?? user.name,
        },
      });

      const submissionHash = targetPilotSubmissionHash({
        scenarioHash: round.scenarioHash,
        email,
        submission,
      });
      const entry = await tx.targetPilotEntry.create({
        data: {
          roundId: round.id,
          email,
          submission: submission as unknown as Prisma.InputJsonValue,
          submissionHash,
        },
      });
      await tx.targetJudgeAudit.create({
        data: {
          roundId: round.id,
          actorEmail: email,
          action: "pilot_entry_submitted",
          payload: {
            entryId: entry.id,
            reference: targetPilotReference(entry.id),
            submissionHash,
          },
        },
      });
      await grantRocketBetaPass(tx, {
        campaignId: campaign.id,
        memberId: acceptedMember.id,
        user,
        sourceTargetEntryId: entry.id,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return privateJson({ ok: true, ...(await readPilotStatus(user)) });
  } catch (error) {
    return handleError(error);
  }
}

async function readPilotStatus(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): Promise<TargetPilotStatusDto> {
  const email = user.email.trim().toLowerCase();
  const rocketBeta = await getRocketBetaStateForUser(user);
  const round = await prisma.targetJudgingRound.findUnique({
    where: { slug: TARGET_JUDGE_ROUND_SLUG },
    include: { pilotEntries: { where: { email }, take: 1 } },
  });
  if (!round) {
    return {
      roundStatus: "NOT_READY",
      entryOpen: false,
      sealedAt: null,
      entry: null,
      rocketPass: rocketPassDto(rocketBeta),
    };
  }
  const entry = round.pilotEntries[0];
  return {
    roundStatus: round.status,
    entryOpen: round.status === "DRAFT" && !round.pilotEntriesSealedAt,
    sealedAt: round.pilotEntriesSealedAt?.toISOString() ?? null,
    entry: entry
      ? {
          id: entry.id,
          reference: targetPilotReference(entry.id),
          submission: validateTargetPilotSubmission(entry.submission),
          submissionHash: entry.submissionHash,
          submittedAt: entry.submittedAt.toISOString(),
        }
      : null,
    rocketPass: rocketPassDto(rocketBeta),
  };
}

async function requireApprovedPilotUser() {
  const user = await getCurrentUser();
  if (!user) throw new TargetJudgeAccessError("Sign in required", 401);
  if (!isTargetPreviewAllowed(user.email)) {
    throw new TargetJudgeAccessError("Pilot access required", 404);
  }
  return user;
}

function rocketPassDto(
  state: Awaited<ReturnType<typeof getRocketBetaStateForUser>>,
): TargetPilotStatusDto["rocketPass"] {
  return {
    approved: state.approved,
    status: state.passState,
    tournamentId: state.tournamentId,
    tournamentHref: state.tournamentHref,
    enterHref: state.enterHref,
    entryClosesAt: state.entryClosesAt,
    unlockedAt: state.unlockedAt,
    redeemedAt: state.redeemedAt,
    teamId: state.teamId,
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
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return privateJson(
      { error: "You already have a locked entry in this rehearsal" },
      { status: 409 },
    );
  }
  if (
    error instanceof TargetJudgeAccessError ||
    error instanceof TargetPilotRequestError ||
    error instanceof RocketBetaError
  ) {
    return privateJson({ error: error.message }, { status: error.status });
  }
  console.error("Target pilot entry error", error);
  return privateJson({ error: "Unable to save the pilot entry" }, { status: 500 });
}
