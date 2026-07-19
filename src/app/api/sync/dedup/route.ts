import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 55;

export async function POST() {
  const tournaments = await prisma.tournament.findMany({ orderBy: { startDate: "asc" }, select: { id: true, name: true, startDate: true, course: true } });
  
  // Better normalization — catches more duplicates
  const normalize = (s: string) => s.toLowerCase()
    .replace(/^(the|genesis|presentation|presented)\s+/g, "")
    .replace(/\s+(in hawaii|in the palm beaches|pres\. by.*|presented by.*|championship|tournament|classic|invitational|open)\b/g, "")
    .replace(/^(the )/, "")
    .replace(/[^a-z0-9]/g, "");

  const groups: Record<string, typeof tournaments> = {};
  for (const t of tournaments) {
    const key = normalize(t.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  
  let deleted = 0;
  const errors: string[] = [];
  const mergedPairs: string[] = [];
  
  for (const [key, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    
    // Keep the one with the earliest start date (more likely to be the real one)
    // or the one with a non-TBD course
    let keep = group[0];
    for (const t of group) {
      const keepHasCourse = keep.course && keep.course !== "TBD";
      const tHasCourse = t.course && t.course !== "TBD";
      if (!keepHasCourse && tHasCourse) keep = t;
    }
    
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
        mergedPairs.push(`${t.name} → ${keep.name}`);
        deleted++;
      } catch (e) {
        errors.push(`${t.id}: ${e instanceof Error ? e.message.slice(0, 60) : "err"}`);
      }
    }
  }
  
  const remaining = await prisma.tournament.count();
  return NextResponse.json({ deleted, remaining, mergedPairs, errors: errors.slice(0, 5) });
}
