import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const STATS = { found: 0, photoUpdated: 0, bioUpdated: 0, notFound: 0, errors: 0, skipped: 0 };
const BATCH_SIZE = 50;
const API_DELAY_MS = 1200;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tryWikipedia(name) {
  const candidates = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name} (English golfer)`,
    `${name} (Scottish golfer)`,
    `${name} (Australian golfer)`,
    `${name} (golf)`,
    name,
  ];

  for (const title of candidates) {
    try {
      await sleep(API_DELAY_MS);
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|extracts&piprop=original|thumbnail&pithumbsize=800&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&redirects=1&exsentences=5`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FantasyGolfEnrichment/1.0 (private project)' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pages = data?.query?.pages;
      if (!pages) continue;
      const page = Object.values(pages)[0];
      if (!page || page.missing !== undefined) continue;

      const extract = page.extract || '';
      const lowerExtract = extract.toLowerCase();
      const isGolfer = lowerExtract.includes('golf') ||
                       lowerExtract.includes('pga tour') ||
                       lowerExtract.includes('lpga') ||
                       lowerExtract.includes('european tour') ||
                       lowerExtract.includes('dp world tour') ||
                       lowerExtract.includes('ryder cup') ||
                       lowerExtract.includes('professional') && lowerExtract.includes('tour');
      if (!isGolfer) continue;

      let photoUrl = page.original?.source || page.thumbnail?.source || null;
      let bio = extract || null;

      // Try REST summary API for better bio + photo
      await sleep(400);
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { 'User-Agent': 'FantasyGolfEnrichment/1.0 (private project)' },
      });
      if (summaryRes.ok) {
        const sd = await summaryRes.json();
        if (sd.type === 'standard') {
          bio = sd.extract || bio;
          photoUrl = sd.thumbnail?.source || sd.originalimage?.source || photoUrl;
        }
      }

      if (photoUrl || bio) {
        return { photoUrl, bio };
      }
    } catch (e) {
      // try next candidate
    }
  }
  return null;
}

async function main() {
  // Find 50 players where photoUrl is null — prioritize those also missing bios
  const players = await prisma.player.findMany({
    where: { photoUrl: null, bio: null },
    select: { id: true, name: true, bio: true, photoUrl: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  if (players.length < BATCH_SIZE) {
    const have = new Set(players.map(p => p.id));
    const extra = await prisma.player.findMany({
      where: { photoUrl: null, bio: { not: null }, id: { notIn: [...have] } },
      select: { id: true, name: true, bio: true, photoUrl: true },
      take: BATCH_SIZE - players.length,
      orderBy: { createdAt: 'asc' },
    });
    players.push(...extra);
  }

  console.log(`Found ${players.length} players with null photoUrl. Starting enrichment...`);
  console.log(`Start time: ${new Date().toISOString()}`);

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    console.log(`[${i + 1}/${players.length}] ${player.name}...`);

    try {
      const result = await tryWikipedia(player.name);
      if (!result) {
        STATS.notFound++;
        console.log(`  → not found on Wikipedia`);
        continue;
      }

      STATS.found++;

      const updates = {};
      if (result.photoUrl) {
        updates.photoUrl = result.photoUrl;
        STATS.photoUpdated++;
      }
      if (result.bio && (!player.bio || player.bio.length < result.bio.length)) {
        updates.bio = result.bio;
        STATS.bioUpdated++;
      }

      if (Object.keys(updates).length > 0) {
        updates.enrichedAt = new Date();
        await prisma.player.update({
          where: { id: player.id },
          data: updates,
        });
        const parts = [];
        if (updates.photoUrl) parts.push('photo ✓');
        if (updates.bio) parts.push('bio ✓');
        console.log(`  → updated: ${parts.join(', ')}`);
      } else {
        STATS.skipped++;
        console.log(`  → found but no new data`);
      }
    } catch (e) {
      STATS.errors++;
      console.log(`  → ERROR: ${e.message}`);
    }
  }

  console.log('\n=== BATCH COMPLETE ===');
  console.log(`End time: ${new Date().toISOString()}`);
  console.log(`Players processed: ${players.length}`);
  console.log(`Found on Wikipedia: ${STATS.found}`);
  console.log(`Photo updated:      ${STATS.photoUpdated}`);
  console.log(`Bio updated:        ${STATS.bioUpdated}`);
  console.log(`Not found:          ${STATS.notFound}`);
  console.log(`Skipped (no new):   ${STATS.skipped}`);
  console.log(`Errors:             ${STATS.errors}`);
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
