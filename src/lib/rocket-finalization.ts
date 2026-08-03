import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateLeaderboard } from "@/lib/scoring";
import { buildRocketFinalResult } from "@/lib/rocket-finalization-core";

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
  issues: string[];
}

export async function closeRocketCampaignForEvent(
  tournamentId: string,
  eventStatus: "in_progress" | "completed",
) {
  const campaign = await prisma.rocketBetaCampaign.findUnique({
    where: { tournamentId },
    select: { id: true, status: true, finalizedAt: true },
  });
  if (!campaign || campaign.finalizedAt || campaign.status !== "OPEN") {
    return { changed: false, status: campaign?.status ?? null };
  }
  await prisma.$transaction([
    prisma.rocketBetaCampaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
    }),
    prisma.rocketBetaAudit.create({
      data: {
        campaignId: campaign.id,
        actorEmail: "system:live-score-sync",
        action: "campaign_closed_automatically",
        payload: { eventStatus },
      },
    }),
  ]);
  return { changed: true, status: "PAUSED" };
}

export async function finalizeRocketCampaign(input: {
  tournamentId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
}): Promise<RocketFinalizationSummary> {
  const [campaign, tournament, leaderboard] = await Promise.all([
    prisma.rocketBetaCampaign.findUnique({
      where: { tournamentId: input.tournamentId },
    }),
    prisma.tournament.findUnique({
      where: { id: input.tournamentId },
      select: { status: true },
    }),
    calculateLeaderboard(input.tournamentId).catch(() => []),
  ]);
  const incompleteTeams = leaderboard
    .filter((team) => team.scoreState !== "FINAL" || team.roundsScored !== 20)
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      roundsScored: team.roundsScored,
    }));
  const issues: string[] = [];
  if (!campaign) issues.push("Campaign not found");
  if (!campaign?.fieldFrozenAt || !campaign.fieldHash) {
    issues.push("Final field is not frozen");
  }
  if (!tournament || tournament.status !== "completed") {
    issues.push("Tournament is not completed");
  }
  if (leaderboard.length === 0) issues.push("No confirmed teams");
  if (incompleteTeams.length) {
    issues.push(`${incompleteTeams.length} team(s) do not have 20 scored rounds`);
  }
  const completeTeams = leaderboard.length - incompleteTeams.length;

  if (campaign?.finalizedAt) {
    const winners = resultWinnerIds(campaign.results);
    return {
      ready: true,
      finalized: false,
      alreadyFinal: true,
      campaignStatus: campaign.status,
      tournamentStatus: tournament?.status ?? null,
      teamCount: leaderboard.length,
      completeTeams,
      incompleteTeams,
      resultsHash: campaign.resultsHash,
      winnerTeamIds: winners,
      issues: [],
    };
  }
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
      issues,
    };
  }

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
        total + player.isEstimated.filter((estimated) => estimated).length,
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

  const changed = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.rocketBetaCampaign.updateMany({
        where: { id: campaign.id, finalizedAt: null },
        data: {
          status: "FINAL",
          results: sealed.result as unknown as Prisma.InputJsonValue,
          resultsHash: sealed.resultsHash,
          finalizedAt,
        },
      });
      if (updated.count !== 1) return false;
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
          },
        },
      });
      return true;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  const latest = changed
    ? null
    : await prisma.rocketBetaCampaign.findUnique({
        where: { id: campaign.id },
        select: { status: true, resultsHash: true, results: true },
      });
  return {
    ready: true,
    finalized: changed,
    alreadyFinal: !changed,
    campaignStatus: changed ? "FINAL" : latest?.status ?? campaign.status,
    tournamentStatus: tournament?.status ?? null,
    teamCount: teams.length,
    completeTeams: teams.length,
    incompleteTeams: [],
    resultsHash: changed ? sealed.resultsHash : latest?.resultsHash ?? null,
    winnerTeamIds: changed ? winnerTeamIds : resultWinnerIds(latest?.results),
    issues: [],
  };
}

function resultWinnerIds(results: unknown): string[] {
  if (!results || typeof results !== "object" || Array.isArray(results)) return [];
  const teams = (results as { teams?: unknown }).teams;
  if (!Array.isArray(teams)) return [];
  return teams.flatMap((team) => {
    if (!team || typeof team !== "object" || Array.isArray(team)) return [];
    const row = team as { teamId?: unknown; position?: unknown };
    return row.position === 1 && typeof row.teamId === "string"
      ? [row.teamId]
      : [];
  });
}
