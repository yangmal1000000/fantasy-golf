import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_CAMPAIGN_SLUG,
  ensureRocketBetaCampaign,
} from "@/lib/rocket-beta";
import { calculateLeaderboard } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

class ControlError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function GET(request: NextRequest) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    await ensureRocketBetaCampaign();
    return privateJson(await readControl());
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const actor = await getCurrentUser();
    if (!actor) throw new ControlError("Authentication required", 401);
    const campaign = await ensureRocketBetaCampaign();
    if (!campaign) throw new ControlError("Rocket beta is not ready", 404);
    const body = (await request.json()) as {
      action?: unknown;
      memberId?: unknown;
      active?: unknown;
      status?: unknown;
    };

    switch (body.action) {
      case "set_member_active":
        await setMemberActive(
          campaign.id,
          actor.id,
          actor.email,
          body.memberId,
          body.active,
        );
        break;
      case "set_status":
        await setCampaignStatus(
          campaign.id,
          actor.id,
          actor.email,
          body.status,
        );
        break;
      case "finalize":
        await finalizeCampaign(campaign.id, actor.id, actor.email);
        break;
      default:
        throw new ControlError("Unknown Rocket beta control action");
    }

    return privateJson({ ok: true, ...(await readControl()) });
  } catch (error) {
    return handleError(error);
  }
}

async function setMemberActive(
  campaignId: string,
  actorUserId: string,
  actorEmail: string,
  rawMemberId: unknown,
  rawActive: unknown,
) {
  if (typeof rawMemberId !== "string" || typeof rawActive !== "boolean") {
    throw new ControlError("Invalid member update");
  }
  const member = await prisma.rocketBetaMember.findFirst({
    where: { id: rawMemberId, campaignId },
    include: { passes: true },
  });
  if (!member) throw new ControlError("Participant not found", 404);
  if (!rawActive && member.passes.some((pass) => pass.teamId)) {
    throw new ControlError("A participant with a confirmed team cannot be deactivated", 409);
  }
  await prisma.$transaction(async (tx) => {
    await tx.rocketBetaMember.update({
      where: { id: member.id },
      data: { active: rawActive },
    });
    await tx.rocketBetaPass.updateMany({
      where: { memberId: member.id, teamId: null },
      data: { status: rawActive ? "UNLOCKED" : "REVOKED" },
    });
    await tx.rocketBetaAudit.create({
      data: {
        campaignId,
        actorUserId,
        actorEmail,
        action: rawActive ? "participant_reactivated" : "participant_deactivated",
        payload: { memberId: member.id, email: member.email },
      },
    });
  });
}

async function setCampaignStatus(
  campaignId: string,
  actorUserId: string,
  actorEmail: string,
  rawStatus: unknown,
) {
  if (rawStatus !== "OPEN" && rawStatus !== "PAUSED") {
    throw new ControlError("Campaign status must be OPEN or PAUSED");
  }
  const campaign = await prisma.rocketBetaCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign || campaign.finalizedAt) {
    throw new ControlError("A finalized campaign cannot be reopened", 409);
  }
  await prisma.$transaction([
    prisma.rocketBetaCampaign.update({
      where: { id: campaignId },
      data: { status: rawStatus },
    }),
    prisma.rocketBetaAudit.create({
      data: {
        campaignId,
        actorUserId,
        actorEmail,
        action: rawStatus === "OPEN" ? "campaign_opened" : "campaign_paused",
      },
    }),
  ]);
}

