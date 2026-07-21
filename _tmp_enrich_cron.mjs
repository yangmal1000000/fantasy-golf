import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UA = "FantasyGolfBot/1.0 (contact: harry@fantasygolf.local)";
const REST = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const SEARCH = "https://en.wikipedia.org/w/api.php";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(1000 * (i + 1)); }
  }
  return null;
}

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
}

function nameMatch(name, title) {
  const n = norm(name), t = norm(title);
  if (t === n || t === `${n} golfer`) return true;
  if (t.startsWith(n + " ") || t.startsWith(n + "(")) return true;
  return false;
}

function isGolfContext(text) {
  const t = text.toLowerCase();
  return t.includes("golf") || t.includes("pga") || t.includes("golfer") || t.includes("tour pro") || t.includes("dp World") || t.includes("european tour");
}

// Strategy: REST lookups with title variants, then search API fallback
async function enrichPlayer(name) {
  // Direct REST lookups per instructions + common nationality variants
  const restVariants = [
    `${name} (golfer)`,
    `${name} (American golfer)`,
    `${name} (English golfer)`,
    `${name} (Scottish golfer)`,
    `${name} (Australian golfer)`,
    `${name} (South African golfer)`,
    `${name} (Irish golfer)`,
    `${name} (Welsh golfer)`,
    `${name} (Northern Irish golfer)`,
    name,
  ];

  for (const variant of restVariants) {
    const slug = encodeURIComponent(variant.replace(/\s+/g, "_"));
    const data = await fetchJSON(`${REST}${slug}`);
    await sleep(350);
    if (data && data.type !== "disambiguation" && nameMatch(name, data.title)) {
      const ctx = `${data.extract || ""} ${data.description || ""}`;
      if (isGolfContext(ctx)) return data;
    }
  }

  // Fallback: search API
  for (const q of [`${name} golfer`, `${name} PGA golf`, `${name} European tour golf`]) {
    const params = new URLSearchParams({
      action: "query", list: "search", srsearch: q,
      format: "json", srlimit: "5", origin: "*",
    });
    const data = await fetchJSON(`${SEARCH}?${params}`);
    await sleep(450);
    const results = data?.query?.search ?? [];
    for (const r of results) {
      if (!nameMatch(name, r.title)) continue;
      const snippet = r.snippet || "";
      if (isGolfContext(snippet)) {
        const slug = encodeURIComponent(r.title.replace(/\s+/g, "_"));
        const summary = await fetchJSON(`${REST}${slug}`);
        await sleep(350);
        if (summary && summary.type !== "disambiguation") return summary;
      }
    }
  }

  return null;
}

async function main() {
  const players = await prisma.player.findMany({
    where: { photoUrl: null },
    take: 50,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  console.log("=== FG Player Enrichment Batch ===");
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Players to process: ${players.length}\n`);

  let enriched = 0, photoFound = 0, bioFound = 0, noMatch = 0;
  const errors = [];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    process.stdout.write(`[${i + 1}/${players.length}] ${p.name} ... `);

    try {
      const summary = await enrichPlayer(p.name);

      if (!summary) {
        console.log("✗ no match");
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

      console.log(`"${summary.title}" → photo:${photoUrl ? "✓" : "✗"} bio:${bio ? "✓" : "✗"}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors.push({ name: p.name, error: err.message });
      noMatch++;
      await sleep(2000);
    }
  }

  console.log("\n=== FINAL STATS ===");
  console.log(`Processed:     ${players.length}`);
  console.log(`Enriched:      ${enriched}`);
  console.log(`Photos found:  ${photoFound}`);
  console.log(`Bios found:    ${bioFound}`);
  console.log(`No match:      ${noMatch}`);
  console.log(`Errors:        ${errors.length}`);
  if (errors.length) {
    console.log("\nError details:");
    for (const e of errors) console.log(`  - ${e.name}: ${e.error}`);
  }

  const remaining = await prisma.player.count({ where: { photoUrl: null } });
  console.log(`\nPlayers still missing photo: ${remaining}`);
  console.log(`Finished: ${new Date().toISOString()}`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
