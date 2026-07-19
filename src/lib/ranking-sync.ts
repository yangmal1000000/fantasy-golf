/**
 * Ranking Sync Module
 * -------------------
 * Resilient scraping/fetching utilities for updating player rankings from
 * external sources (OWGR, ESPN). Every function returns `null` on failure
 * rather than throwing — callers should check the return value.
 */

import { prisma } from "./prisma";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OWGRPlayer {
  rank: number;
  name: string;
  country: string;
}

export interface ESPNEvent {
  name: string;
  startDate: string;
  endDate: string;
  course: string | null;
  status: string;
}

export interface ESPNSchedule {
  tour: "pga" | "lpga";
  year: number;
  events: ESPNEvent[];
}

export interface RankingSyncResult {
  playersUpdated: number;
  playersMatched: number;
  playersUnmatched: number;
  errors: string[];
}

// ── OWGR Scraper ───────────────────────────────────────────────────────────

/**
 * Scrape the Official World Golf Ranking from https://www.owgr.com/ranking
 *
 * The page loads rankings dynamically, but the data is also available in
 * an embedded JSON script or via their internal API. We try multiple
 * strategies in order:
 *   1. Fetch the OWGR page and look for embedded JSON
 *   2. Fall back to a best-effort HTML table parse
 *
 * Returns null on failure — never throws.
 */
export async function syncRankingsFromOWGR(): Promise<RankingSyncResult | null> {
  try {
    const rankings = await fetchOWGRRankings();
    if (!rankings || rankings.length === 0) {
      return null;
    }

    // Load all existing players from the database
    const dbPlayers = await prisma.player.findMany({
      select: { id: true, name: true, dataGolfRank: true },
    });

    // Build a name → player lookup map (case-insensitive, trimmed)
    const nameMap = new Map<string, { id: string; name: string }>();
    for (const p of dbPlayers) {
      const key = p.name.toLowerCase().trim();
      nameMap.set(key, { id: p.id, name: p.name });
    }

    let updated = 0;
    let matched = 0;
    let unmatched = 0;
    const errors: string[] = [];
    const unmatchedNames: string[] = [];

    for (const entry of rankings) {
      const key = entry.name.toLowerCase().trim();
      const dbPlayer = nameMap.get(key);

      if (!dbPlayer) {
        // Try a fuzzy match — last name only
        const lastName = key.split(" ").pop() ?? key;
        let fuzzyMatch: { id: string; name: string } | null = null;
        for (const [mapKey, mapVal] of nameMap) {
          const mapLast = mapKey.split(" ").pop() ?? mapKey;
          if (mapLast === lastName) {
            fuzzyMatch = mapVal;
            break;
          }
        }
        if (!fuzzyMatch) {
          unmatched++;
          if (unmatchedNames.length < 20) unmatchedNames.push(entry.name);
          continue;
        }
        // Update the fuzzy match
        await prisma.player.update({
          where: { id: fuzzyMatch.id },
          data: { dataGolfRank: entry.rank, country: entry.country || undefined },
        });
        updated++;
        matched++;
        continue;
      }

      // Only update if rank has changed
      if ((dbPlayer as any).dataGolfRank !== entry.rank) {
        await prisma.player.update({
          where: { id: dbPlayer.id },
          data: { dataGolfRank: entry.rank, country: entry.country || undefined },
        });
        updated++;
      }
      matched++;
    }

    if (unmatchedNames.length > 0) {
      errors.push(`Unmatched players (sample): ${unmatchedNames.join(", ")}`);
    }

    return {
      playersUpdated: updated,
      playersMatched: matched,
      playersUnmatched: unmatched,
      errors,
    };
  } catch (e) {
    console.error("syncRankingsFromOWGR error:", e);
    return null;
  }
}

/**
 * Fetch and parse OWGR rankings from the public website.
 * Returns null on any failure.
 */
async function fetchOWGRRankings(): Promise<OWGRPlayer[] | null> {
  const FETCH_TIMEOUT = 15000;

  try {
    // OWGR has an internal API that the frontend calls. Try it first.
    const apiUrl = "https://api.owgr.com/v1/ranking?page=1&pageSize=300";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; FantasyGolfAdmin/1.0)",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const players = parseOWGRApiResponse(data);
      if (players && players.length > 0) return players;
    }
  } catch (e) {
    console.warn("OWGR API fetch failed, trying HTML scrape:", e);
  }

  // Fall back to HTML page scrape
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch("https://www.owgr.com/ranking", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FantasyGolfAdmin/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    return parseOWGRHtml(html);
  } catch (e) {
    console.error("OWGR HTML fetch failed:", e);
    return null;
  }
}

/**
 * Parse the OWGR API JSON response.
 * The exact shape may vary, so we handle multiple known structures.
 */
