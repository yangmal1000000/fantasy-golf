import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assessPgaTourLeaderboardEvidence,
  fetchPgaTourLeaderboard,
  normalizeGolfPlayerName,
  type PgaTourLeaderboardEvidence,
} from "@/lib/pga-tour-leaderboard";
import {
  ROCKET_OFFICIAL_FIELD_ID,
  ROCKET_OFFICIAL_LEADERBOARD_URL,
} from "@/lib/rocket-official-config";
import { deriveRocketOfficialPlayerState } from "@/lib/rocket-official-reconciliation-core";

export { ROCKET_OFFICIAL_LEADERBOARD_URL } from "@/lib/rocket-official-config";

export interface OfficialReconciliationSummary {
  ok: boolean;
  finalizationReady: boolean;
  sealedResult: boolean;
  skipped: boolean;
  source: string;
  leaderboardId: string;
  tournamentStatus: string;
  fieldPlayers: number;
  officialPlayers: number;
  matchedFieldPlayers: number;
  requiredMatches: number;
  selectedPlayers: number;
  statusesUpdated: number;
  scoresCreated: number;
  scoresUpdated: number;
  dnsPlayers: string[];
  withdrawnPlayers: string[];
  disqualifiedPlayers: string[];
  evidenceHash: string | null;
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
  const campaign = await prisma.rocketBetaCampaign.findUnique({
    where: { tournamentId },
    select: { id: true, finalizedAt: true },
  });
  if (campaign?.finalizedAt) {
    return {
      ...emptySummary(),
      ok: true,
      sealedResult: true,
      skipped: true,
      tournamentStatus: "SEALED",
    };
  }

  let evidence: PgaTourLeaderboardEvidence;
  try {
    evidence = await fetchPgaTourLeaderboard({
      leaderboardId: ROCKET_OFFICIAL_FIELD_ID,
      sourceUrl: ROCKET_OFFICIAL_LEADERBOARD_URL,
    });
  } catch (error) {
    return failure(error);
  }

  const [fieldPlayers, selected] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { player: { select: { name: true } } },
    }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId, selections: { some: {} } },
      select: {
        id: true,
        playerId: true,
        madeCut: true,
        withdrew: true,
        player: { select: { name: true } },
      },
    }),
  ]);
  const assessment = assessPgaTourLeaderboardEvidence({
    evidence,
    fieldPlayerNames: fieldPlayers.map((player) => player.player.name),
  });
  if (!assessment.ok) {
    return failure(new Error(assessment.errors.join("; ")), {
      tournamentStatus: evidence.tournamentStatus,
      fieldPlayers: assessment.fieldPlayers,
      officialPlayers: assessment.officialPlayers,
      matchedFieldPlayers: assessment.matchedFieldPlayers,
      requiredMatches: assessment.requiredMatches,
      selectedPlayers: selected.length,
      evidenceHash: assessment.evidenceHash,
    });
  }
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
  const completed = assessment.finalizationReady;
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
  const disqualifiedPlayers: string[] = [];

  for (const selectedPlayer of selected) {
    const official = officialByName.get(
      normalizeGolfPlayerName(selectedPlayer.player.name),
    );
    const hasAnyScore = existingScores.some(
      (score) => score.playerId === selectedPlayer.playerId,
    );
    const derived = deriveRocketOfficialPlayerState({
      currentWithdrew: selectedPlayer.withdrew,
      currentMadeCut: selectedPlayer.madeCut,
      official,
      hasAnyScore,
      finalizationReady: completed,
    });
    const { absentFinalStarter, withdrew, madeCut } = derived;

    if (absentFinalStarter) dnsPlayers.push(selectedPlayer.player.name);
    if (official?.withdrew) withdrawnPlayers.push(selectedPlayer.player.name);
    if (official?.disqualified) {
      disqualifiedPlayers.push(selectedPlayer.player.name);
    }
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
    const applied = await prisma.$transaction(async (tx) => {
      const lockedCampaign = await tx.$queryRaw<
        Array<{ finalizedAt: Date | null }>
      >(Prisma.sql`
        SELECT "finalizedAt" FROM "RocketBetaCampaign"
        WHERE "tournamentId" = ${tournamentId}
        FOR SHARE
      `);
      if (lockedCampaign[0]?.finalizedAt) return false;

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
          disqualifiedPlayers,
          fieldPlayers: assessment.fieldPlayers,
          matchedFieldPlayers: assessment.matchedFieldPlayers,
          requiredMatches: assessment.requiredMatches,
          evidenceHash: assessment.evidenceHash,
        };
        await tx.rocketBetaAudit.create({
          data: {
            campaignId: campaign.id,
            actorEmail: "system:official-leaderboard",
            action: "official_leaderboard_reconciled",
            payload,
          },
        });
      }
      return true;
    });
    if (!applied) {
      return {
        ...emptySummary(),
        ok: true,
        sealedResult: true,
        skipped: true,
        tournamentStatus: "SEALED",
      };
    }
  }

  return {
    ok: true,
    finalizationReady: assessment.finalizationReady,
    sealedResult: false,
    skipped: false,
    source: evidence.sourceUrl,
    leaderboardId: evidence.leaderboardId,
    tournamentStatus: evidence.tournamentStatus,
    fieldPlayers: assessment.fieldPlayers,
    officialPlayers: assessment.officialPlayers,
    matchedFieldPlayers: assessment.matchedFieldPlayers,
    requiredMatches: assessment.requiredMatches,
    selectedPlayers: selected.length,
    statusesUpdated: statusUpdates.length,
    scoresCreated: scoreCreates.length,
    scoresUpdated: scoreUpdates.length,
    dnsPlayers,
    withdrawnPlayers,
    disqualifiedPlayers,
    evidenceHash: assessment.evidenceHash,
    errors: [],
  };
}

function failure(
  error: unknown,
  details: Partial<OfficialReconciliationSummary> = {},
): OfficialReconciliationSummary {
  return {
    ...emptySummary(),
    ...details,
    errors: [error instanceof Error ? error.message : String(error)],
  };
}

function emptySummary(): OfficialReconciliationSummary {
  return {
    ok: false,
    finalizationReady: false,
    sealedResult: false,
    skipped: false,
    source: ROCKET_OFFICIAL_LEADERBOARD_URL,
    leaderboardId: ROCKET_OFFICIAL_FIELD_ID,
    tournamentStatus: "UNKNOWN",
    fieldPlayers: 0,
    officialPlayers: 0,
    matchedFieldPlayers: 0,
    requiredMatches: 0,
    selectedPlayers: 0,
    statusesUpdated: 0,
    scoresCreated: 0,
    scoresUpdated: 0,
    dnsPlayers: [],
    withdrawnPlayers: [],
    disqualifiedPlayers: [],
    evidenceHash: null,
    errors: [],
  };
}
