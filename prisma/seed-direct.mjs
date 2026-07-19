import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres:DprMoCBi5phozjZ4@db.nebamldcvcalbqltnllj.supabase.co:5432/postgres" } },
});

const golfers = [
  { name: "Scottie Scheffler", rank: 1, country: "USA", tier: "T1_10" },
  { name: "Rory McIlroy", rank: 2, country: "NIR", tier: "T1_10" },
  { name: "Xander Schauffele", rank: 3, country: "USA", tier: "T1_10" },
  { name: "Collin Morikawa", rank: 4, country: "USA", tier: "T1_10" },
  { name: "Ludvig Aberg", rank: 5, country: "SWE", tier: "T1_10" },
  { name: "Jon Rahm", rank: 6, country: "ESP", tier: "T1_10" },
  { name: "Viktor Hovland", rank: 7, country: "NOR", tier: "T1_10" },
  { name: "Patrick Cantlay", rank: 8, country: "USA", tier: "T1_10" },
  { name: "Wyndham Clark", rank: 9, country: "USA", tier: "T1_10" },
  { name: "Max Homa", rank: 10, country: "USA", tier: "T1_10" },
  { name: "Tyrrell Hatton", rank: 11, country: "ENG", tier: "T11_20" },
  { name: "Tommy Fleetwood", rank: 12, country: "ENG", tier: "T11_20" },
  { name: "Cameron Smith", rank: 13, country: "AUS", tier: "T11_20" },
  { name: "Brooks Koepka", rank: 14, country: "USA", tier: "T11_20" },
  { name: "Jordan Spieth", rank: 15, country: "USA", tier: "T11_20" },
  { name: "Matt Fitzpatrick", rank: 16, country: "ENG", tier: "T11_20" },
  { name: "Brian Harman", rank: 17, country: "USA", tier: "T11_20" },
  { name: "Russell Henley", rank: 18, country: "USA", tier: "T11_20" },
  { name: "Sungjae Im", rank: 19, country: "KOR", tier: "T11_20" },
  { name: "Tony Finau", rank: 20, country: "USA", tier: "T11_20" },
  { name: "Min Woo Lee", rank: 21, country: "AUS", tier: "T21_30" },
  { name: "Shane Lowry", rank: 22, country: "IRL", tier: "T21_30" },
  { name: "Robert MacIntyre", rank: 23, country: "SCO", tier: "T21_30" },
  { name: "Justin Thomas", rank: 24, country: "USA", tier: "T21_30" },
  { name: "Sam Burns", rank: 25, country: "USA", tier: "T21_30" },
  { name: "Rickie Fowler", rank: 26, country: "USA", tier: "T21_30" },
  { name: "Jason Day", rank: 27, country: "AUS", tier: "T21_30" },
  { name: "Keegan Bradley", rank: 28, country: "USA", tier: "T21_30" },
  { name: "Cameron Young", rank: 29, country: "USA", tier: "T21_30" },
  { name: "Tom Kim", rank: 30, country: "KOR", tier: "T21_30" },
  { name: "Adam Scott", rank: 31, country: "AUS", tier: "T31_50" },
  { name: "Corey Conners", rank: 32, country: "CAN", tier: "T31_50" },
  { name: "Si Woo Kim", rank: 33, country: "KOR", tier: "T31_50" },
  { name: "Christiaan Bezuidenhout", rank: 34, country: "RSA", tier: "T31_50" },
  { name: "J.T. Poston", rank: 35, country: "USA", tier: "T31_50" },
  { name: "Harris English", rank: 36, country: "USA", tier: "T31_50" },
  { name: "Kurt Kitayama", rank: 37, country: "USA", tier: "T31_50" },
  { name: "Sepp Straka", rank: 38, country: "AUT", tier: "T31_50" },
  { name: "Nick Taylor", rank: 39, country: "CAN", tier: "T31_50" },
  { name: "Adam Hadwin", rank: 40, country: "CAN", tier: "T31_50" },
  { name: "Daniel Brown", rank: 51, country: "ENG", tier: "T51_PLUS" },
  { name: "Jackson Suber", rank: 52, country: "USA", tier: "T51_PLUS" },
  { name: "Thomas Detry", rank: 53, country: "BEL", tier: "T51_PLUS" },
  { name: "MJ Daffue", rank: 54, country: "RSA", tier: "T51_PLUS" },
  { name: "Jasper Svensson", rank: 55, country: "SWE", tier: "T51_PLUS" },
  { name: "Paul Dunne", rank: 56, country: "IRL", tier: "T51_PLUS" },
  { name: "Thorbjørn Olesen", rank: 57, country: "DEN", tier: "T51_PLUS" },
  { name: "Rasmus Højgaard", rank: 58, country: "DEN", tier: "T51_PLUS" },
  { name: "Nicolai Højgaard", rank: 59, country: "DEN", tier: "T51_PLUS" },
  { name: "Sandy Lyle", rank: 60, country: "SCO", tier: "T51_PLUS" },
];

