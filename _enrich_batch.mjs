import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const STATS = { found: 0, photoUpdated: 0, alreadyHadPhoto: 0, notFound: 0, errors: 0 };

async function fetchWikiImage(title) {
  // Use the MediaWiki action API with piprops for the original image
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|extracts&piprop=original|name&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&redirects=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'FantasyGolfEnrichment/1.0 (private project)' } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  // Validate golfer
  const extract = page.extract || '';
  const isGolfer = extract.toLowerCase().includes('golf') || extract.toLowerCase().includes('golfer');
  if (!isGolfer) return null;
  return {
    photoUrl: page.original?.source || null,
    bio: extract || null,
  };
}

async function tryWikipedia(name) {
  const candidates = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name} (golf)`,
    name,
  ];
  for (const title of candidates) {
    const result = await fetchWikiImage(title);
    if (result) return result;
  }
  return null;
}

async function main() {
  // Get players where photoUrl is null — these are the 47 from previous run that got bios only
  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    take: 50,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  console.log(`Found ${players.length} players with null photoUrl`);

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    process.stdout.write(`[${i + 1}/${players.length}] ${p.name} ... `);
    try {
      const wiki = await tryWikipedia(p.name);
      if (!wiki) {
        STATS.notFound++;
        console.log('NOT FOUND');
        continue;
      }
      STATS.found++;
      const updates = { enrichedAt: new Date() };
      if (wiki.photoUrl) { updates.photoUrl = wiki.photoUrl; STATS.photoUpdated++; }
      // Don't overwrite existing bios (already set in previous run) — only set if null
      await prisma.player.update({
        where: { id: p.id },
        data: updates,
      });
      console.log(`OK (photo:${!!wiki.photoUrl})`);
    } catch (e) {
      STATS.errors++;
      console.log(`ERROR: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log('\n=== STATS ===');
  console.log(JSON.stringify(STATS, null, 2));
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
