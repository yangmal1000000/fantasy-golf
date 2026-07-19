import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres.nebamldcvcalbqltnllj:***@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true" } },
});

// First add the columns via raw SQL
try {
  await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'major'`;
  await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "tour" TEXT DEFAULT 'pga'`;
  console.log("✅ Columns added");
} catch (e) {
  console.log("Columns may already exist:", e.message.slice(0, 100));
}

// Update existing tournaments with categories
await prisma.$executeRaw`UPDATE "Tournament" SET "category" = 'major' WHERE "id" IN ('masters-2026', 'pga-championship-2026', 'us-open-2026', 'the-open-2026')`;
console.log("✅ Existing tournaments categorized");

// New tournaments
const newTournaments = [
  { id: "players-2026", name: "The Players Championship 2026", course: "TPC Sawgrass", startDate: "2026-03-12", endDate: "2026-03-15", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  { id: "genesis-2026", name: "The Genesis Invitational 2026", course: "Riviera Country Club", startDate: "2026-02-12", endDate: "2026-02-15", par: 71, category: "signature", tour: "pga", entryFee: 1000 },
  { id: "arnold-palmer-2026", name: "Arnold Palmer Invitational 2026", course: "Bay Hill Golf Club", startDate: "2026-03-05", endDate: "2026-03-08", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  { id: "memorial-2026", name: "The Memorial Tournament 2026", course: "Muirfield Village Golf Club", startDate: "2026-06-04", endDate: "2026-06-07", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  { id: "tour-championship-2026", name: "Tour Championship 2026", course: "East Lake Golf Club", startDate: "2026-08-27", endDate: "2026-08-30", par: 70, category: "playoff", tour: "pga", entryFee: 1000 },
  { id: "bmw-pga-2026", name: "BMW PGA Championship 2026", course: "Wentworth Club", startDate: "2026-09-10", endDate: "2026-09-13", par: 72, category: "dpwt", tour: "dpwt", entryFee: 1000 },
];

for (const t of newTournaments) {
  await prisma.$executeRaw`
    INSERT INTO "Tournament" (id, name, course, "startDate", "endDate", status, par, "entryFee", "currentRound", "prizePool", category, tour, "createdAt")
    VALUES (${t.id}, ${t.name}, ${t.course}, ${new Date(t.startDate)}::timestamptz, ${new Date(t.endDate)}::timestamptz, 'upcoming', ${t.par}, ${t.entryFee}, 0, 0, ${t.category}, ${t.tour}, NOW())
    ON CONFLICT (id) DO UPDATE SET category = ${t.category}, tour = ${t.tour}
  `;
  console.log(`✅ ${t.name}`);
}

// Link all 50 existing players to each new tournament
const players = await prisma.player.findMany();
for (const t of newTournaments) {
  for (const p of players) {
    const tier = p.dataGolfRank <= 10 ? "T1_10" : p.dataGolfRank <= 20 ? "T11_20" : p.dataGolfRank <= 30 ? "T21_30" : p.dataGolfRank <= 50 ? "T31_50" : "T51_PLUS";
    await prisma.$executeRaw`
      INSERT INTO "TournamentPlayer" ("tournamentId", "playerId", tier, "selectionCount", "withdrew", "createdAt")
      VALUES (${t.id}, ${p.id}, ${tier}, 0, false, NOW())
      ON CONFLICT ("tournamentId", "playerId") DO NOTHING
    `;
  }
  console.log(`  → ${players.length} players linked to ${t.id}`);
}

console.log("\n✅ All 10 tournaments ready!");
await prisma.$disconnect();
