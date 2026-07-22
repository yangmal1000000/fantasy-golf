import { prisma } from "./prisma";
import { sendPushToUser } from "./push";
import { genId } from "./db-ensure";

/**
 * Auto-Sub Processor
 *
 * Detects players who have withdrawn (WD) from a tournament before/during
 * Round 1 (no scores recorded) and automatically replaces them on affected
 * teams with the best available player in the same tier.
 *
 * Rules:
 *  1. A player is eligible for auto-sub if:
 *     - TournamentPlayer.withdrew = true
 *     - The player has NO scores recorded for this tournament
 *  2. Replacement priority: lowest dataGolfRank (best ranked) in the same tier
 *     who is NOT already on the user's team for this tournament.
 *  3. If no replacement is available, the slot is left empty (team plays with 4).
 *  4. Each sub is logged in TeamSubLog for audit/transparency.
 *  5. After all subs, team scores are NOT recalculated here (the caller handles that).
 *  6. Affected users receive an in-app + push notification about the substitution.
 */

export interface AutoSubResult {
  tournamentId: string;
  subsProcessed: number;
  subs: {
    teamId: string;
    teamName: string;
    oldPlayerName: string;
    newPlayerName: string;
    tier: string;
  }[];
  unresolved: {
    teamId: string;
    teamName: string;
    tier: string;
    wdPlayerName: string;
  }[];
}

