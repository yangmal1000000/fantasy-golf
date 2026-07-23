import "server-only";

import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureRocketBetaSchema } from "@/lib/rocket-beta-schema";
import { TARGET_JUDGE_ROUND_SLUG } from "@/lib/target-judge-core";

export const ROCKET_BETA_CAMPAIGN_SLUG = "rocket-classic-2026-beta";
export const ROCKET_BETA_TOURNAMENT_ID = "rocket-classic";
export const ROCKET_BETA_ENTRY_CLOSES_AT = new Date("2026-07-30T10:45:00.000Z");

const INITIAL_INVITES = [
  { email: "yangmal1000000@gmail.com", displayName: "Harry" },
  { email: "russglenn2@gmail.com", displayName: "Russ" },
] as const;

export type RocketBetaPassState = "LOCKED" | "UNLOCKED" | "REDEEMED";

export interface RocketBetaState {
  approved: boolean;
  campaignId: string | null;
  campaignStatus: string;
  tournamentId: typeof ROCKET_BETA_TOURNAMENT_ID;
  targetHref: "/target";
  tournamentHref: "/tournaments/rocket-classic";
  enterHref: "/tournaments/rocket-classic/enter";
  entryClosesAt: string;
  passState: RocketBetaPassState;
  unlockedAt: string | null;
  redeemedAt: string | null;
  teamId: string | null;
}

type BetaActor = Pick<User, "id" | "email" | "name">;

export class RocketBetaError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export async function ensureRocketBetaCampaign() {
  await ensureRocketBetaSchema();

  const [tournament, round] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: ROCKET_BETA_TOURNAMENT_ID },
      select: { id: true },
    }),
    prisma.targetJudgingRound.findUnique({
      where: { slug: TARGET_JUDGE_ROUND_SLUG },
      select: { id: true },
    }),
  ]);
  if (!tournament || !round) return null;

  return prisma.$transaction(async (tx) => {
    const campaign = await tx.rocketBetaCampaign.upsert({
      where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
      update: {
        tournamentId: tournament.id,
        targetRoundId: round.id,
        entryClosesAt: ROCKET_BETA_ENTRY_CLOSES_AT,
      },
      create: {
        slug: ROCKET_BETA_CAMPAIGN_SLUG,
        name: "Rocket Classic Closed Beta",
        tournamentId: tournament.id,
        targetRoundId: round.id,
        status: "OPEN",
        entryClosesAt: ROCKET_BETA_ENTRY_CLOSES_AT,
      },
    });

    for (const invite of INITIAL_INVITES) {
      await tx.rocketBetaMember.upsert({
        where: {
          campaignId_email: {
            campaignId: campaign.id,
            email: normaliseEmail(invite.email),
          },
        },
        update: { displayName: invite.displayName },
        create: {
          campaignId: campaign.id,
          email: normaliseEmail(invite.email),
          displayName: invite.displayName,
        },
      });
    }
    return campaign;
  });
}

