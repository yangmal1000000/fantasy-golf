import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const events2027 = [
  // Jan 2027
  { id: '2027-sentry', name: 'The Sentry', course: 'Plantation Course at Kapalua', startDate: '2027-01-07', endDate: '2027-01-10', par: 73, cat: 'signature', tour: 'pga' },
  { id: '2027-sony-open', name: 'Sony Open in Hawaii', course: 'Waialae Country Club', startDate: '2027-01-14', endDate: '2027-01-17', par: 70, cat: 'regular', tour: 'pga' },
  // Feb 2027
  { id: '2027-american-express', name: 'The American Express', course: 'PGA West Stadium Course', startDate: '2027-01-21', endDate: '2027-01-24', par: 72, cat: 'regular', tour: 'pga' },
  { id: '2027-farmers', name: 'Farmers Insurance Open', course: 'Torrey Pines South', startDate: '2027-01-28', endDate: '2027-01-31', par: 72, cat: 'regular', tour: 'pga' },
  { id: '2027-pebble-beach', name: 'AT&T Pebble Beach Pro-Am', course: 'Pebble Beach Golf Links', startDate: '2027-02-04', endDate: '2027-02-07', par: 72, cat: 'signature', tour: 'pga' },
  { id: '2027-wm-phoenix', name: 'WM Phoenix Open', course: 'TPC Scottsdale', startDate: '2027-02-11', endDate: '2027-02-14', par: 71, cat: 'signature', tour: 'pga' },
  { id: '2027-genesis', name: 'The Genesis Invitational', course: 'Riviera Country Club', startDate: '2027-02-18', endDate: '2027-02-21', par: 71, cat: 'signature', tour: 'pga' },
  // Mar 2027
  { id: '2027-mexico-open', name: 'Mexico Open at Vidanta', course: 'VidantaWorld Vallarta', startDate: '2027-02-25', endDate: '2027-02-28', par: 72, cat: 'regular', tour: 'pga' },
  { id: '2027-cognizant', name: 'Cognizant Classic', course: 'PGA National Champion Course', startDate: '2027-03-04', endDate: '2027-03-07', par: 71, cat: 'regular', tour: 'pga' },
  { id: '2027-arnold-palmer', name: 'Arnold Palmer Invitational', course: 'Bay Hill Golf Club', startDate: '2027-03-11', endDate: '2027-03-14', par: 72, cat: 'signature', tour: 'pga' },
  { id: '2027-players', name: 'THE PLAYERS Championship', course: 'TPC Sawgrass', startDate: '2027-03-18', endDate: '2027-03-21', par: 72, cat: 'signature', tour: 'pga' },
  { id: '2027-valspar', name: 'Valspar Championship', course: 'Innisbrook Copperhead Course', startDate: '2027-03-25', endDate: '2027-03-28', par: 71, cat: 'regular', tour: 'pga' },
  // Apr 2027
  { id: '2027-masters', name: 'The Masters', course: 'Augusta National Golf Club', startDate: '2027-04-08', endDate: '2027-04-11', par: 72, cat: 'major', tour: 'pga' },
  { id: '2027-rbc-heritage', name: 'RBC Heritage', course: 'Harbour Town Golf Links', startDate: '2027-04-15', endDate: '2027-04-18', par: 71, cat: 'signature', tour: 'pga' },
  { id: '2027-texas-open', name: 'Valero Texas Open', course: 'TPC San Antonio (Oaks)', startDate: '2027-04-01', endDate: '2027-04-04', par: 72, cat: 'regular', tour: 'pga' },
  // May 2027
  { id: '2027-wells-fargo', name: 'Wells Fargo Championship', course: 'Quail Hollow Club', startDate: '2027-05-06', endDate: '2027-05-09', par: 71, cat: 'signature', tour: 'pga' },
  { id: '2027-byron-nelson', name: 'CJ Cup Byron Nelson', course: 'TPC Craig Ranch', startDate: '2027-05-13', endDate: '2027-05-16', par: 71, cat: 'regular', tour: 'pga' },
  { id: '2027-pga-championship', name: 'PGA Championship', course: 'Quail Hollow Club', startDate: '2027-05-20', endDate: '2027-05-23', par: 71, cat: 'major', tour: 'pga' },
  { id: '2027-charles-schwab', name: 'Charles Schwab Challenge', course: 'Colonial Country Club', startDate: '2027-05-27', endDate: '2027-05-30', par: 70, cat: 'regular', tour: 'pga' },
  // Jun 2027
  { id: '2027-memorial', name: 'the Memorial Tournament', course: 'Muirfield Village Golf Club', startDate: '2027-06-03', endDate: '2027-06-06', par: 72, cat: 'signature', tour: 'pga' },
  { id: '2027-rbc-canadian', name: 'RBC Canadian Open', course: 'Hamilton Golf & Country Club', startDate: '2027-06-10', endDate: '2027-06-13', par: 70, cat: 'regular', tour: 'pga' },
  { id: '2027-us-open', name: 'U.S. Open', course: 'Oakmont Country Club', startDate: '2027-06-17', endDate: '2027-06-20', par: 70, cat: 'major', tour: 'pga' },
  { id: '2027-travelers', name: 'Travelers Championship', course: 'TPC River Highlands', startDate: '2027-06-24', endDate: '2027-06-27', par: 70, cat: 'regular', tour: 'pga' },
  // Jul 2027
  { id: '2027-rocket-mortgage', name: 'Rocket Mortgage Classic', course: 'Detroit Golf Club', startDate: '2027-07-01', endDate: '2027-07-04', par: 70, cat: 'regular', tour: 'pga' },
  { id: '2027-john-deere', name: 'John Deere Classic', course: 'TPC Deere Run', startDate: '2027-07-08', endDate: '2027-07-11', par: 71, cat: 'regular', tour: 'pga' },
  { id: '2027-scottish-open', name: 'Scottish Open', course: 'Renaissance Club', startDate: '2027-07-08', endDate: '2027-07-11', par: 70, cat: 'signature', tour: 'pga' },
  { id: '2027-the-open', name: 'The Open Championship', course: 'Royal Birkdale Golf Club', startDate: '2027-07-15', endDate: '2027-07-18', par: 70, cat: 'major', tour: 'pga' },
  { id: '2027-3m-open', name: '3M Open', course: 'TPC Twin Cities', startDate: '2027-07-22', endDate: '2027-07-25', par: 71, cat: 'regular', tour: 'pga' },
  { id: '2027-wyndham', name: 'Wyndham Championship', course: 'Sedgefield Country Club', startDate: '2027-07-29', endDate: '2027-08-01', par: 70, cat: 'regular', tour: 'pga' },
  // Aug 2027 — FedEx Cup Playoffs
  { id: '2027-fedex-st-jude', name: 'FedEx St. Jude Championship', course: 'TPC Southwind', startDate: '2027-08-05', endDate: '2027-08-08', par: 70, cat: 'playoff', tour: 'pga' },
  { id: '2027-bmw-championship', name: 'BMW Championship', course: 'Castle Pines Golf Club', startDate: '2027-08-12', endDate: '2027-08-15', par: 72, cat: 'playoff', tour: 'pga' },
  { id: '2027-tour-championship', name: 'TOUR Championship', course: 'East Lake Golf Club', startDate: '2027-08-19', endDate: '2027-08-22', par: 70, cat: 'playoff', tour: 'pga' },
  // LPGA 2027 Majors
  { id: '2027-chevron', name: 'Chevron Championship', course: 'The Club at Carlton Woods', startDate: '2027-04-22', endDate: '2027-04-25', par: 72, cat: 'lpga_major', tour: 'lpga' },
  { id: '2027-us-womens-open', name: "U.S. Women's Open", course: 'Erin Hills', startDate: '2027-06-03', endDate: '2027-06-06', par: 72, cat: 'lpga_major', tour: 'lpga' },
  { id: '2027-kpmg-womens-pga', name: 'KPMG Women\'s PGA Championship', course: 'Baltusrol Golf Club', startDate: '2027-06-24', endDate: '2027-06-27', par: 72, cat: 'lpga_major', tour: 'lpga' },
  { id: '2027-amundi-evian', name: 'Amundi Evian Championship', course: 'Evian Resort Golf Club', startDate: '2027-07-22', endDate: '2027-07-25', par: 72, cat: 'lpga_major', tour: 'lpga' },
  { id: '2027-aig-womens-open', name: 'AIG Women\'s Open', course: 'St Andrews (Old Course)', startDate: '2027-08-12', endDate: '2027-08-15', par: 72, cat: 'lpga_major', tour: 'lpga' },
];

