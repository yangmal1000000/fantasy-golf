import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEARCH_API = "https://en.wikipedia.org/w/api.php";
const REST = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const UA = "FantasyGolfBot/1.0 (contact: harry@fantasygolf.local)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        const wait = 3000 * (attempt + 1);
        console.log(`  → rate limited, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

function nameMatchesTitle(name, title) {
  const normalize = (s) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, " ");

  const n = normalize(name);
  const t = normalize(title);

  if (t === n || t === `${n} golfer`) return true;
  if (t.startsWith(n + " ") || t.startsWith(n + "(")) return true;
  return false;
}

async function findTitle(name) {
  // Try multiple search strategies
  const searchVariants = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name}`,
  ];

  for (const variant of searchVariants) {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: variant,
      format: "json",
      srlimit: "5",
      origin: "*",
    });

    const data = await fetchWithRetry(`${SEARCH_API}?${params}`);
    if (!data?.query?.search?.length) {
      await sleep(300);
      continue;
    }

    const results = data.query.search;

    for (const r of results) {
      if (nameMatchesTitle(name, r.title)) {
        const snippet = (r.snippet || "").toLowerCase();
        const isGolf =
          snippet.includes("golf") ||
          snippet.includes("pga") ||
          snippet.includes("golfer") ||
          snippet.includes("tour") ||
          snippet.includes("professional") ||
          snippet.includes("open championship") ||
          snippet.includes("masters") ||
          snippet.includes("ryder cup");
        if (isGolf) return r.title;
      }
    }

    await sleep(300);
  }

  return null;
}

async function getSummary(title) {
  const slug = encodeURIComponent(title.replace(/\s+/g, "_"));
  const data = await fetchWithRetry(`${REST}${slug}`);
  if (!data) return null;
  if (data.type === "disambiguation") return null;
  return data;
}

async function main() {
  console.log("=== PLAYER ENRICHMENT BATCH ===\n");

  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    take: 50,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  console.log(`Found ${players.length} players with null photoUrl\n`);

  let found = 0;
  let photoUpdated = 0;
  let bioUpdated = 0;
  let skipped = 0;
  const errors = [];
  const noMatch = [];

  for (let idx = 0; idx < players.length; idx++) {
    const p = players[idx];
    console.log(`[${idx + 1}/${players.length}] ${p.name}`);

    try {
      const title = await findTitle(p.name);
      await sleep(500);

      if (!title) {
        console.log(`  → no Wikipedia page found`);
        skipped++;
        noMatch.push(p.name);
        continue;
      }

      console.log(`  → title: "${title}"`);

      const summary = await getSummary(title);
      await sleep(500);

      if (!summary) {
        console.log(`  → no summary data`);
        skipped++;
        continue;
      }

      const photoUrl =
        summary.thumbnail?.source || summary.originalimage || null;
      const bio = summary.extract || null;

      const update = { enrichedAt: new Date() };
      if (photoUrl) {
        update.photoUrl = photoUrl;
        photoUpdated++;
      }
      if (bio && bio.length > 20) {
        update.bio = bio;
        bioUpdated++;
      }

      if (photoUrl || bio) {
        found++;
        await prisma.player.update({ where: { id: p.id }, data: update });
        console.log(
          `  → UPDATED (photo: ${photoUrl ? "✓" : "✗"}, bio: ${bio ? "✓" : "✗"})`
        );
      } else {
        console.log(`  → page exists but no useful data`);
        skipped++;
      }
    } catch (err) {
      console.log(`  → ERROR: ${err.message}`);
      errors.push({ name: p.name, error: err.message });
      skipped++;
      await sleep(2000);
    }
  }

  console.log("\n=== FINAL ENRICHMENT STATS ===");
  console.log(`Batch processed:     ${players.length}`);
  console.log(`Players enriched:    ${found}`);
  console.log(`Photos updated:      ${photoUpdated}`);
  console.log(`Bios updated:        ${bioUpdated}`);
  console.log(`Skipped (no match):  ${skipped}`);
  console.log(`Errors:              ${errors.length}`);
  if (noMatch.length) {
    console.log(`\nNo Wikipedia match for ${noMatch.length} players:`);
    for (const n of noMatch) console.log(`  - ${n}`);
  }
  if (errors.length) {
    console.log(`\nError details:`);
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  }

  // Remaining count
  const remaining = await prisma.player.count({ where: { photoUrl: null } });
  console.log(`\nTotal players still missing photoUrl: ${remaining}`);
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
