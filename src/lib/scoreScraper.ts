import { prisma } from "@/lib/prisma";

// ---------- Types ----------

export interface ScrapedPlayerScore {
  name: string;
  roundScores: (number | null)[]; // [R1, R2, R3, R4]
  total: number | null;
  thru: string | null;
}

export interface ScrapeResult {
  success: boolean;
  players: ScrapedPlayerScore[];
  error?: string;
}

// ---------- Scraper ----------

/**
 * Fetch and parse the CBS Sports golf leaderboard.
 * Extracts player names and round-by-round scores.
 *
 * This is designed to be resilient — if the page structure changes or the
 * request fails, we return an empty result rather than throwing.
 */
export async function fetchCbsLeaderboard(
  tournamentUrl?: string
): Promise<ScrapeResult> {
  try {
    const url =
      tournamentUrl ||
      "https://www.cbssports.com/golf/leaderboard/";

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { success: false, players: [], error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const players = parseCbsHtml(html);
    return { success: true, players };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, players: [], error: msg };
  }
}

/**
 * Parse CBS Sports HTML to extract leaderboard data.
 * CBS uses table rows with player names and round scores.
 * We try multiple patterns since the exact DOM can change.
 */
function parseCbsHtml(html: string): ScrapedPlayerScore[] {
  const players: ScrapedPlayerScore[] = [];

  // Strategy 1: Look for JSON-LD or embedded JSON data
  const jsonMatch = html.match(/(?:window\.__INITIAL_STATE__|window\.\w+)\s*=\s*({[\s\S]*?});/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      // Try to navigate common paths
      const leaderboard =
        data?.leaderboard?.players ||
        data?.page?.leaderboard?.players ||
        data?.players;
      if (Array.isArray(leaderboard)) {
        for (const p of leaderboard) {
          const roundScores: (number | null)[] = [null, null, null, null];
          if (Array.isArray(p.rounds)) {
            p.rounds.forEach((r: { round: number; strokes: number | null }, i: number) => {
              if (i < 4) roundScores[i] = r.strokes ?? null;
            });
          }
          if (Array.isArray(p.scores)) {
            p.scores.forEach((s: number | null, i: number) => {
              if (i < 4) roundScores[i] = s;
            });
          }
          players.push({
            name: p.playerName || p.name || "Unknown",
            roundScores,
            total: p.total ?? p.totalScore ?? null,
            thru: p.thru ?? null,
          });
        }
        if (players.length > 0) return players;
      }
    } catch {
      // Fall through to HTML parsing
    }
  }

  // Strategy 2: Parse HTML tables
  // CBS leaderboard typically has rows with class containing "player"
  const rowRegex =
    /<tr[^>]*class="[^"]*(?:player|Player|leaderboard-row)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and trim
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      cells.push(text);
    }

    if (cells.length < 3) continue;

    // Try to find player name (usually has letters and spaces)
    const nameCell = cells.find(
      (c) => c.length > 3 && /^[A-Z][a-z]+\s+[A-Z]/.test(c)
    );
    if (!nameCell) continue;

    // Extract numeric scores from cells
    const numbers = cells
      .map((c) => {
        const n = parseInt(c, 10);
        return isNaN(n) ? null : n;
      })
      .filter((n): n is number => n != null);

    // Last few numbers are likely round scores
    const roundScores: (number | null)[] = [null, null, null, null];
    for (let i = 0; i < Math.min(4, numbers.length); i++) {
      roundScores[i] = numbers[i];
    }

    const total = numbers.length > 4 ? numbers[numbers.length - 1] : null;

    players.push({
      name: nameCell,
      roundScores,
      total,
      thru: null,
    });
  }

  return players;
}

// ---------- DB Sync ----------

/**
 * Update database scores from scraped CBS data.
 * Matches scraped players to TournamentPlayer records by name (fuzzy match).
 * Creates or updates Score records for each round found.
 */
export async function updateScoresFromScrape(
  tournamentId: string,
  scrapedPlayers: ScrapedPlayerScore[]
): Promise<{ updated: number; created: number; unmatched: string[] }> {
  let updated = 0;
  let created = 0;
  const unmatched: string[] = [];

  // Get all tournament players with their player info
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { player: true },
  });

  // Build a name → tournamentPlayer map (case-insensitive)
  const nameMap = new Map<string, typeof tournamentPlayers[number]>();
  for (const tp of tournamentPlayers) {
    const normalizedName = tp.player.name.toLowerCase().trim();
    nameMap.set(normalizedName, tp);

    // Also map by last name for fuzzy matching
    const lastName = tp.player.name.split(" ").slice(-1)[0]?.toLowerCase().trim();
    if (lastName) nameMap.set(lastName, tp);
  }

  for (const scraped of scrapedPlayers) {
    const normalizedName = scraped.name.toLowerCase().trim();

    // Try exact match first, then last name
    let matched = nameMap.get(normalizedName);
    if (!matched) {
      const lastName = normalizedName.split(" ").slice(-1)[0];
      matched = lastName ? nameMap.get(lastName) : undefined;
    }

    // Fuzzy: check if any DB player name contains the scraped name or vice versa
    if (!matched) {
      for (const [dbKey, tp] of nameMap.entries()) {
        if (
          dbKey.includes(normalizedName) ||
          normalizedName.includes(dbKey) ||
          (normalizedName.length > 4 && dbKey.includes(normalizedName.slice(0, 5)))
        ) {
          matched = tp;
          break;
        }
      }
    }

    if (!matched) {
      unmatched.push(scraped.name);
      continue;
    }

    // Upsert scores for each round
    for (let round = 0; round < 4; round++) {
      const strokes = scraped.roundScores[round];
      if (strokes == null) continue;

      const existing = await prisma.score.findUnique({
        where: {
          tournamentId_playerId_round: {
            tournamentId,
            playerId: matched.playerId,
            round: round + 1,
          },
        },
      });

      if (existing) {
        if (existing.strokes !== strokes) {
          await prisma.score.update({
            where: { id: existing.id },
            data: { strokes, isEstimated: false },
          });
          updated++;
        }
      } else {
        await prisma.score.create({
          data: {
            tournamentId,
            playerId: matched.playerId,
            round: round + 1,
            strokes,
            isEstimated: false,
          },
        });
        created++;
      }
    }
  }

  return { updated, created, unmatched };
}
