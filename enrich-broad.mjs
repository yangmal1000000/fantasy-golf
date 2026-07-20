import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  // First, let's try Wikipedia with broader queries for the remaining players
  // Many lower-ranked PGA players ARE on Wikipedia but need disambiguation
  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    select: { id: true, name: true, country: true },
    take: 200,
    orderBy: { name: 'asc' },
  });
  console.log('Trying broader Wikipedia queries for', players.length, 'players');
  let photoSynced = 0;

  for (const player of players) {
    // Build country-specific disambiguation
    const countryTerms = {
      USA: ['(American golfer)', '(American sportsman)'],
      ENG: ['(English golfer)', '(English sportsman)'],
      SCO: ['(Scottish golfer)'],
      AUS: ['(Australian golfer)'],
      RSA: ['(South African golfer)'],
      KOR: ['(South Korean golfer)'],
      JPN: ['(Japanese golfer)'],
      CAN: ['(Canadian golfer)'],
      SWE: ['(Swedish golfer)'],
      ESP: ['(Spanish golfer)'],
      GER: ['(German golfer)'],
      IRL: ['(Irish golfer)'],
      DEN: ['(Danish golfer)'],
      NOR: ['(Norwegian golfer)'],
      FRA: ['(French golfer)'],
      ITA: ['(Italian golfer)'],
      CHN: ['(Chinese golfer)'],
      THA: ['(Thai golfer)'],
      NZL: ['(New Zealand golfer)'],
      ARG: ['(Argentine golfer)'],
      COL: ['(Colombian golfer)'],
      CHI: ['(Chilean golfer)'],
    };

    const terms = countryTerms[player.country || ''] || ['(golfer)'];
    terms.push('(golfer)', '(sports)', player.name);

    let found = false;
    for (const term of terms) {
      if (found) break;
      const q = term.startsWith('(') ? `${player.name} ${term}` : term;
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
          { headers: { 'User-Agent': 'FantasyGolf/1.0 (admin@fantasygolf.app)' } }
        );
        if (!res.ok) continue;
        const data = await res.json();

        // Accept if there's a thumbnail AND it's about a person
        if (data.thumbnail?.source) {
          const desc = (data.description || '').toLowerCase();
          // Be more lenient — accept any result with a photo that mentions golf, sport, or born
          if (desc.includes('golf') || desc.includes('sport') || desc.includes('born') || desc.includes('golfer') || desc.includes('player')) {
            await prisma.player.update({
              where: { id: player.id },
              data: {
                photoUrl: data.thumbnail.source,
                bio: data.extract?.slice(0, 2000) || undefined,
                birthplace: data.description || undefined,
                enrichedAt: new Date(),
              },
            });
            photoSynced++;
            found = true;
          }
        }
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 80));
  }

  console.log('\nPhotos synced:', photoSynced, '/', players.length);
  const [photo, bio, total] = await Promise.all([
    prisma.player.count({ where: { photoUrl: { not: null } } }),
    prisma.player.count({ where: { bio: { not: null } } }),
    prisma.player.count(),
  ]);
  console.log('Total photos:', photo, '/', total, '(' + Math.round(photo / total * 100) + '%)');
  console.log('Total bios:', bio, '/', total, '(' + Math.round(bio / total * 100) + '%)');
  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