function parseOWGRApiResponse(data: unknown): OWGRPlayer[] | null {
  try {
    // Handle array-of-players shape: { rankings: [...] } or { players: [...] } or [...]
    const root = data as Record<string, unknown>;
    let list: unknown;

    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray(root.rankings)) {
      list = root.rankings;
    } else if (Array.isArray(root.players)) {
      list = root.players;
    } else if (root.data && Array.isArray((root.data as Record<string, unknown>).rankings)) {
      list = (root.data as Record<string, unknown>).rankings;
    } else if (root.data && Array.isArray((root.data as Record<string, unknown>).players)) {
      list = (root.data as Record<string, unknown>).players;
    } else {
      return null;
    }

    const players: OWGRPlayer[] = [];
    for (const item of list as Record<string, unknown>[]) {
      // Try various field names
      const rank = Number(item.rank ?? item.ranking ?? item.position ?? item.owgrRank);
      const name =
        String(item.name ?? item.playerName ?? item.fullName ?? item.player ?? "").trim();
      const country = String(item.country ?? item.countryCode ?? item.nationality ?? "").trim();

      if (rank > 0 && name) {
        players.push({ rank, name, country });
      }
    }

    return players.length > 0 ? players : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort HTML scrape of the OWGR rankings table.
 * Looks for table rows with rank, name, country.
 */
function parseOWGRHtml(html: string): OWGRPlayer[] | null {
  try {
    const players: OWGRPlayer[] = [];

    // Match patterns like: <td>1</td> ... <td>Scottie Scheffler</td> ... <td>USA</td>
    // This is intentionally permissive — table structure may shift.
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Strip tags and trim
        const text = cellMatch[1]
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .trim();
        cells.push(text);
      }

      // Expect at least: rank, name, country — try to identify
      if (cells.length >= 3) {
        const rank = parseInt(cells[0], 10);
        if (rank > 0 && rank <= 500) {
          const name = cells[1];
          const country = cells[2] || "";
          // Sanity: name should contain at least one space (first + last)
          if (name && name.length > 2 && !/^\d+$/.test(name)) {
            players.push({ rank, name, country });
          }
        }
      }
    }

    return players.length > 0 ? players : null;
  } catch {
    return null;
  }
}

// ── ESPN Schedule Fetcher ──────────────────────────────────────────────────

/**
 * Fetch the current tournament schedule from ESPN's unofficial API.
 *
 * @param tour  "pga" or "lpga"
 * @param year  Optional year filter (ESPN scoreboard may be current-week only)
 * @returns     ESPNSchedule or null on failure
 */
export async function getESPNSchedule(
  tour: "pga" | "lpga",
  year?: number
): Promise<ESPNSchedule | null> {
  const FETCH_TIMEOUT = 12000;

  try {
    const baseUrl =
      tour === "pga"
        ? "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard"
        : "https://site.api.espn.com/apis/site/v2/sports/golf/lpga/scoreboard";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(baseUrl, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; FantasyGolfAdmin/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const events: ESPNEvent[] = [];

    const rawEvents = data?.events;
    if (Array.isArray(rawEvents)) {
      for (const ev of rawEvents) {
        const name = ev?.name ?? ev?.shortName ?? "Unknown";
        const date = ev?.date ?? ev?.startDate ?? "";
        const competitions = Array.isArray(ev?.competitions) ? ev.competitions : [];
        const details = competitions[0]?.details ?? {};
        const course =
          details?.course?.fullName ??
          details?.venue?.fullName ??
          ev?.venue?.fullName ??
          null;

        let startDate = date;
        let endDate = date;
        if (ev?.date && ev?.endDate) {
          startDate = ev.date;
          endDate = ev.endDate;
        }

        const status =
          ev?.status?.type?.name ?? ev?.status?.type?.state ?? "scheduled";

        events.push({
          name: String(name),
          startDate: String(startDate),
          endDate: String(endDate),
          course: course ? String(course) : null,
          status: String(status),
        });
      }
    }

    return {
      tour,
      year: year ?? new Date().getFullYear(),
      events,
    };
  } catch (e) {
    console.error(`getESPNSchedule(${tour}) error:`, e);
    return null;
  }
}

// ── Tier Recalculation ─────────────────────────────────────────────────────

/**
 * Recalculate tier assignments for all TournamentPlayer records based on
 * each player's current dataGolfRank. Returns a summary of how many tiers
 * were changed.
 */
export async function recalculateTiers(): Promise<{
  tiersChanged: number;
  totalChecked: number;
}> {
  // Load all tournament players with their player rank
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    include: {
      player: {
        select: { dataGolfRank: true },
      },
    },
  });

  let tiersChanged = 0;
  let totalChecked = 0;

  for (const tp of tournamentPlayers) {
    totalChecked++;
    const correctTier = tierForRankLocal((tp.player as any).dataGolfRank);

    if (tp.tier !== correctTier) {
      await prisma.tournamentPlayer.update({
        where: { id: tp.id },
        data: { tier: correctTier },
      });
      tiersChanged++;
    }
  }

  return { tiersChanged, totalChecked };
}

/** Local copy to avoid circular imports */
function tierForRankLocal(rank: number | null | undefined): string {
  if (rank == null) return "T51_PLUS";
  if (rank <= 10) return "T1_10";
  if (rank <= 20) return "T11_20";
  if (rank <= 30) return "T21_30";
  if (rank <= 50) return "T31_50";
  return "T51_PLUS";
}
