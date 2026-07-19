import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 55;

export async function POST() {
  const tournaments = await prisma.tournament.findMany({ orderBy: { startDate: "asc" } });
  
  // Normalize names to detect duplicates
  const normalize = (s: string) => s.toLowerCase()
    .replace(/^(the )/, "")
    .replace(/ in hawaii.*/, "")
    .replace(/ in the palm beaches.*/, "")
    .replace(/ pres\. by .*/, "")
    .replace(/ presented by .*/, "")
    .replace(/ championship.*/, " champ")
    .replace(/tournament/, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  
  // Group by normalized name
  const groups: Record<string, typeof tournaments> = {};
  for (const t of tournaments) {
    const key = normalize(t.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  
  let deleted = 0;
  const errors: string[] = [];
  
  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    
    // Keep the one with most scores
    let keep = group[0];
    let maxScores = 0;
    for (const t of group) {
      const count = await prisma.score.count({ where: { tournamentId: t.id } }).catch(() => 0);
      if (count > maxScores) { maxScores = count; keep = t; }
    }
    
    // Delete duplicates
    for (const t of group) {
      if (t.id === keep.id) continue;
      try {
        await prisma.$transaction([
          prisma.teamSelection.deleteMany({ where: { team: { tournamentId: t.id } } }),
          prisma.score.deleteMany({ where: { tournamentId: t.id } }),
          prisma.tournamentPlayer.deleteMany({ where: { tournamentId: t.id } }),
          prisma.team.deleteMany({ where: { tournamentId: t.id } }),
          prisma.broadcastMessage.deleteMany({ where: { tournamentId: t.id } }),
          prisma.sideBet.deleteMany({ where: { tournamentId: t.id } }),
          prisma.tournamentSidePot.deleteMany({ where: { tournamentId: t.id } }),
        ]);
        await prisma.tournament.delete({ where: { id: t.id } });
        deleted++;
      } catch (e) {
        errors.push(`${t.id}: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`);
      }
    }
  }
  
  const remaining = await prisma.tournament.count();
  return NextResponse.json({ deleted, remaining, errors: errors.slice(0, 5) });
}
