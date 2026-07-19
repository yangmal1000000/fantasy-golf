import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 55;

/**
 * POST /api/sync/fix-all
 * Fixes all remaining data quality issues in small batches.
 * Call repeatedly until response shows allFixed: true.
 */
export async function POST() {
  const report: Record<string, unknown> = {};
  
  // 1. Dedupe players by name — keep highest rank, delete rest
  const allPlayers = await prisma.player.findMany({ select: { id: true, name: true, dataGolfRank: true, country: true }, orderBy: { dataGolfRank: "asc" } });
  
  const seen = new Map<string, string>(); // name (lowercase) → kept id
  const toDelete: string[] = [];
  
  for (const p of allPlayers) {
    const key = p.name.toLowerCase().trim();
    if (seen.has(key)) {
      // This is a duplicate — mark for deletion
      toDelete.push(p.id);
    } else {
      seen.set(key, p.id);
    }
  }
  
  let playersDeleted = 0;
  for (const pid of toDelete.slice(0, 30)) { // max 30 per request
    // Move scores to the kept player if the duplicate has scores
    const dupPlayer = allPlayers.find(p => p.id === pid);
    if (!dupPlayer) continue;
    const keptId = seen.get(dupPlayer.name.toLowerCase().trim());
    if (!keptId || keptId === pid) continue;
    
    // Reassign scores and tournament player links to the kept record
    await prisma.score.updateMany({ where: { playerId: pid }, data: { playerId: keptId } }).catch(() => {});
    await prisma.tournamentPlayer.deleteMany({ where: { playerId: pid } }).catch(() => {});
    await prisma.player.delete({ where: { id: pid } }).catch(() => {});
    playersDeleted++;
  }
  
  const remainingDupes = toDelete.length - playersDeleted;
  report.duplicatePlayersDeleted = playersDeleted;
  report.duplicatePlayersRemaining = remainingDupes;
  
  // 2. Fix ALL tournament statuses based on dates (no batch limit)
  const tournaments = await prisma.tournament.findMany({ select: { id: true, name: true, startDate: true, endDate: true, status: true } });
  const now = new Date();
  let statusFixed = 0;
  let skippedInvalidDates = 0;

  for (const t of tournaments) {
    // Skip tournaments with invalid/null dates
    const startMs = t.startDate ? new Date(t.startDate).getTime() : NaN;
    const endMs = t.endDate ? new Date(t.endDate).getTime() : NaN;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      skippedInvalidDates++;
      continue;
    }

    const start = new Date(startMs);
    const end = new Date(endMs);
    end.setHours(23, 59, 59); // End of day

    let correctStatus: string;
    if (end < now) {
      correctStatus = "completed";
    } else if (start <= now && end >= now) {
      correctStatus = "in_progress";
    } else {
      // Future tournament — entries open if within 60 days, otherwise upcoming
      const daysUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      correctStatus = daysUntil < 60 ? "entries_open" : "upcoming";
    }

    if (correctStatus !== t.status) {
      const updateData: Record<string, string | number> = { status: correctStatus };
      if (correctStatus === "completed") {
        updateData.currentRound = 4;
      } else if (correctStatus === "in_progress") {
        updateData.currentRound = 1;
      }
      await prisma.tournament.update({ where: { id: t.id }, data: updateData }).catch(() => {});
      statusFixed++;
    }
  }

  report.tournamentStatusesFixed = statusFixed;
  report.skippedInvalidDates = skippedInvalidDates;
  
  // 3. Check if all fixed
  const finalPlayerCount = await prisma.player.count();
  const finalTournamentCount = await prisma.tournament.count();
  const finalScoreCount = await prisma.score.count();
  
  report.finalCounts = { players: finalPlayerCount, tournaments: finalTournamentCount, scores: finalScoreCount };
  report.allFixed = remainingDupes === 0 && statusFixed === 0;
  
  return NextResponse.json(report);
}
