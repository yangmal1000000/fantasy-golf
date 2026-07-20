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

// Check if the player name matches the Wikipedia title
function nameMatchesTitle(name, title) {
  const normalize = (s) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, " ");

  const n = normalize(name);
  const t = normalize(title);

  // Title must contain the full name, or name with (golfer) suffix
  if (t === n || t === `${n} golfer`) return true;

  // Title starts with the name (e.g., "Corey Conners (golfer)" matches "Corey Conners")
  if (t.startsWith(n + " ") || t.startsWith(n + "(")) return true;

  return false;
}

async function findTitle(name) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${name} golfer`,
    format: "json",
    srlimit: "5",
    origin: "*",
  });

  const data = await fetchWithRetry(`${SEARCH_API}?${params}`);
  if (!data?.query?.search?.length) return null;

  const results = data.query.search;

  // First pass: require name to match the title
  for (const r of results) {
    if (nameMatchesTitle(name, r.title)) {
      // Verify golf context in snippet
      const snippet = (r.snippet || "").toLowerCase();
      const isGolf =
        snippet.includes("golf") ||
        snippet.includes("pga") ||
        snippet.includes("golfer") ||
        snippet.includes("tour") ||
        snippet.includes("professional");
      if (isGolf) return r.title;
    }
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
  // First: repair the 3 known bad matches
  const repairNames = ["Mac Meissner", "Kevin Roy", "Chandler Blanchet"];
  const repairPlayers = await prisma.player.findMany({
    where: { name: { in: repairNames } },
    select: { id: true, name: true, bio: true },
  });

  console.log(`=== REPAIRING ${repairPlayers.length} BAD MATCHES ===\n`);

  for (const p of repairPlayers) {
    console.log(`Repairing: ${p.name}`);
    // Clear the bad bio, reset enrichedAt
    await prisma.player.update({
      where: { id: p.id },
      data: { bio: null, enrichedAt: null },
    });

    // Try to find correct page
    const title = await findTitle(p.name);
    await sleep(600);

    if (title) {
      console.log(`  → found correct title: "${title}"`);
      const summary = await getSummary(title);
      await sleep(600);

      if (summary) {
        const photoUrl =
          summary.thumbnail?.source || summary.originalimage || null;
        const bio = summary.extract || null;

        const update = { enrichedAt: new Date() };
        if (photoUrl) update.photoUrl = photoUrl;
        if (bio && bio.length > 20) update.bio = bio;

        await prisma.player.update({ where: { id: p.id }, data: update });
        console.log(
          `  → repaired (photo: ${photoUrl ? "✓" : "✗"}, bio: ${bio ? "✓" : "✗"})`
        );
      } else {
        console.log(`  → no summary available`);
      }
    } else {
      console.log(`  → no Wikipedia page found (bio cleared)`);
    }
  }

  // Now process remaining players with null photoUrl
  console.log("\n=== PROCESSING NEW BATCH ===\n");

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

  for (let idx = 0; idx < players.length; idx++) {
    const p = players[idx];
    console.log(`[${idx + 1}/${players.length}] ${p.name}`);

    try {
      const title = await findTitle(p.name);
      await sleep(600);

      if (!title) {
        console.log(`  → no Wikipedia page found`);
        skipped++;
        continue;
      }

      console.log(`  → title: "${title}"`);

      const summary = await getSummary(title);
      await sleep(600);

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
  console.log(`Repaired bad matches: ${repairPlayers.length}`);
  console.log(`New batch processed:  ${players.length}`);
  console.log(`New players enriched: ${found}`);
  console.log(`Photos updated:       ${photoUpdated}`);
  console.log(`Bios updated:         ${bioUpdated}`);
  console.log(`Skipped:              ${skipped}`);
  console.log(`Errors:               ${errors.length}`);
  if (errors.length) {
    console.log("Error details:");
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  }
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
