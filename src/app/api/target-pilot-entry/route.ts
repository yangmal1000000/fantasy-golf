import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import { TARGET_JUDGE_ROUND_SLUG } from "@/lib/target-judge-core";
import {
  targetPilotReference,
  validateTargetPilotSubmission,
  type TargetPilotStatusDto,
} from "@/lib/target-pilot-core";
import {
  TargetJudgeAccessError,
  getVerifiedTargetEmail,
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
    const email = await requireApprovedPilotEmail();
    await ensureTargetJudgeSchema();
    return privateJson(await readPilotStatus(email));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const email = await requireApprovedPilotEmail();
    await ensureTargetJudgeSchema();
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return privateJson({ ok: true, ...(await readPilotStatus(email)) });
  } catch (error) {
    return handleError(error);
  }
}

async function readPilotStatus(email: string): Promise<TargetPilotStatusDto> {
  const round = await prisma.targetJudgingRound.findUnique({
    where: { slug: TARGET_JUDGE_ROUND_SLUG },
    include: { pilotEntries: { where: { email }, take: 1 } },
  });
  if (!round) {
    return { roundStatus: "NOT_READY", entryOpen: false, sealedAt: null, entry: null };
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
  };
}

async function requireApprovedPilotEmail() {
  const email = await getVerifiedTargetEmail();
  if (!email) throw new TargetJudgeAccessError("Sign in required", 401);
  if (!isTargetPreviewAllowed(email)) {
    throw new TargetJudgeAccessError("Pilot access required", 404);
  }
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
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return privateJson(
      { error: "You already have a locked entry in this rehearsal" },
      { status: 409 },
    );
  }
  if (error instanceof TargetJudgeAccessError || error instanceof TargetPilotRequestError) {
    return privateJson({ error: error.message }, { status: error.status });
  }
  console.error("Target pilot entry error", error);
  return privateJson({ error: "Unable to save the pilot entry" }, { status: 500 });
}