export async function processAutoSubs(tournamentId: string): Promise<AutoSubResult> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, currentRound: true },
  });

  if (!tournament) {
    return {
      tournamentId,
      subsProcessed: 0,
      subs: [],
      unresolved: [],
    };
  }

  // Find all withdrew players with NO scores (pre-round WD)
  const wdTournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId,
      withdrew: true,
    },
    include: {
      player: { select: { id: true, name: true, dataGolfRank: true } },
    },
  });

  // Filter to only those with zero scores (true pre-round WDs)
  const allScores = await prisma.score.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });
  const playersWithScores = new Set(allScores.map((s) => s.playerId));

  const eligibleWDs = wdTournamentPlayers.filter(
    (tp) => !playersWithScores.has(tp.playerId),
  );

  if (eligibleWDs.length === 0) {
    return {
      tournamentId,
      subsProcessed: 0,
      subs: [],
      unresolved: [],
    };
  }

  // Build a set of WD player IDs for quick lookup
  const wdPlayerIds = new Set(eligibleWDs.map((tp) => tp.playerId));

  // Find all teams that have selections pointing to WD players
  const affectedSelections = await prisma.teamSelection.findMany({
    where: {
      tournamentPlayer: {
        tournamentId,
        playerId: { in: Array.from(wdPlayerIds) },
      },
    },
    include: {
      team: { select: { id: true, name: true, userId: true } },
      tournamentPlayer: {
        include: { player: { select: { id: true, name: true, dataGolfRank: true } } },
      },
    },
  });

  if (affectedSelections.length === 0) {
    return {
      tournamentId,
      subsProcessed: 0,
      subs: [],
      unresolved: [],
    };
  }

  // Fetch all TournamentPlayers grouped by tier for replacement candidates
  const allTournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId,
      withdrew: false,
      player: { id: { notIn: Array.from(wdPlayerIds) } },
    },
    include: {
      player: { select: { id: true, name: true, dataGolfRank: true } },
    },
  });

  const candidatesByTier = new Map<string, typeof allTournamentPlayers>();
  for (const tp of allTournamentPlayers) {
    const list = candidatesByTier.get(tp.tier) ?? [];
    list.push(tp);
    candidatesByTier.set(tp.tier, list);
  }

  // Sort each tier by dataGolfRank ascending (best ranked first)
  for (const [, list] of candidatesByTier) {
    list.sort((a, b) => {
      const rankA = a.player.dataGolfRank ?? 9999;
      const rankB = b.player.dataGolfRank ?? 9999;
      return rankA - rankB;
    });
  }

  const subs: AutoSubResult["subs"] = [];
  const unresolved: AutoSubResult["unresolved"] = [];

  // Process each affected selection
  for (const selection of affectedSelections) {
    const tier = selection.tournamentPlayer.tier;
    const wdPlayer = selection.tournamentPlayer.player;

    // Get all player IDs already on this team (to avoid duplicate picks)
    const teamSelections = await prisma.teamSelection.findMany({
      where: { teamId: selection.team.id },
      include: { tournamentPlayer: { select: { playerId: true } } },
    });
    const alreadyPicked = new Set(
      teamSelections.map((ts) => ts.tournamentPlayer.playerId),
    );

    // Find the best available replacement in the same tier
    const candidates = candidatesByTier.get(tier) ?? [];
    const replacement = candidates.find(
      (c) => !alreadyPicked.has(c.playerId),
    );

    if (!replacement) {
      // No replacement available — record as unresolved
      unresolved.push({
        teamId: selection.team.id,
        teamName: selection.team.name,
        tier,
        wdPlayerName: wdPlayer.name,
      });
      continue;
    }

    // Swap: delete old selection, create new one, log the sub
    await prisma.$transaction([
      // Remove the old selection (WD player)
      prisma.teamSelection.delete({ where: { id: selection.id } }),
      // Create new selection for the replacement player
      prisma.teamSelection.create({
        data: {
          teamId: selection.team.id,
          tournamentPlayerId: replacement.id,
        },
      }),
      // Log the substitution
      prisma.teamSubLog.create({
        data: {
          teamId: selection.team.id,
          oldPlayerId: wdPlayer.id,
          newPlayerId: replacement.playerId,
          tier,
          reason: "pre_round_wd",
        },
      }),
    ]);

    subs.push({
      teamId: selection.team.id,
      teamName: selection.team.name,
      oldPlayerName: wdPlayer.name,
      newPlayerName: replacement.player.name,
      tier,
    });

    // Send notification to the affected user
    const userId = selection.team.userId;
    const notifTitle = `🔄 Auto-sub: ${wdPlayer.name} → ${replacement.player.name}`;
    const notifBody = `${tournament.name}: ${wdPlayer.name} withdrew (Tier ${tier}). Replaced with ${replacement.player.name} (rank ${(replacement.player.dataGolfRank ?? "—").toString()}).`;

    try {
      await prisma.notification.create({
        data: {
          id: genId(),
          userId,
          title: notifTitle,
          body: notifBody,
          type: "auto_sub",
        },
      });
      await sendPushToUser(userId, {
        title: notifTitle,
        body: notifBody,
        url: `/tournaments/${tournamentId}/teams/${selection.team.id}`,
        tag: `auto-sub-${tournamentId}`,
      });
    } catch {
      // Notification failures should never block the sub process
    }
  }

  // Send notifications for unresolved subs (no replacement found)
  for (const u of unresolved) {
    const team = await prisma.team.findUnique({
      where: { id: u.teamId },
      select: { userId: true },
    });
    if (!team) continue;

    const notifTitle = `⚠️ No sub available for ${u.wdPlayerName}`;
    const notifBody = `${tournament.name}: ${u.wdPlayerName} withdrew (Tier ${u.tier}) but no replacement player was available. Your team will play with 4 players.`;

    try {
      await prisma.notification.create({
        data: {
          id: genId(),
          userId: team.userId,
          title: notifTitle,
          body: notifBody,
          type: "auto_sub",
        },
      });
      await sendPushToUser(team.userId, {
        title: notifTitle,
        body: notifBody,
        url: `/tournaments/${tournamentId}/teams/${u.teamId}`,
        tag: `auto-sub-${tournamentId}`,
      });
    } catch {
      // ignore
    }
  }

  return {
    tournamentId,
    subsProcessed: subs.length,
    subs,
    unresolved,
  };
}