export async function getRocketBetaStateForUser(
  user: BetaActor,
): Promise<RocketBetaState> {
  const campaign = await ensureRocketBetaCampaign();
  if (!campaign) return emptyState("NOT_READY");

  const email = normaliseEmail(user.email);
  let member = await prisma.rocketBetaMember.findUnique({
    where: { campaignId_email: { campaignId: campaign.id, email } },
  });
  if (!member?.active) return emptyState(campaign.status, campaign.id);
  if (member.userId && member.userId !== user.id) {
    return emptyState(campaign.status, campaign.id);
  }

  if (!member.userId || !member.acceptedAt) {
    member = await prisma.rocketBetaMember.update({
      where: { id: member.id },
      data: {
        userId: user.id,
        acceptedAt: member.acceptedAt ?? new Date(),
        displayName: member.displayName ?? user.name,
      },
    });
  }

  let pass = await prisma.rocketBetaPass.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
  });
  if (!pass) {
    const sourceEntry = await prisma.targetPilotEntry.findFirst({
      where: { roundId: campaign.targetRoundId, email },
      select: { id: true },
    });
    if (sourceEntry) {
      pass = await prisma.$transaction(
        (tx) =>
          grantRocketBetaPass(tx, {
            campaignId: campaign.id,
            memberId: member.id,
            user,
            sourceTargetEntryId: sourceEntry.id,
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }
  }

  return {
    approved: true,
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    tournamentId: ROCKET_BETA_TOURNAMENT_ID,
    targetHref: "/target",
    tournamentHref: "/tournaments/rocket-classic",
    enterHref: "/tournaments/rocket-classic/enter",
    entryClosesAt: (campaign.entryClosesAt ?? ROCKET_BETA_ENTRY_CLOSES_AT).toISOString(),
    passState: pass?.status === "REDEEMED" ? "REDEEMED" : pass ? "UNLOCKED" : "LOCKED",
    unlockedAt: pass?.unlockedAt.toISOString() ?? null,
    redeemedAt: pass?.redeemedAt?.toISOString() ?? null,
    teamId: pass?.teamId ?? null,
  };
}

export async function grantRocketBetaPass(
  tx: Prisma.TransactionClient,
  input: {
    campaignId: string;
    memberId: string;
    user: BetaActor;
    sourceTargetEntryId: string;
  },
) {
  const existing = await tx.rocketBetaPass.findUnique({
    where: {
      campaignId_userId: {
        campaignId: input.campaignId,
        userId: input.user.id,
      },
    },
  });
  if (existing) {
    if (existing.sourceTargetEntryId !== input.sourceTargetEntryId) {
      throw new RocketBetaError("This account already has a Test Pass", 409);
    }
    return existing;
  }

  const pass = await tx.rocketBetaPass.create({
    data: {
      campaignId: input.campaignId,
      memberId: input.memberId,
      userId: input.user.id,
      sourceTargetEntryId: input.sourceTargetEntryId,
    },
  });
  await tx.rocketBetaAudit.create({
    data: {
      campaignId: input.campaignId,
      actorUserId: input.user.id,
      actorEmail: normaliseEmail(input.user.email),
      action: "test_pass_unlocked",
      payload: {
        passId: pass.id,
        sourceTargetEntryId: input.sourceTargetEntryId,
      },
    },
  });
  return pass;
}

export async function requireRocketBetaEntryPass(
  tx: Prisma.TransactionClient,
  user: BetaActor,
) {
  const campaign = await tx.rocketBetaCampaign.findUnique({
    where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
  });
  if (!campaign || campaign.status !== "OPEN") {
    throw new RocketBetaError("Rocket Classic beta entries are not open", 409);
  }
  if (campaign.entryClosesAt && new Date() >= campaign.entryClosesAt) {
    throw new RocketBetaError("Rocket Classic beta entries are closed", 409);
  }
  const pass = await tx.rocketBetaPass.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
  });
  if (!pass) {
    throw new RocketBetaError("Complete Target to unlock your Rocket Classic Test Pass", 403);
  }
  if (pass.status !== "UNLOCKED" || pass.teamId) {
    throw new RocketBetaError("Your Rocket Classic Test Pass has already been used", 409);
  }
  return { campaign, pass };
}

function emptyState(
  campaignStatus: string,
  campaignId: string | null = null,
): RocketBetaState {
  return {
    approved: false,
    campaignId,
    campaignStatus,
    tournamentId: ROCKET_BETA_TOURNAMENT_ID,
    targetHref: "/target",
    tournamentHref: "/tournaments/rocket-classic",
    enterHref: "/tournaments/rocket-classic/enter",
    entryClosesAt: ROCKET_BETA_ENTRY_CLOSES_AT.toISOString(),
    passState: "LOCKED",
    unlockedAt: null,
    redeemedAt: null,
    teamId: null,
  };
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}
