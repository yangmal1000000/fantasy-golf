import "server-only";

import {
  Prisma,
  type RocketBetaCampaign,
  type RocketBetaMember,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRocketBetaRegistrationOpen } from "@/lib/rocket-beta-access";
import { ROCKET_BETA_ENTRY_CLOSES_AT } from "@/lib/rocket-beta-config";
import { ensureRocketBetaSchema } from "@/lib/rocket-beta-schema";
import { TARGET_JUDGE_ROUND_SLUG } from "@/lib/target-judge-core";

export const ROCKET_BETA_CAMPAIGN_SLUG = "rocket-classic-2026-beta";
export const ROCKET_BETA_TOURNAMENT_ID = "rocket-classic";
export { ROCKET_BETA_ENTRY_CLOSES_AT } from "@/lib/rocket-beta-config";

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
  fieldVersion: string | null;
  fieldFrozenAt: string | null;
  fieldReady: boolean;
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
        name: "Rocket Classic Test Flight",
        tournamentId: tournament.id,
        targetRoundId: round.id,
        entryClosesAt: ROCKET_BETA_ENTRY_CLOSES_AT,
      },
      create: {
        slug: ROCKET_BETA_CAMPAIGN_SLUG,
        name: "Rocket Classic Test Flight",
        tournamentId: tournament.id,
        targetRoundId: round.id,
        status: "OPEN",
        entryClosesAt: ROCKET_BETA_ENTRY_CLOSES_AT,
      },
    });
    return campaign;
  });
}

export async function getRocketBetaStateForUser(
  user: BetaActor,
): Promise<RocketBetaState> {
  const campaign = await ensureRocketBetaCampaign();
  if (!campaign) return emptyState("NOT_READY");

  const email = normaliseEmail(user.email);
  const member = await enrolRocketBetaParticipant(campaign, user);
  if (!member) return emptyState(campaign.status, campaign.id);

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
    fieldVersion: campaign.fieldVersion,
    fieldFrozenAt: campaign.fieldFrozenAt?.toISOString() ?? null,
    fieldReady: Boolean(campaign.fieldFrozenAt && campaign.fieldHash),
    passState: pass?.status === "REDEEMED" ? "REDEEMED" : pass ? "UNLOCKED" : "LOCKED",
    unlockedAt: pass?.unlockedAt.toISOString() ?? null,
    redeemedAt: pass?.redeemedAt?.toISOString() ?? null,
    teamId: pass?.teamId ?? null,
  };
}

async function enrolRocketBetaParticipant(
  campaign: RocketBetaCampaign,
  user: BetaActor,
): Promise<RocketBetaMember | null> {
  const email = normaliseEmail(user.email);
  const [memberByEmail, memberByUser] = await Promise.all([
    prisma.rocketBetaMember.findUnique({
      where: { campaignId_email: { campaignId: campaign.id, email } },
    }),
    prisma.rocketBetaMember.findUnique({
      where: {
        campaignId_userId: { campaignId: campaign.id, userId: user.id },
      },
    }),
  ]);
  if (memberByEmail && memberByUser && memberByEmail.id !== memberByUser.id) {
    return null;
  }

  let member = memberByEmail ?? memberByUser;
  if (!member) {
    if (
      !isRocketBetaRegistrationOpen({
        status: campaign.status,
        entryClosesAt: campaign.entryClosesAt,
      })
    ) {
      return null;
    }
    try {
      member = await prisma.$transaction(
        async (tx) => {
          const created = await tx.rocketBetaMember.create({
            data: {
              campaignId: campaign.id,
              email,
              userId: user.id,
              displayName: user.name,
              acceptedAt: new Date(),
            },
          });
          await tx.rocketBetaAudit.create({
            data: {
              campaignId: campaign.id,
              actorUserId: user.id,
              actorEmail: email,
              action: "participant_joined",
              payload: { memberId: created.id, accessMode: "open_registration" },
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
      member = await prisma.rocketBetaMember.findFirst({
        where: {
          campaignId: campaign.id,
          OR: [{ email }, { userId: user.id }],
        },
      });
    }
  }

  if (!member?.active) return null;
  if (member.userId && member.userId !== user.id) return null;
  if (
    (!member.userId || !member.acceptedAt) &&
    !isRocketBetaRegistrationOpen({
      status: campaign.status,
      entryClosesAt: campaign.entryClosesAt,
    })
  ) {
    return null;
  }

  if (!member.userId || !member.acceptedAt) {
    const joinedAt = member.acceptedAt ?? new Date();
    member = await prisma.$transaction(async (tx) => {
      const accepted = await tx.rocketBetaMember.update({
        where: { id: member!.id },
        data: {
          userId: user.id,
          acceptedAt: joinedAt,
          displayName: member!.displayName ?? user.name,
        },
      });
      if (!member!.acceptedAt) {
        await tx.rocketBetaAudit.create({
          data: {
            campaignId: campaign.id,
            actorUserId: user.id,
            actorEmail: email,
            action: "participant_joined",
            payload: {
              memberId: accepted.id,
              accessMode: "open_registration",
            },
          },
        });
      }
      return accepted;
    });
  }
  return member;
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
  if (!campaign.fieldFrozenAt || !campaign.fieldHash) {
    throw new RocketBetaError(
      "The reviewed Rocket Classic field is not open for team selection yet",
      409,
    );
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
    fieldVersion: null,
    fieldFrozenAt: null,
    fieldReady: false,
    passState: "LOCKED",
    unlockedAt: null,
    redeemedAt: null,
    teamId: null,
  };
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}
