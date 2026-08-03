import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  fetchPgaTourLeaderboard,
  normalizeGolfPlayerName,
  type PgaTourLeaderboardEvidence,
} from "@/lib/pga-tour-leaderboard";
import { ROCKET_OFFICIAL_FIELD_ID } from "@/lib/rocket-field-freeze";

export const ROCKET_OFFICIAL_LEADERBOARD_URL =
  "https://www.pgatour.com/tournaments/2026/rocket-classic/R2026524/leaderboard";

export interface OfficialReconciliationSummary {
  ok: boolean;
  source: string;
  leaderboardId: string;
  tournamentStatus: string;
  officialPlayers: number;
  selectedPlayers: number;
  statusesUpdated: number;
  scoresCreated: number;
  scoresUpdated: number;
  dnsPlayers: string[];
  withdrawnPlayers: string[];
  errors: string[];
}

/**
 * Reconcile only golfers that affect confirmed Rocket teams. ESPN remains the
 * fast live feed; PGA TOUR is the final authority for WD/DNS state and any
 * official round value ESPN omitted.
 */
export async function reconcileRocketOfficialLeaderboard(
  tournamentId: string,
): Promise<OfficialReconciliationSummary> {
  let evidence: PgaTourLeaderboardEvidence;
  try {
    evidence = await fetchPgaTourLeaderboard({
      leaderboardId: ROCKET_OFFICIAL_FIELD_ID,
      sourceUrl: ROCKET_OFFICIAL_LEADERBOARD_URL,
    });
  } catch (error) {
    return failure(error);
  }

  const selected = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, selections: { some: {} } },
    select: {
      id: true,
      playerId: true,
      madeCut: true,
      withdrew: true,
      player: { select: { name: true } },
    },
  });
  const existingScores = await prisma.score.findMany({
    where: {
      tournamentId,
      playerId: { in: selected.map((player) => player.playerId) },
    },
    select: {
      playerId: true,
      round: true,
      strokes: true,
      isEstimated: true,
    },
  });
  const officialByName = new Map(
    evidence.players.map((player) => [
      normalizeGolfPlayerName(player.name),
      player,
    ]),
  );
  const scoreByKey = new Map(
    existingScores.map((score) => [
      `${score.playerId}:${score.round}`,
      score,
    ]),
  );
  const completed = evidence.tournamentStatus === "COMPLETED";
  const statusUpdates: Array<{
    id: string;
    madeCut: boolean | null;
    withdrew: boolean;
  }> = [];
  const scoreCreates: Array<{
    tournamentId: string;
    playerId: string;
    round: number;
    strokes: number;
    isEstimated: boolean;
  }> = [];
  const scoreUpdates: Array<{
    tournamentId: string;
    playerId: string;
    round: number;
    strokes: number;
  }> = [];
  const dnsPlayers: string[] = [];
  const withdrawnPlayers: string[] = [];

  for (const selectedPlayer of selected) {
    const official = officialByName.get(
      normalizeGolfPlayerName(selectedPlayer.player.name),
    );
    const hasAnyScore = existingScores.some(
      (score) => score.playerId === selectedPlayer.playerId,
    );
    const absentFinalStarter = completed && !official && !hasAnyScore;
    const withdrew =
      selectedPlayer.withdrew || official?.withdrew === true || absentFinalStarter;
    const madeCut = official?.madeCut ?? selectedPlayer.madeCut;

    if (absentFinalStarter) dnsPlayers.push(selectedPlayer.player.name);
    if (official?.withdrew) withdrawnPlayers.push(selectedPlayer.player.name);
    if (
      withdrew !== selectedPlayer.withdrew ||
      madeCut !== selectedPlayer.madeCut
    ) {
      statusUpdates.push({ id: selectedPlayer.id, madeCut, withdrew });
    }

    if (!official) continue;
    official.rounds.forEach((strokes, index) => {
      if (strokes === null) return;
      const round = index + 1;
      const existing = scoreByKey.get(`${selectedPlayer.playerId}:${round}`);
      if (!existing) {
        scoreCreates.push({
          tournamentId,
          playerId: selectedPlayer.playerId,
          round,
          strokes,
          isEstimated: false,
        });
      } else if (existing.strokes !== strokes || existing.isEstimated) {
        scoreUpdates.push({
          tournamentId,
          playerId: selectedPlayer.playerId,
          round,
          strokes,
        });
      }
    });
  }

  if (statusUpdates.length || scoreCreates.length || scoreUpdates.length) {
    const campaign = await prisma.rocketBetaCampaign.findUnique({
      where: { tournamentId },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      for (const update of statusUpdates) {
        await tx.tournamentPlayer.update({
          where: { id: update.id },
          data: { madeCut: update.madeCut, withdrew: update.withdrew },
        });
      }
      if (scoreCreates.length) {
        await tx.score.createMany({ data: scoreCreates, skipDuplicates: true });
      }
      for (const update of scoreUpdates) {
        await tx.score.update({
          where: {
            tournamentId_playerId_round: {
              tournamentId: update.tournamentId,
              playerId: update.playerId,
              round: update.round,
            },
          },
          data: { strokes: update.strokes, isEstimated: false },
        });
      }
      if (campaign) {
        const payload = {
          source: evidence.sourceUrl,
          leaderboardId: evidence.leaderboardId,
          tournamentStatus: evidence.tournamentStatus,
          statusesUpdated: statusUpdates.length,
          scoresCreated: scoreCreates.length,
          scoresUpdated: scoreUpdates.length,
          dnsPlayers,
          withdrawnPlayers,
        };
        await tx.rocketBetaAudit.create({
          data: {
            campaignId: campaign.id,
            actorEmail: "system:official-leaderboard",
            action: "official_leaderboard_reconciled",
            payload: {
              ...payload,
              evidenceHash: createHash("sha256")
                .update(JSON.stringify(payload))
                .digest("hex"),
            },
          },
        });
      }
    });
  }

  return {
    ok: true,
    source: evidence.sourceUrl,
    leaderboardId: evidence.leaderboardId,
    tournamentStatus: evidence.tournamentStatus,
    officialPlayers: evidence.players.length,
    selectedPlayers: selected.length,
    statusesUpdated: statusUpdates.length,
    scoresCreated: scoreCreates.length,
    scoresUpdated: scoreUpdates.length,
    dnsPlayers,
    withdrawnPlayers,
    errors: [],
  };
}

function failure(error: unknown): OfficialReconciliationSummary {
  return {
    ok: false,
    source: ROCKET_OFFICIAL_LEADERBOARD_URL,
    leaderboardId: ROCKET_OFFICIAL_FIELD_ID,
    tournamentStatus: "UNKNOWN",
    officialPlayers: 0,
    selectedPlayers: 0,
    statusesUpdated: 0,
    scoresCreated: 0,
    scoresUpdated: 0,
    dnsPlayers: [],
    withdrawnPlayers: [],
    errors: [error instanceof Error ? error.message : String(error)],
  };
}
