import "dotenv/config";
import { PrismaClient, Tier } from "@prisma/client";

const prisma = new PrismaClient();

const golfers: { name: string; rank: number; country: string; tier: string }[] = [
  // T1_10 (ranks 1-10)
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
  // T11_20 (ranks 11-20)
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
  // T21_30 (ranks 21-30)
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
  // T31_50 (ranks 31-50)
  { name: "Alex Fitzpatrick", rank: 31, country: "ENG", tier: "T31_50" },
  { name: "Adam Scott", rank: 32, country: "AUS", tier: "T31_50" },
  { name: "Corey Conners", rank: 33, country: "CAN", tier: "T31_50" },
  { name: "Si Woo Kim", rank: 34, country: "KOR", tier: "T31_50" },
  { name: "Christiaan Bezuidenhout", rank: 35, country: "RSA", tier: "T31_50" },
  { name: "J.T. Poston", rank: 36, country: "USA", tier: "T31_50" },
  { name: "Harris English", rank: 37, country: "USA", tier: "T31_50" },
  { name: "Kurt Kitayama", rank: 38, country: "USA", tier: "T31_50" },
  { name: "Sepp Straka", rank: 39, country: "AUT", tier: "T31_50" },
  { name: "Nick Taylor", rank: 40, country: "CAN", tier: "T31_50" },
  // T51_PLUS (ranks 51+)
  { name: "Daniel Brown", rank: 51, country: "ENG", tier: "T51_PLUS" },
  { name: "Jackson Suber", rank: 52, country: "USA", tier: "T51_PLUS" },
  { name: "Thomas Detry", rank: 53, country: "BEL", tier: "T51_PLUS" },
  { name: "MJ Daffue", rank: 54, country: "RSA", tier: "T51_PLUS" },
  { name: "Jasper Svensson", rank: 55, country: "SWE", tier: "T51_PLUS" },
  { name: "Sandy Lyle", rank: 56, country: "SCO", tier: "T51_PLUS" },
  { name: "Paul Dunne", rank: 57, country: "IRL", tier: "T51_PLUS" },
  { name: "Thorbjørn Olesen", rank: 58, country: "DEN", tier: "T51_PLUS" },
  { name: "Rasmus Højgaard", rank: 59, country: "DEN", tier: "T51_PLUS" },
  { name: "Nicolai Højgaard", rank: 60, country: "DEN", tier: "T51_PLUS" },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@fantasygolf.com" },
    update: {},
    create: {
      email: "demo@fantasygolf.com",
      name: "Demo Player",
      isAdmin: true,
    },
  });
  console.log(`  ✓ Demo user: ${demoUser.email}`);

  // === Tournaments ===
  const tournaments = [
    {
      id: "masters-2026",
      name: "The Masters 2026",
      course: "Augusta National Golf Club",
      startDate: new Date("2026-04-09T00:00:00Z"),
      endDate: new Date("2026-04-12T23:59:59Z"),
      status: "upcoming",
      par: 72,
      entryFee: 1500,
      currentRound: 0,
      prizePool: 0,
    },
    {
      id: "pga-championship-2026",
      name: "PGA Championship 2026",
      course: "Quail Hollow Club",
      startDate: new Date("2026-05-14T00:00:00Z"),
      endDate: new Date("2026-05-17T23:59:59Z"),
      status: "upcoming",
      par: 71,
      entryFee: 1500,
      currentRound: 0,
      prizePool: 0,
    },
    {
      id: "us-open-2026",
      name: "U.S. Open 2026",
      course: "Oakmont Country Club",
      startDate: new Date("2026-06-18T00:00:00Z"),
      endDate: new Date("2026-06-21T23:59:59Z"),
      status: "upcoming",
      par: 70,
      entryFee: 1500,
      currentRound: 0,
      prizePool: 0,
    },
    {
      id: "the-open-2026",
      name: "The Open Championship 2026",
      course: "Royal Birkdale",
      startDate: new Date("2026-07-16T00:00:00Z"),
      endDate: new Date("2026-07-20T23:59:59Z"),
      status: "entries_open",
      par: 70,
      entryFee: 1500,
      currentRound: 0,
      prizePool: 0,
    },
  ];

  for (const t of tournaments) {
    const tournament = await prisma.tournament.upsert({
      where: { id: t.id },
      update: {},
      create: t,
    });
    console.log(`  ✓ Tournament: ${tournament.name}`);

    // Link all players to each tournament
    for (const golfer of golfers) {
      const player = await prisma.player.upsert({
        where: { id: `player-${golfer.rank}` },
        update: {
          name: golfer.name,
          country: golfer.country,
          dataGolfRank: golfer.rank,
        },
        create: {
          id: `player-${golfer.rank}`,
          name: golfer.name,
          country: golfer.country,
          dataGolfRank: golfer.rank,
        },
      });

      await prisma.tournamentPlayer.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId: tournament.id,
            playerId: player.id,
          },
        },
        update: {
          tier: golfer.tier,
        },
        create: {
          tournamentId: tournament.id,
          playerId: player.id,
          tier: golfer.tier,
          madeCut: null,
          withdrew: false,
        },
      });
    }
    console.log(`    → ${golfers.length} players linked`);
  }

  console.log("✅ Seed complete! 4 majors seeded.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