async function finalizeCampaign(
  campaignId: string,
  actorUserId: string,
  actorEmail: string,
) {
  const campaign = await prisma.rocketBetaCampaign.findUnique({
    where: { id: campaignId },
    include: { passes: true },
  });
  if (!campaign) throw new ControlError("Campaign not found", 404);
  if (campaign.finalizedAt) return;
  if (!campaign.fieldFrozenAt || !campaign.fieldHash) {
    throw new ControlError("Freeze the final field before finalization", 409);
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id: campaign.tournamentId },
  });
  if (!tournament || tournament.status !== "completed") {
    throw new ControlError("The Rocket Classic must be marked completed first", 409);
  }
  const leaderboard = await calculateLeaderboard(campaign.tournamentId);
  if (leaderboard.length === 0) {
    throw new ControlError("At least one confirmed team is required", 409);
  }
  if (
    leaderboard.some(
      (team) => team.scoreState !== "FINAL" || team.roundsScored !== 20,
    )
  ) {
    throw new ControlError("Every confirmed team needs a complete 20-round score", 409);
  }

  const finalizedAt = new Date();
  const result = {
    version: "rocket-beta-result-v1",
    scoringPolicy: "relative-to-par-per-scored-round-v1",
    tournamentId: campaign.tournamentId,
    fieldVersion: campaign.fieldVersion,
    fieldHash: campaign.fieldHash,
    finalizedAt: finalizedAt.toISOString(),
    teams: leaderboard.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      ownerName: team.ownerName,
      position: team.position,
      totalStrokes: team.totalStrokes,
      vsPar: team.vsPar,
      tied: leaderboard.filter((candidate) => candidate.position === team.position).length > 1,
    })),
  };
  const resultsHash = sha256(result);

  await prisma.$transaction(
    async (tx) => {
      const updated = await tx.rocketBetaCampaign.updateMany({
        where: { id: campaignId, finalizedAt: null },
        data: {
          status: "FINAL",
          results: result as unknown as Prisma.InputJsonValue,
          resultsHash,
          finalizedAt,
        },
      });
      if (updated.count !== 1) return;
      await tx.rocketBetaAudit.create({
        data: {
          campaignId,
          actorUserId,
          actorEmail,
          action: "beta_result_finalized",
          payload: {
            teamCount: leaderboard.length,
            winnerTeamIds: leaderboard
              .filter((team) => team.position === 1)
              .map((team) => team.teamId),
            resultsHash,
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function readControl() {
  const campaign = await prisma.rocketBetaCampaign.findUnique({
    where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
    include: {
      members: {
        orderBy: { invitedAt: "asc" },
        include: { passes: true },
      },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!campaign) throw new ControlError("Campaign not found", 404);
  const [targetEntries, teams, fieldCount] = await Promise.all([
    prisma.targetPilotEntry.findMany({
      where: { roundId: campaign.targetRoundId },
      select: { id: true, email: true, submittedAt: true },
    }),
    prisma.team.findMany({
      where: { tournamentId: campaign.tournamentId },
      select: {
        id: true,
        name: true,
        user: { select: { email: true, name: true } },
        createdAt: true,
      },
    }),
    prisma.tournamentPlayer.count({
      where: { tournamentId: campaign.tournamentId },
    }),
  ]);
  const entryByEmail = new Map(targetEntries.map((entry) => [entry.email, entry]));
  return {
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      tournamentId: campaign.tournamentId,
      entryClosesAt: campaign.entryClosesAt?.toISOString() ?? null,
      fieldVersion: campaign.fieldVersion,
      fieldHash: campaign.fieldHash,
      fieldFrozenAt: campaign.fieldFrozenAt?.toISOString() ?? null,
      fieldCount,
      results: campaign.results,
      resultsHash: campaign.resultsHash,
      finalizedAt: campaign.finalizedAt?.toISOString() ?? null,
    },
    members: campaign.members.map((member) => {
      const pass = member.passes[0] ?? null;
      const targetEntry = entryByEmail.get(member.email) ?? null;
      return {
        id: member.id,
        email: member.email,
        displayName: member.displayName,
        active: member.active,
        linked: Boolean(member.userId),
        joinedAt: (member.acceptedAt ?? member.invitedAt).toISOString(),
        targetSubmittedAt: targetEntry?.submittedAt.toISOString() ?? null,
        passStatus: pass?.status ?? null,
        passUnlockedAt: pass?.unlockedAt.toISOString() ?? null,
        teamId: pass?.teamId ?? null,
      };
    }),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      ownerName: team.user.name ?? team.user.email,
      ownerEmail: team.user.email,
      createdAt: team.createdAt.toISOString(),
    })),
    auditEvents: campaign.auditEvents.map((event) => ({
      id: event.id,
      actorEmail: event.actorEmail,
      action: event.action,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function privateJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...init?.headers },
  });
}

function handleError(error: unknown) {
  if (error instanceof ControlError) {
    return privateJson({ error: error.message }, { status: error.status });
  }
  console.error("Rocket beta control error", error);
  return privateJson({ error: "Unable to update Rocket beta control" }, { status: 500 });
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
