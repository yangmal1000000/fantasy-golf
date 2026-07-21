import { PrismaClient } from "@prisma/client";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });
dotenvConfig({ path: ".env.local", override: true });

const prisma = new PrismaClient();

const SEARCH_API = "https://en.wikipedia.org/w/api.php";
const REST = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const UA = "FantasyGolfBot/1.0 (contact: harry@fantasygolf.local)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        console.log(`  (rate-limited, waiting ${3000 * (i + 1)}ms)`);
        await sleep(3000 * (i + 1));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(1000 * (i + 1));
    }
  }
  return null;
}

function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
}

function nameMatches(name, title) {
  const n = normalize(name);
  const t = normalize(title);
  if (t === n || t === `${n} golfer`) return true;
  if (t.startsWith(n + " ") || t.startsWith(n + "(")) return true;
  return false;
}

async function searchWikipedia(query) {
  const params = new URLSearchParams({
    action: "query", list: "search", srsearch: query,
    format: "json", srlimit: "5", origin: "*",
  });
  const data = await fetchJSON(`${SEARCH_API}?${params}`);
  return data?.query?.search ?? [];
}

async function getSummary(title) {
  const slug = encodeURIComponent(title.replace(/\s+/g, "_"));
  const data = await fetchJSON(`${REST}${slug}`);
  if (!data || data.type === "disambiguation") return null;
  return data;
}

async function enrichPlayer(name) {
  // Direct REST API lookups with known title patterns
  const titleVariants = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name} (English golfer)`,
    `${name} (Scottish golfer)`,
    `${name} (Australian golfer)`,
    `${name} (South African golfer)`,
    `${name} (golf)`,
    name,
  ];

  for (const variant of titleVariants) {
    const summary = await getSummary(variant);
    await sleep(300);
    if (summary && nameMatches(name, summary.title)) {
      const text = `${summary.extract || ""} ${summary.description || ""}`.toLowerCase();
      if (text.includes("golf") || text.includes("pga") || text.includes("golfer") || text.includes("tour pro") || text.includes("lpga") || text.includes("european tour") || text.includes("dp world")) {
        return summary;
      }
    }
  }

  // Fallback: search API
  const queries = [`${name} golfer`, `${name} PGA golf`, `${name} professional golfer`];
  for (const q of queries) {
    const results = await searchWikipedia(q);
    await sleep(400);
    for (const r of results) {
      if (nameMatches(name, r.title)) {
        const snippet = (r.snippet || "").toLowerCase();
        if (snippet.includes("golf") || snippet.includes("pga") || snippet.includes("golfer") || snippet.includes("tour") || snippet.includes("lpga")) {
          const summary = await getSummary(r.title);
          await sleep(300);
          if (summary) return summary;
        }
      }
    }
  }

  return null;
}

async function main() {
  const totalBefore = await prisma.player.count({ where: { photoUrl: null } });
  console.log(`=== FG Player Enrichment Batch ===`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Players missing photoUrl (total): ${totalBefore}`);

  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    take: 50,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  console.log(`Processing ${players.length} players this batch\n`);

  let enriched = 0, photoFound = 0, bioFound = 0, noMatch = 0;
  const errors = [];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    process.stdout.write(`[${i + 1}/${players.length}] ${p.name} ... `);

    try {
      const summary = await enrichPlayer(p.name);

      if (!summary) {
        console.log("✗ no Wikipedia match");
        await prisma.player.update({
          where: { id: p.id },
          data: { enrichedAt: new Date() },
        });
        noMatch++;
        continue;
      }

      const photoUrl = summary.thumbnail?.source || summary.originalimage || null;
      const bio = summary.extract && summary.extract.length > 20 ? summary.extract : null;

      const update = { enrichedAt: new Date() };
      if (photoUrl) { update.photoUrl = photoUrl; photoFound++; }
      if (bio) { update.bio = bio; bioFound++; }

      await prisma.player.update({ where: { id: p.id }, data: update });
      enriched++;

      console.log(`✓ "${summary.title}" — photo:${photoUrl ? "✓" : "✗"} bio:${bio ? "✓" : "✗"}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ name: p.name, error: err.message });
      await sleep(2000);
    }
  }

  const remaining = await prisma.player.count({ where: { photoUrl: null } });

  console.log("\n=== FINAL STATS ===");
  console.log(`Batch size:            ${players.length}`);
  console.log(`Enriched (any data):   ${enriched}`);
  console.log(`  Photos found:        ${photoFound}`);
  console.log(`  Bios found:          ${bioFound}`);
  console.log(`No Wikipedia match:    ${noMatch}`);
  console.log(`Errors:                ${errors.length}`);
  console.log(`Remaining w/o photo:   ${remaining} (was ${totalBefore})`);
  if (errors.length) {
    console.log("\nErrors:");
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
