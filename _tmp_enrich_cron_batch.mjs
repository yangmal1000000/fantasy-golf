import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

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
        console.log(`  ⚠ 429 rate-limited, backing off...`);
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

async function getSummary(title) {
  const slug = encodeURIComponent(title.replace(/\s+/g, "_"));
  const data = await fetchJSON(`${REST}${slug}`);
  if (!data || data.type === "disambiguation") return null;
  return data;
}

function isGolfRelated(summary) {
  const text = `${summary.extract || ""} ${summary.description || ""}`.toLowerCase();
  return text.includes("golf") || text.includes("pga") || text.includes("golfer") ||
         text.includes("tour pro") || text.includes(" european tour") || text.includes("ryder cup");
}

async function enrichPlayer(name) {
  // Strategy: direct REST API lookups with known title patterns first
  const titleVariants = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name} (English golfer)`,
    `${name} (Scottish golfer)`,
    `${name} (Australian golfer)`,
    `${name} (South African golfer)`,
    `${name} (Irish golfer)`,
    `${name} (Welsh golfer)`,
    `${name} (Japanese golfer)`,
    `${name} (Canadian golfer)`,
    name,
  ];

  for (const variant of titleVariants) {
    const summary = await getSummary(variant);
    await sleep(350);
    if (summary && nameMatches(name, summary.title) && isGolfRelated(summary)) {
      return summary;
    }
  }

  // Fallback: Wikipedia search API
  const params = new URLSearchParams({
    action: "query", list: "search", srsearch: `${name} golfer`,
    format: "json", srlimit: "5", origin: "*",
  });
  const data = await fetchJSON(`${SEARCH_API}?${params}`);
  await sleep(350);
  const results = data?.query?.search ?? [];

  for (const result of results) {
    if (!nameMatches(name, result.title)) continue;
    const summary = await getSummary(result.title);
    await sleep(350);
    if (summary && isGolfRelated(summary)) {
      return summary;
    }
  }

  return null;
}

async function main() {
  console.log(`=== FG Player Enrichment Batch (cron) ===`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Model: zai-coding-b/glm-5.2`);
  console.log();

  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    take: 50,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  console.log(`Players to process: ${players.length}\n`);

  let enriched = 0, photoFound = 0, bioFound = 0, skipped = 0;
  const errors = [];
  const noMatch = [];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    process.stdout.write(`[${i + 1}/${players.length}] ${p.name} ... `);

    try {
      const summary = await enrichPlayer(p.name);

      if (!summary) {
        console.log("✗ no match");
        noMatch.push(p.name);
        await prisma.player.update({
          where: { id: p.id },
          data: { enrichedAt: new Date() },
        });
        skipped++;
        continue;
      }

      const photoUrl = summary.thumbnail?.source || summary.originalimage || null;
      const bio = summary.extract && summary.extract.length > 20 ? summary.extract : null;

      const update = { enrichedAt: new Date() };
      if (photoUrl) { update.photoUrl = photoUrl; photoFound++; }
      if (bio) { update.bio = bio; bioFound++; }

      await prisma.player.update({ where: { id: p.id }, data: update });
      enriched++;

      console.log(`"${summary.title}" → photo:${photoUrl ? "✓" : "✗"} bio:${bio ? "✓" : "✗"}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ name: p.name, error: err.message });
      skipped++;
      await sleep(2000);
    }
  }

  console.log("\n=== FINAL STATS ===");
  console.log(`Processed:      ${players.length}`);
  console.log(`Enriched:       ${enriched}`);
  console.log(`Photos found:   ${photoFound}`);
  console.log(`Bios found:     ${bioFound}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`Errors:         ${errors.length}`);
  console.log(`No match:       ${noMatch.length}`);
  if (noMatch.length > 0) {
    console.log(`  ${noMatch.slice(0, 10).join(", ")}${noMatch.length > 10 ? " ..." : ""}`);
  }

  const remaining = await prisma.player.count({ where: { photoUrl: null } });
  const total = await prisma.player.count();
  console.log(`\nPlayers still missing photo: ${remaining} / ${total} total`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