const tournaments = [
  { id: "masters-2026", name: "The Masters 2026", course: "Augusta National Golf Club", startDate: "2026-04-09", endDate: "2026-04-12", par: 72, entryFee: 1500, category: "major", tour: "pga", status: "upcoming" },
  { id: "pga-championship-2026", name: "PGA Championship 2026", course: "Quail Hollow Club", startDate: "2026-05-14", endDate: "2026-05-17", par: 72, entryFee: 1500, category: "major", tour: "pga", status: "upcoming" },
  { id: "us-open-2026", name: "US Open 2026", course: "Oakmont Country Club", startDate: "2026-06-18", endDate: "2026-06-21", par: 70, entryFee: 1500, category: "major", tour: "pga", status: "upcoming" },
  { id: "the-open-2026", name: "The Open Championship 2026", course: "Royal Birkdale", startDate: "2026-07-16", endDate: "2026-07-19", par: 70, entryFee: 1500, category: "major", tour: "pga", status: "entries_open" },
  { id: "players-2026", name: "The Players Championship 2026", course: "TPC Sawgrass", startDate: "2026-03-12", endDate: "2026-03-15", par: 72, entryFee: 1000, category: "signature", tour: "pga", status: "upcoming" },
  { id: "genesis-2026", name: "Genesis Invitational 2026", course: "Riviera Country Club", startDate: "2026-02-12", endDate: "2026-02-15", par: 71, entryFee: 1000, category: "signature", tour: "pga", status: "upcoming" },
  { id: "arnold-palmer-2026", name: "Arnold Palmer Invitational 2026", course: "Bay Hill Golf Club", startDate: "2026-03-05", endDate: "2026-03-08", par: 72, entryFee: 1000, category: "signature", tour: "pga", status: "upcoming" },
  { id: "memorial-2026", name: "Memorial Tournament 2026", course: "Muirfield Village Golf Club", startDate: "2026-06-04", endDate: "2026-06-07", par: 72, entryFee: 1000, category: "signature", tour: "pga", status: "upcoming" },
  { id: "tour-championship-2026", name: "Tour Championship 2026", course: "East Lake Golf Club", startDate: "2026-08-27", endDate: "2026-08-30", par: 70, entryFee: 1000, category: "playoff", tour: "pga", status: "upcoming" },
  { id: "bmw-pga-2026", name: "BMW PGA Championship 2026", course: "Wentworth Golf Club", startDate: "2026-09-10", endDate: "2026-09-13", par: 72, entryFee: 1000, category: "dpwt", tour: "european", status: "upcoming" },
];

