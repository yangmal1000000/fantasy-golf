import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateLeaderboard } from "@/lib/scoring";
import {
  buildRocketFinalResult,
  verifyRocketFinalResult,
} from "@/lib/rocket-finalization-core";
import {
  ROCKET_OFFICIAL_FIELD_ID,
  ROCKET_OFFICIAL_LEADERBOARD_URL,
} from "@/lib/rocket-official-config";

export interface RocketOfficialFinalizationEvidence {
  ok: boolean;
  finalizationReady: boolean;
  source: string;
  leaderboardId: string;
  tournamentStatus: string;
  evidenceHash: string | null;
  fieldPlayers: number;
  matchedFieldPlayers: number;
  requiredMatches: number;
}

export interface RocketFinalizationSummary {
  ready: boolean;
  finalized: boolean;
  alreadyFinal: boolean;
  campaignStatus: string | null;
  tournamentStatus: string | null;
  teamCount: number;
  completeTeams: number;
  incompleteTeams: Array<{
    teamId: string;
    teamName: string;
    roundsScored: number;
  }>;
  resultsHash: string | null;
  winnerTeamIds: string[];
  officialEvidenceHash: string | null;
  issues: string[];
}

export async function closeRocketCampaignForEvent(
  tournamentId: string,
  eventStatus: "in_progress" | "completed",
) {
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.rocketBetaCampaign.findUnique({
      where: { tournamentId },
      select: { id: true, status: true },
    });
    if (!campaign) return { changed: false, status: null };
    const updated = await tx.rocketBetaCampaign.updateMany({
      where: { id: campaign.id, status: "OPEN", finalizedAt: null },
      data: { status: "PAUSED" },
    });
    if (updated.count !== 1) {
      const latest = await tx.rocketBetaCampaign.findUnique({
        where: { id: campaign.id },
        select: { status: true },
      });
      return { changed: false, status: latest?.status ?? null };
    }
    await tx.rocketBetaAudit.create({
      data: {
        campaignId: campaign.id,
        actorEmail: "system:live-score-sync",
        action: "campaign_closed_automatically",
        payload: { eventStatus },
      },
    });
    return { changed: true, status: "PAUSED" };
  });
}

export async function finalizeRocketCampaign(input: {
  tournamentId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  officialEvidence?: RocketOfficialFinalizationEvidence | null;
}): Promise<RocketFinalizationSummary> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await finalizeRocketCampaignOnce(input);
    } catch (error) {
      if (attempt === 0 && isSerializableConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("Rocket finalization retry exhausted");
}

async function finalizeRocketCampaignOnce(input: {
  tournamentId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  officialEvidence?: RocketOfficialFinalizationEvidence | null;
}) {
  return prisma.$transaction(
    async (tx): Promise<RocketFinalizationSummary> => {
      await lockFinalizationSnapshot(tx, input.tournamentId);
      const [campaign, tournament] = await Promise.all([
        tx.rocketBetaCampaign.findUnique({
          where: { tournamentId: input.tournamentId },
        }),
        tx.tournament.findUnique({
          where: { id: input.tournamentId },
          select: { status: true },
        }),
      ]);

      if (campaign?.finalizedAt) {
        return alreadyFinalSummary({
          campaign,
          tournamentStatus: tournament?.status ?? null,
          tournamentId: input.tournamentId,
        });
      }

      const leaderboard = await calculateLeaderboard(input.tournamentId, tx);
      const incompleteTeams = leaderboard
        .filter(
          (team) => team.scoreState !== "FINAL" || team.roundsScored !== 20,
        )
        .map((team) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          roundsScored: team.roundsScored,
        }));
      const issues = finalizationIssues({
        campaign,
        tournamentStatus: tournament?.status ?? null,
        teamCount: leaderboard.length,
        incompleteTeams,
        officialEvidence: input.officialEvidence,
      });
      const completeTeams = leaderboard.length - incompleteTeams.length;

      if (issues.length || !campaign?.fieldHash) {
        return {
          ready: false,
          finalized: false,
          alreadyFinal: false,
          campaignStatus: campaign?.status ?? null,
          tournamentStatus: tournament?.status ?? null,
          teamCount: leaderboard.length,
          completeTeams,
          incompleteTeams,
          resultsHash: campaign?.resultsHash ?? null,
          winnerTeamIds: [],
          officialEvidenceHash: input.officialEvidence?.evidenceHash ?? null,
          issues,
        };
      }
      const officialEvidence =
        input.officialEvidence as RocketOfficialFinalizationEvidence;

      const finalizedAt = new Date();
      const teams = leaderboard.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        ownerName: team.ownerName,
        position: team.position,
        totalStrokes: team.totalStrokes,
        vsPar: team.vsPar,
        roundsScored: team.roundsScored,
        estimatedRounds: team.players.reduce(
          (total, player) =>
            total +
            player.isEstimated.filter((estimated) => estimated).length,
          0,
        ),
      }));
      const sealed = buildRocketFinalResult({
        tournamentId: input.tournamentId,
        fieldVersion: campaign.fieldVersion,
        fieldHash: campaign.fieldHash,
        finalizedAt: finalizedAt.toISOString(),
        teams,
      });
      const winnerTeamIds = teams
        .filter((team) => team.position === 1)
        .map((team) => team.teamId);

      await tx.rocketBetaCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "FINAL",
          results: sealed.result as unknown as Prisma.InputJsonValue,
          resultsHash: sealed.resultsHash,
          finalizedAt,
        },
      });
      await tx.rocketBetaAudit.create({
        data: {
          campaignId: campaign.id,
          actorUserId: input.actorUserId ?? null,
          actorEmail: input.actorEmail ?? "system:live-score-sync",
          action: "beta_result_finalized",
          payload: {
            teamCount: teams.length,
            winnerTeamIds,
            resultsHash: sealed.resultsHash,
            officialEvidence: {
              ok: officialEvidence.ok,
              finalizationReady: officialEvidence.finalizationReady,
              source: officialEvidence.source,
              leaderboardId: officialEvidence.leaderboardId,
              tournamentStatus: officialEvidence.tournamentStatus,
              evidenceHash: officialEvidence.evidenceHash,
              fieldPlayers: officialEvidence.fieldPlayers,
              matchedFieldPlayers: officialEvidence.matchedFieldPlayers,
              requiredMatches: officialEvidence.requiredMatches,
            },
          },
        },
      });

      return {
        ready: true,
        finalized: true,
        alreadyFinal: false,
        campaignStatus: "FINAL",
        tournamentStatus: tournament?.status ?? null,
        teamCount: teams.length,
        completeTeams: teams.length,
        incompleteTeams: [],
        resultsHash: sealed.resultsHash,
        winnerTeamIds,
        officialEvidenceHash: officialEvidence.evidenceHash,
        issues: [],
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

async function lockFinalizationSnapshot(
  tx: Prisma.TransactionClient,
  tournamentId: string,
) {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "RocketBetaCampaign"
    WHERE "tournamentId" = ${tournamentId}
    FOR UPDATE
  `);
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Tournament"
    WHERE "id" = ${tournamentId}
    FOR SHARE
  `);
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "TournamentPlayer"
    WHERE "tournamentId" = ${tournamentId}
    FOR SHARE
  `);
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Score"
    WHERE "tournamentId" = ${tournamentId}
    FOR SHARE
  `);
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Team"
    WHERE "tournamentId" = ${tournamentId}
    FOR SHARE
  `);
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT selection."id"
    FROM "TeamSelection" AS selection
    INNER JOIN "Team" AS team ON team."id" = selection."teamId"
    WHERE team."tournamentId" = ${tournamentId}
    FOR SHARE OF selection
  `);
}

