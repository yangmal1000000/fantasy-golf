import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    // Add columns via raw SQL
    await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'major'`;
    await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "tour" TEXT DEFAULT 'pga'`;

    // Update existing tournaments
    await prisma.$executeRaw`UPDATE "Tournament" SET "category" = 'major' WHERE "id" IN ('masters-2026', 'pga-championship-2026', 'us-open-2026', 'the-open-2026')`;

    // New tournaments
    const newTournaments = [
      { id: "players-2026", name: "The Players Championship 2026", course: "TPC Sawgrass", start: "2026-03-12", end: "2026-03-15", par: 72, category: "signature", tour: "pga", fee: 1000 },
      { id: "genesis-2026", name: "The Genesis Invitational 2026", course: "Riviera Country Club", start: "2026-02-12", end: "2026-02-15", par: 71, category: "signature", tour: "pga", fee: 1000 },
      { id: "arnold-palmer-2026", name: "Arnold Palmer Invitational 2026", course: "Bay Hill Golf Club", start: "2026-03-05", end: "2026-03-08", par: 72, category: "signature", tour: "pga", fee: 1000 },
      { id: "memorial-2026", name: "The Memorial Tournament 2026", course: "Muirfield Village Golf Club", start: "2026-06-04", end: "2026-06-07", par: 72, category: "signature", tour: "pga", fee: 1000 },
      { id: "tour-championship-2026", name: "Tour Championship 2026", course: "East Lake Golf Club", start: "2026-08-27", end: "2026-08-30", par: 70, category: "playoff", tour: "pga", fee: 1000 },
      { id: "bmw-pga-2026", name: "BMW PGA Championship 2026", course: "Wentworth Club", start: "2026-09-10", end: "2026-09-13", par: 72, category: "dpwt", tour: "dpwt", fee: 1000 },
    ];

    const players = await prisma.player.findMany();
    let created = 0;

    for (const t of newTournaments) {
      await prisma.$executeRaw`
        INSERT INTO "Tournament" (id, name, course, "startDate", "endDate", status, par, "entryFee", "currentRound", "prizePool", category, tour, "createdAt")
        VALUES (${t.id}, ${t.name}, ${t.course}, ${new Date(t.start)}::timestamptz, ${new Date(t.end)}::timestamptz, 'upcoming', ${t.par}, ${t.fee}, 0, 0, ${t.category}, ${t.tour}, NOW())
        ON CONFLICT (id) DO UPDATE SET category = ${t.category}, tour = ${t.tour}
      `;
      created++;

      for (const p of players) {
        const tier = p.dataGolfRank! <= 10 ? "T1_10" : p.dataGolfRank! <= 20 ? "T11_20" : p.dataGolfRank! <= 30 ? "T21_30" : p.dataGolfRank! <= 50 ? "T31_50" : "T51_PLUS";
        await prisma.$executeRaw`
          INSERT INTO "TournamentPlayer" (id, "tournamentId", "playerId", tier, "selectionCount", "withdrew")
          VALUES (gen_random_uuid(), ${t.id}, ${p.id}, ${tier}, 0, false)
          ON CONFLICT ("tournamentId", "playerId") DO NOTHING
        `;
      }
    }

    const total = await prisma.tournament.count();
    return NextResponse.json({ ok: true, created, total, playersLinked: players.length * newTournaments.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 500) }, { status: 500 });
  }
}