async function run() {
  let created = 0;
  for (const e of events2027) {
    const existing = await prisma.tournament.findUnique({ where: { id: e.id } });
    if (existing) continue;
    
    await prisma.tournament.create({
      data: {
        id: e.id,
        name: e.name,
        course: e.course,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
        status: 'upcoming',
        par: e.par,
        entryFee: 1000,
        category: e.cat,
        tour: e.tour,
      },
    });
    created++;
  }
  console.log(`✅ Created ${created} 2027 tournaments`);

  // Link LPGA players to 2027 LPGA tournaments
  const lpgaPlayers = await prisma.player.findMany({
    where: { tour: 'lpga' },
    orderBy: { dataGolfRank: 'asc' },
  });

  function tierForRank(rank) {
    if (rank <= 10) return 'T1_10';
    if (rank <= 20) return 'T11_20';
    if (rank <= 30) return 'T21_30';
    if (rank <= 50) return 'T31_50';
    return 'T51_PLUS';
  }

  const lpgaTourns = await prisma.tournament.findMany({
    where: { tour: 'lpga', startDate: { gte: new Date('2027-01-01') } },
  });

  for (const t of lpgaTourns) {
    for (const p of lpgaPlayers) {
      await prisma.tournamentPlayer.upsert({
        where: { tournamentId_playerId: { tournamentId: t.id, playerId: p.id } },
        update: {},
        create: {
          tournamentId: t.id,
          playerId: p.id,
          tier: tierForRank(p.dataGolfRank ?? 60),
        },
      });
    }
    console.log(`  ${t.name}: linked ${lpgaPlayers.length} LPGA players`);
  }

  // Verify
  const total = await prisma.tournament.count();
  const t2027 = await prisma.tournament.count({
    where: { startDate: { gte: new Date('2027-01-01') } },
  });
  console.log(`\nTotal tournaments: ${total} (${t2027} in 2027)`);

  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