async function main() {
  console.log("Seeding...");
  
  // Demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@fantasygolf.com" },
    update: {},
    create: { email: "demo@fantasygolf.com", name: "Demo Player", isAdmin: true },
  });
  console.log("User:", user.email);

  // Players
  for (const g of golfers) {
    const id = `player-${g.rank}`;
    await prisma.player.upsert({
      where: { id },
      update: { name: g.name, dataGolfRank: g.rank, country: g.country },
      create: { id, name: g.name, dataGolfRank: g.rank, country: g.country },
    });
  }
  console.log("Players:", golfers.length);

  // Tournaments
  for (const t of tournaments) {
    await prisma.tournament.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id, name: t.name, course: t.course,
        startDate: new Date(t.startDate), endDate: new Date(t.endDate),
        par: t.par, entryFee: t.entryFee, category: t.category, tour: t.tour,
        status: t.status, currentRound: 0,
      },
    });
    
    // Link all players to each tournament with proper tiers
    for (const g of golfers) {
      await prisma.tournamentPlayer.upsert({
        where: { tournamentId_playerId: { tournamentId: t.id, playerId: `player-${g.rank}` } },
        update: {},
        create: { tournamentId: t.id, playerId: `player-${g.rank}`, tier: g.tier, madeCut: null, withdrew: false },
      });
    }
  }
  console.log("Tournaments:", tournaments.length);

  // Blog posts
  const posts = [
    { slug: "the-open-2026-preview", title: "The Open 2026: 5 Players to Watch at Royal Birkdale", body: "# The Open 2026\n\nRoyal Birkdale hosts The 145th Open Championship this July. Here are five players we think could contend.\n\n## 1. Scottie Scheffler\n\nThe world #1 has been in sublime form all season. His ball-striking is perfectly suited to links conditions.\n\n## 2. Rory McIlroy\n\nMcIlroy loves The Open. His length off the tee is a huge advantage on a course that can play long in typical British summer conditions.\n\n## 3. Xander Schauffele\n\nThe PGA Champion has the complete game and thrives in tough conditions.\n\n## 4. Shane Lowry\n\nThe 2019 Champion Golfer of the Year knows how to grind on a links course.\n\n## 5. Ludvig Aberg\n\nThe young Swede is the most exciting talent in golf right now.\n\n## Fantasy Tip\n\nDon't sleep on your T4 and T5 picks — The Open is famous for long-shot contenders.", author: "Fantasy Golf Team", tags: ["preview", "the-open", "strategy"] },
    { slug: "how-to-pick-your-tier-5-player", title: "Strategy: How to Pick Your Tier 5 Player", body: "# The Tier 5 Dilemma\n\nYour Tier 5 pick (rank 51+) can make or break your fantasy team. Here's how to approach it.\n\n## Look for Links Specialists\n\nThe Open Championship rewards players who can handle wind, rain, and firm fairways.\n\n## Check Recent Form\n\nA T51-ranked player who made the cut in their last 3 events is more valuable than a higher-ranked player who keeps missing weekends.\n\n## The Cut Rule\n\nRemember: if your player misses the cut, they get their R1+R2 average. So a consistent cut-maker is often better than a boom-or-bust pick.", author: "Fantasy Golf Team", tags: ["strategy", "tiers"] },
    { slug: "course-guide-royal-birkdale", title: "Course Guide: Royal Birkdale", body: "# Royal Birkdale Golf Club\n\nHost of The 2026 Open Championship.\n\n## The Course\n\n- **Par:** 70\n- **Yardage:** ~7,100 yards\n- **Designer:** Originally Fred Hawtree, later refined\n\n## Key Holes\n\n**Hole 6 — The toughest par 4 on the course.** Into the prevailing wind, this 470-yard beast requires precision.\n\n**Hole 12 — Risk-reward par 5.** Reachable in two for the big hitters, but out of bounds lurks.\n\n**Hole 16 — The closing stretch starts here.** A demanding par 4 that has decided many championships.\n\n## Weather Factor\n\nExpect wind. Royal Birkdale is exposed and links conditions can change hourly.", author: "Fantasy Golf Team", tags: ["course-guide", "the-open"] },
  ];

  for (const p of posts) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "BlogPost" (slug, title, body, author, "publishedAt", tags, id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), $5, gen_random_uuid(), NOW(), NOW())
       ON CONFLICT (slug) DO NOTHING`,
      p.slug, p.title, p.body, p.author, p.tags
    ).catch(() => {});
  }
  console.log("Blog posts:", posts.length);

  console.log("Done!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
