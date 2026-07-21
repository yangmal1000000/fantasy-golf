import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATS = {
  queried: 0,
  photoFound: 0,
  bioFound: 0,
  bothFound: 0,
  missed: 0,
  errors: 0,
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'FantasyGolf-Enrichment/1.0 (private project; contact@fantasygolf.app)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

function extractThumbnailUrl(pageData) {
  if (!pageData || !pageData.originalimage) return null;
  return pageData.originalimage.source || null;
}

function extractExtract(pageData) {
  if (!pageData || !pageData.extract) return null;
  let text = pageData.extract.trim();
  if (text.length > 1500) {
    text = text.slice(0, 1497) + '...';
  }
  return text || null;
}

async function tryQueryWikipedia(name) {
  const variants = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name} (English golfer)`,
    `${name} (Scottish golfer)`,
    `${name} (Australian golfer)`,
    `${name} (professional golfer)`,
    name,
  ];

  for (const title of variants) {
    const encoded = encodeURIComponent(title);
    const restUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

    try {
      const data = await fetchJson(restUrl);
      if (data && data.type !== 'disambiguation' && data.type !== 'no-extract') {
        const photo = data.thumbnail?.source || data.originalimage?.source || null;
        const bio = data.extract ? data.extract.trim().slice(0, 1500) : null;

        // Sanity check: the extract should mention "golf" or "golfer"
        if (bio && /golf/i.test(bio)) {
          return { photo, bio, matchTitle: data.title };
        }
      }
    } catch (e) {
      // continue to next variant
    }

    await sleep(150); // small delay between attempts
  }

  return null;
}

async function main() {
  console.log('[enrich] Starting batch of 50...');

  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    take: 50,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  console.log(`[enrich] Found ${players.length} players to process`);

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    STATS.queried++;

    try {
      const result = await tryQueryWikipedia(p.name);

      if (result && (result.photo || result.bio)) {
        const update = { enrichedAt: new Date() };
        if (result.photo) {
          update.photoUrl = result.photo;
          STATS.photoFound++;
        }
        if (result.bio) {
          update.bio = result.bio;
          STATS.bioFound++;
        }
        if (result.photo && result.bio) STATS.bothFound++;

        await prisma.player.update({
          where: { id: p.id },
          data: update,
        });

        console.log(`  [${i + 1}/${players.length}] ✓ ${p.name} → photo:${!!result.photo} bio:${!!result.bio} (matched: ${result.matchTitle})`);
      } else {
        STATS.missed++;
        console.log(`  [${i + 1}/${players.length}] ✗ ${p.name} — no match`);
      }
    } catch (e) {
      STATS.errors++;
      console.error(`  [${i + 1}/${players.length}] ⚠ ${p.name} — error: ${e.message}`);
    }

    // small delay between players
    if (i < players.length - 1) await sleep(250);
  }

  console.log('\n[enrich] === STATS ===');
  console.log(JSON.stringify(STATS, null, 2));
  console.log('[enrich] Done.');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('[enrich] Fatal:', e);
  process.exit(1);
});