function finalizationIssues(input: {
  campaign:
    | {
        fieldFrozenAt: Date | null;
        fieldHash: string | null;
      }
    | null;
  tournamentStatus: string | null;
  teamCount: number;
  incompleteTeams: RocketFinalizationSummary["incompleteTeams"];
  officialEvidence?: RocketOfficialFinalizationEvidence | null;
}) {
  const issues: string[] = [];
  if (!input.campaign) issues.push("Campaign not found");
  if (!input.campaign?.fieldFrozenAt || !input.campaign.fieldHash) {
    issues.push("Final field is not frozen");
  }
  if (input.tournamentStatus !== "completed") {
    issues.push("Tournament is not completed");
  }
  if (input.teamCount === 0) issues.push("No confirmed teams");
  if (input.incompleteTeams.length) {
    issues.push(
      `${input.incompleteTeams.length} team(s) do not have 20 scored rounds`,
    );
  }
  if (!isRocketOfficialFinalizationEvidenceValid(input.officialEvidence)) {
    issues.push("Verified completed official leaderboard evidence is required");
  }
  return issues;
}

export function isRocketOfficialFinalizationEvidenceValid(
  evidence?: RocketOfficialFinalizationEvidence | null,
) {
  return Boolean(
    evidence?.ok &&
      evidence.finalizationReady &&
      evidence.source === ROCKET_OFFICIAL_LEADERBOARD_URL &&
      evidence.leaderboardId === ROCKET_OFFICIAL_FIELD_ID &&
      evidence.tournamentStatus === "COMPLETED" &&
      evidence.evidenceHash &&
      /^[a-f0-9]{64}$/.test(evidence.evidenceHash) &&
      evidence.fieldPlayers >= evidence.requiredMatches &&
      evidence.matchedFieldPlayers >= evidence.requiredMatches &&
      evidence.matchedFieldPlayers <= evidence.fieldPlayers &&
      evidence.requiredMatches > 0,
  );
}

function alreadyFinalSummary(input: {
  campaign: {
    status: string;
    results: Prisma.JsonValue | null;
    resultsHash: string | null;
  };
  tournamentStatus: string | null;
  tournamentId: string;
}): RocketFinalizationSummary {
  const verified = verifyRocketFinalResult({
    value: input.campaign.results,
    expectedHash: input.campaign.resultsHash,
    expectedTournamentId: input.tournamentId,
  });
  if (!verified.ok) {
    return {
      ready: false,
      finalized: false,
      alreadyFinal: true,
      campaignStatus: input.campaign.status,
      tournamentStatus: input.tournamentStatus,
      teamCount: 0,
      completeTeams: 0,
      incompleteTeams: [],
      resultsHash: input.campaign.resultsHash,
      winnerTeamIds: [],
      officialEvidenceHash: null,
      issues: [verified.issue],
    };
  }
  return {
    ready: true,
    finalized: false,
    alreadyFinal: true,
    campaignStatus: input.campaign.status,
    tournamentStatus: input.tournamentStatus,
    teamCount: verified.result.teams.length,
    completeTeams: verified.result.teams.length,
    incompleteTeams: [],
    resultsHash: verified.resultsHash,
    winnerTeamIds: verified.winners.map((team) => team.teamId),
    officialEvidenceHash: null,
    issues: [],
  };
}

function isSerializableConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}
