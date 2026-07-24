/**
 * Data Sync Module
 * ----------------
 * Pulls real PGA Tour data from ESPN's unofficial API and updates the database.
 *
 * Data sources:
 *   - ESPN PGA scoreboard API (schedule, leaderboards, live scores)
 *   - ESPN golf rankings page (world rankings, top 200)
 *
 * All functions return a summary object and never throw — callers should
 * check the `ok` field.
 */

import { prisma } from "./prisma";
import { ROCKET_FIELD_TOURNAMENT_ID } from "./rocket-tiers";
import { processAutoSubs } from "./auto-sub";
import { recalculateTeamScores } from "./team-scores";
import { applyCutLogic } from "./scoring";
import { deriveLiveTournamentState } from "./live-sync-state";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  ok: boolean;
  created?: number;
  updated?: number;
  deleted?: number;
  skipped?: number;
  errors?: string[];
  details?: Record<string, unknown>;
}

interface ESPNCompetitor {
  id: string;
  type: string;
  order: number;
  score: string;
  thru?: string;
  athlete: {
    fullName: string;
    displayName: string;
    shortName?: string;
    flag?: { href: string; alt?: string };
  };
  linescores?: Array<{
    value: number;
    displayValue: string;
    period: number;
  }>;
  status?: { type?: { name?: string; state?: string } };
}

interface ESPNEvent {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  endDate?: string;
  status: { type: { name: string; state: string; completed?: boolean } };
  competitions: Array<{
    id: string;
    date: string;
    endDate?: string;
    competitors: ESPNCompetitor[];
    status: { period: number; type: { name: string; state: string; completed?: boolean } };
  }>;
}

interface ESPNScoreboardResponse {
  events?: ESPNEvent[];
  season?: { year: number; type: number };
}

// ── Tournament slug helpers ────────────────────────────────────────────────

/**
 * Known major/signature tournament mappings for slug generation.
 * Maps ESPN event names to our slug and metadata.
 */
const TOURNAMENT_META: Record<
  string,
  { slug: string; course?: string; par?: number; category: string; tour: string; entryFee: number }
> = {
  "The Masters": { slug: "masters", course: "Augusta National Golf Club", par: 72, category: "major", tour: "pga", entryFee: 1500 },
  "PGA Championship": { slug: "pga-championship", course: "TBD", par: 72, category: "major", tour: "pga", entryFee: 1500 },
  "U.S. Open": { slug: "us-open", course: "TBD", par: 70, category: "major", tour: "pga", entryFee: 1500 },
  "The Open": { slug: "the-open", course: "TBD", par: 70, category: "major", tour: "pga", entryFee: 1500 },
  "The Open Championship": { slug: "the-open", course: "TBD", par: 70, category: "major", tour: "pga", entryFee: 1500 },
  "The Players Championship": { slug: "players-championship", course: "TPC Sawgrass", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  "The Genesis Invitational": { slug: "genesis-invitational", course: "Riviera Country Club", par: 71, category: "signature", tour: "pga", entryFee: 1000 },
  "Arnold Palmer Invitational": { slug: "arnold-palmer-invitational", course: "Bay Hill Golf Club", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  "the Memorial Tournament pres. by Workday": { slug: "memorial-tournament", course: "Muirfield Village Golf Club", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  "The Memorial Tournament": { slug: "memorial-tournament", course: "Muirfield Village Golf Club", par: 72, category: "signature", tour: "pga", entryFee: 1000 },
  "TOUR Championship": { slug: "tour-championship", course: "East Lake Golf Club", par: 70, category: "playoff", tour: "pga", entryFee: 1000 },
  "Tour Championship": { slug: "tour-championship", course: "East Lake Golf Club", par: 70, category: "playoff", tour: "pga", entryFee: 1000 },
  "FedEx St. Jude Championship": { slug: "fedex-st-jude-championship", course: "TPC Southwind", par: 70, category: "playoff", tour: "pga", entryFee: 1000 },
  "BMW Championship": { slug: "bmw-championship", course: "TBD", par: 71, category: "playoff", tour: "pga", entryFee: 1000 },
  "BMW PGA Championship": { slug: "bmw-pga-championship", course: "Wentworth Club", par: 72, category: "dpwt", tour: "dpwt", entryFee: 1000 },
  "Rocket Classic": { slug: "rocket-classic", course: "Detroit Golf Club", par: 70, category: "regular", tour: "pga", entryFee: 0 },
};

/**
 * Generate a slug from a tournament name.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/pres\.?\s+by\s+\w+/gi, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get tournament metadata from known names or generate defaults.
 */
function getTournamentMeta(name: string) {
  // Try exact match
  if (TOURNAMENT_META[name]) return TOURNAMENT_META[name];

  // Try The Open variants
  if (name.includes("Open Championship") || name === "The Open") {
    return TOURNAMENT_META["The Open"];
  }

  // Try partial matches
  for (const [key, val] of Object.entries(TOURNAMENT_META)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return val;
    }
  }

  // Default for unknown tournaments
  return {
    slug: slugify(name),
    course: undefined as string | undefined,
    par: 72,
    category: "regular",
    tour: "pga",
    entryFee: 1000,
  };
}

// ── ESPN name alias map ────────────────────────────────────────────────────

/**
 * Maps our tournament DB names to known ESPN event names.
 * ESPN often uses longer, sponsored, or slightly different names than what
 * we store. This covers the 9 known mismatches.
 */
const TOURNAMENT_ALIASES: Record<string, string[]> = {
  "The Masters": ["Masters Tournament", "The Masters Tournament"],
  "Chevron Championship": ["The Chevron Championship", "Chevron Championship"],
  "Mexico Open": ["Mexico Open at Vidanta", "Mexico Open"],
  "Wells Fargo": ["Wells Fargo Championship"],
  "Wells Fargo Championship": ["Wells Fargo Championship"],
  "Byron Nelson": ["AT&T Byron Nelson", "Byron Nelson Championship"],
  "Rocket Mortgage": ["Rocket Mortgage Classic"],
  "Charles Schwab": ["Charles Schwab Challenge"],
  "KPMG Women's PGA": ["KPMG Women's PGA Championship"],
  "U.S. Women's Open": ["U.S. Women's Open Championship", "U.S. Women's Open"],
};

/**
 * Normalize a tournament name for fuzzy comparison.
 * Strips common suffixes (Championship, Classic, Tournament, Invitational,
 * The, at <Venue>) so substring matches are more likely to succeed.
 */
function normalizeTournamentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+(championship|classic|tournament|invitational|open championship)\s*$/g, "")
    .replace(/\s+at\s+\w+.*$/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Find the best matching ESPN event for a tournament.
 * Uses exact match, aliases, substring, normalized, and slug comparison.
 */
function findMatchingESPNEvent(
  events: ESPNEvent[],
  tournamentName: string,
  tournamentMeta: { slug: string }
): ESPNEvent | undefined {
  // 1. Exact match
  let match = events.find((e) => e.name === tournamentName);
  if (match) return match;

  // 2. Alias match — check if any alias matches an ESPN event name
  const aliases = TOURNAMENT_ALIASES[tournamentName];
  if (aliases) {
    for (const alias of aliases) {
      match = events.find((e) => e.name === alias);
      if (match) return match;
      // Also try alias as substring
      match = events.find((e) => e.name.includes(alias) || alias.includes(e.name));
      if (match) return match;
    }
  }

  // 3. Reverse alias lookup — check if any ESPN event name has an alias matching ours
  for (const [db_name, espn_names] of Object.entries(TOURNAMENT_ALIASES)) {
    if (db_name === tournamentName) continue;
    for (const espnName of espn_names) {
      match = events.find((e) => e.name === espnName && getTournamentMeta(e.name).slug === tournamentMeta.slug);
      if (match) return match;
    }
  }

  // 4. Substring match (original logic)
  match = events.find(
    (e) =>
      e.name.includes(tournamentName) ||
      tournamentName.includes(e.name)
  );
  if (match) return match;

  // 5. Normalized fuzzy match
  const normalizedTarget = normalizeTournamentName(tournamentName);
  match = events.find((e) => {
    const normalizedESPN = normalizeTournamentName(e.name);
    return normalizedESPN === normalizedTarget ||
      normalizedESPN.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedESPN);
  });
  if (match) return match;

  // 6. Slug match
  match = events.find((e) => getTournamentMeta(e.name).slug === tournamentMeta.slug);
  return match;
}

// ── Status helpers ─────────────────────────────────────────────────────────

function computeStatus(startDate: string, endDate: string, espnStatus: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (espnStatus === "STATUS_FINAL" || espnStatus === "STATUS_POSTPONED") {
    return end < now ? "completed" : "upcoming";
  }
  if (espnStatus === "STATUS_IN_PROGRESS" || espnStatus === "STATUS_SCHEDULED") {
    if (start <= now && end >= now) return "in_progress";
    if (now < start) {
      // If within 7 days, entries are open
      const daysUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil <= 7 ? "entries_open" : "upcoming";
    }
    return "completed";
  }
  if (end < now) return "completed";
  return "upcoming";
}

// ── ESPN Fetch helpers ─────────────────────────────────────────────────────

const FETCH_TIMEOUT = 15000;
const USER_AGENT = "Mozilla/5.0 (compatible; FantasyGolfSync/1.0)";

async function fetchESPN<T>(path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(`https://site.api.espn.com${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.error(`ESPN fetch error (${path}):`, e);
    return null;
  }
}

/**
 * Fetch ESPN scoreboard for a date range.
 * Format: dates=YYYYMMDD-YYYYMMDD
 */
async function fetchScoreboard(dateRange: string): Promise<ESPNScoreboardResponse | null> {
  return fetchESPN<ESPNScoreboardResponse>(
    `/apis/site/v2/sports/golf/pga/scoreboard?dates=${dateRange}`,
  );
}

// ── Tier helper ────────────────────────────────────────────────────────────

export function tierForRank(rank: number | null | undefined): string {
  if (rank == null) return "UNRANKED";
  if (rank <= 10) return "T1_10";
  if (rank <= 20) return "T11_20";
  if (rank <= 30) return "T21_30";
  if (rank <= 50) return "T31_50";
  return "T51_PLUS";
}

// ── Country code helper ────────────────────────────────────────────────────

function countryFromFlag(flag?: { href?: string; alt?: string }): string | null {
  if (!flag) return null;
  // Extract country code from URL like https://a.espncdn.com/i/teamlogos/countries/500/usa.png
  const match = flag.href?.match(/\/(\w+)\.\w+$/);
  if (match) return match[1].toUpperCase();
  // Fallback: use alt text
  if (flag.alt) return flag.alt;
  return null;
}

// ── Main Sync Functions ────────────────────────────────────────────────────

/**
 * syncTournamentSchedule
 * ----------------------
 * Pulls the PGA Tour schedule for the current year from ESPN and creates/updates
 * tournaments in the database.
 */
export async function syncTournamentSchedule(): Promise<SyncResult> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const year = new Date().getFullYear();

  // Fetch the full year schedule
  const dateRange = `${year}0101-${year}1231`;
  const data = await fetchScoreboard(dateRange);

  if (!data || !data.events || data.events.length === 0) {
    return { ok: false, errors: ["No events returned from ESPN"] };
  }

  // Filter to major, signature, playoff events + a few interesting regular ones
  // We'll include all events but categorize them
  for (const event of data.events) {
    try {
      const meta = getTournamentMeta(event.name);
      const startDate = event.date;
      const endDate = event.endDate || event.date;
      const espnStatus = event.status?.type?.name ?? "STATUS_SCHEDULED";
      const status = computeStatus(startDate, endDate, espnStatus);

      // Determine current round from ESPN status
      const competition = event.competitions?.[0];
      const currentRound = competition?.status?.period ?? 0;

      // Build tournament ID: slug (no year)
      const tournamentId = meta.slug;

      const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });

      const tournamentData = {
        name: event.name.replace(/\s+\d{4}$/, ""), // Remove trailing year if present
        course: meta.course ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status,
        par: meta.par ?? 72,
        entryFee: meta.entryFee,
        category: meta.category,
        tour: meta.tour,
        currentRound: status === "completed" ? 4 : status === "in_progress" ? currentRound : 0,
      };

      if (existing) {
        // Update existing tournament
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: tournamentData,
        });
        updated++;
      } else {
        await prisma.tournament.create({
          data: {
            id: tournamentId,
            ...tournamentData,
            prizePool: 0,
          },
        });
        created++;
      }
    } catch (e) {
      errors.push(`Failed to sync "${event.name}": ${e instanceof Error ? e.message : String(e)}`);
      skipped++;
    }
  }

  return { ok: true, created, updated, skipped, errors, details: { totalEvents: data.events.length, year } };
}

/**
 * syncOWGRRankings
 * ----------------
 * Fetches world golf rankings from ESPN's rankings page and updates the Player table.
 * Creates new players if they don't exist. Assigns tiers based on ranking.
 */
export async function syncOWGRRankings(): Promise<SyncResult> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  try {
    const rankings = await fetchESPNRankings();
    if (!rankings || rankings.length === 0) {
      return { ok: false, errors: ["Failed to fetch rankings from ESPN"] };
    }

    // Build name → rank map for existing players
    const existingPlayers = await prisma.player.findMany();
    const nameMap = new Map<string, typeof existingPlayers[number]>();
    for (const p of existingPlayers) {
      nameMap.set(p.name.toLowerCase().trim(), p);
    }

    for (const entry of rankings) {
      const key = entry.name.toLowerCase().trim();
      const existing = nameMap.get(key);

      if (existing) {
        if (existing.dataGolfRank !== entry.rank || (existing.country !== entry.country && entry.country)) {
          await prisma.player.update({
            where: { id: existing.id },
            data: {
              dataGolfRank: entry.rank,
              ...(entry.country ? { country: entry.country } : {}),
            },
          });
          updated++;
        }
      } else {
        await prisma.player.create({
          data: {
            name: entry.name,
            country: entry.country ?? null,
            dataGolfRank: entry.rank,
          },
        });
        created++;
      }
    }

    // Update tournament player tiers based on new rankings
    const tierResult = await recalculateAllTiers();

    return {
      ok: true,
      created,
      updated,
      errors,
      details: {
        totalRanked: rankings.length,
        tiersChanged: tierResult.tiersChanged,
        totalChecked: tierResult.totalChecked,
      },
    };
  } catch (e) {
    return { ok: false, errors: [`Rankings sync failed: ${e instanceof Error ? e.message : String(e)}`] };
  }
}

/**
 * Fetch and parse ESPN golf rankings page.
 */
async function fetchESPNRankings(): Promise<Array<{ rank: number; name: string; country: string | null }>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch("https://www.espn.com/golf/rankings", {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const html = await res.text();
    // Only process the first 500KB to find the rankings table
    const chunk = html.slice(0, 500000);
    return parseESPNRankings(chunk);
  } catch (e) {
    console.error("fetchESPNRankings error:", e);
    return [];
  }
}

/**
 * Parse ESPN rankings HTML to extract rank + name.
 */
function parseESPNRankings(html: string): Array<{ rank: number; name: string; country: string | null }> {
  const players: Array<{ rank: number; name: string; country: string | null }> = [];

  // ESPN rankings page has two tables: rank+name and stats
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(html)) !== null) {
    tables.push(m[1]);
  }

  if (tables.length === 0) return [];

  // First table has rank + name
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tables[0])) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      cells.push(text);
    }

    if (cells.length >= 2) {
      const rank = parseInt(cells[0], 10);
      const name = cells[1];
      if (rank > 0 && rank <= 500 && name && name.length > 2) {
        // Try to extract country flag from the row
        const flagMatch = rowMatch[1].match(/countries\/500\/(\w+)\.png/);
        const country = flagMatch ? flagMatch[1].toUpperCase() : null;
        players.push({ rank, name, country });
      }
    }
  }

  return players;
}

/**
 * Recalculate global rank-band tiers, excluding field-relative Rocket tiers.
 */
export async function recalculateAllTiers(): Promise<{ tiersChanged: number; totalChecked: number }> {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: { not: ROCKET_FIELD_TOURNAMENT_ID } },
    include: { player: { select: { dataGolfRank: true } } },
  });

  let tiersChanged = 0;
  let totalChecked = 0;

  for (const tp of tournamentPlayers) {
    totalChecked++;
    const correctTier = tierForRank(tp.player.dataGolfRank);
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

// ── Shared competitor processing helper ───────────────────────────────────

/**
 * processESPNCompetitors
 * -----------------------
 * Batch-processes ESPN competitors for a tournament: ensures players exist,
 * links them to the tournament, and upserts round scores.
 * Uses minimal DB queries: 2 bulk loads + 1 bulk create for new players +
 * createMany for scores + targeted updates.
 */
async function processESPNCompetitors(
  tournamentId: string,
  competitors: ESPNCompetitor[]
): Promise<{ playersLinked: number; scoresCreated: number; scoresUpdated: number }> {
  let playersLinked = 0;
  let scoresCreated = 0;
  let scoresUpdated = 0;

  // 1. Load all existing players into a map (case-insensitive)
  const existingPlayers = await prisma.player.findMany({ select: { id: true, name: true, country: true, dataGolfRank: true } });
  const playerMap = new Map<string, { id: string; name: string; country: string | null; dataGolfRank: number | null }>();
  for (const p of existingPlayers) {
    playerMap.set(normalizePlayerName(p.name), p);
  }

  // 2. Load existing tournament players and scores in bulk
  const existingTPs = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    select: { playerId: true, tier: true, madeCut: true, withdrew: true },
  });
  const tpMap = new Map<string, { tier: string; madeCut: boolean | null; withdrew: boolean }>();
  for (const tp of existingTPs) {
    tpMap.set(tp.playerId, {
      tier: tp.tier,
      madeCut: tp.madeCut,
      withdrew: tp.withdrew,
    });
  }
  const frozenBeta = await prisma.rocketBetaCampaign.findUnique({
    where: { tournamentId },
    select: { fieldFrozenAt: true },
  }).catch(() => null);
  const fieldIsFrozen = Boolean(frozenBeta?.fieldFrozenAt);

  const existingScores = await prisma.score.findMany({
    where: { tournamentId },
    select: { playerId: true, round: true, strokes: true },
  });
  const scoreMap = new Map<string, number>();
  for (const s of existingScores) scoreMap.set(`${s.playerId}:${s.round}`, s.strokes ?? -1);

  // 3. Process competitors in memory, collect what needs to be created/updated
  const newTPs: Array<{ tournamentId: string; playerId: string; tier: string; madeCut: boolean | null; withdrew: boolean }> = [];
  const tpUpdates: Array<{ playerId: string; tier: string; madeCut: boolean | null; withdrew: boolean }> = [];
  const newScores: Array<{ tournamentId: string; playerId: string; round: number; strokes: number; isEstimated: boolean }> = [];
  const scoreUpdates: Array<{ playerId: string; round: number; strokes: number }> = [];

  const processedNames = new Set<string>();

  for (const comp of competitors) {
    const playerName = comp.athlete?.fullName;
    if (!playerName || playerName.trim().length === 0) continue;

    const key = normalizePlayerName(playerName);
    if (processedNames.has(key)) continue;
    processedNames.add(key);

    const existing = playerMap.get(key);
    const country = countryFromFlag(comp.athlete?.flag);

    let playerId: string;
    let rank: number | null;

    if (existing) {
      playerId = existing.id;
      rank = existing.dataGolfRank;
    } else {
      if (fieldIsFrozen) continue;
      // Create new player immediately
      const created = await prisma.player.create({
        data: { name: playerName, country },
      });
      playerId = created.id;
      rank = null;
      playerMap.set(key, { id: playerId, name: playerName, country, dataGolfRank: null });
    }

    // Determine status. A golfer has not "made the cut" merely by starting;
    // keep the state unknown until ESPN explicitly reports CUT or R3 begins.
    const existingTP = tpMap.get(playerId);
    const statusName = comp.status?.type?.name ?? "";
    const detectedWithdrawal =
      comp.thru === "WD" ||
      statusName === "STATUS_WITHDRAWN" ||
      statusName === "STATUS_WITHDRAWAL";
    const withdrew = existingTP?.withdrew === true || detectedWithdrawal;
    const missedCut = comp.thru === "CUT" || statusName === "STATUS_CUT";
    const reachedRoundThree = (comp.linescores ?? []).some(
      (score) => score.period >= 3 && score.value > 0,
    );
    const madeCut = missedCut
      ? false
      : reachedRoundThree
        ? true
        : existingTP?.madeCut ?? null;
    const rocketFieldManaged = tournamentId === ROCKET_FIELD_TOURNAMENT_ID;
    const tierVal =
      (fieldIsFrozen || rocketFieldManaged) && existingTP
        ? existingTP.tier
        : tierForRank(rank);

    // Check if tournament link exists
    if (!existingTP) {
      if (fieldIsFrozen || rocketFieldManaged) continue;
      newTPs.push({ tournamentId, playerId, tier: tierVal, madeCut, withdrew });
      tpMap.set(playerId, { tier: tierVal, madeCut, withdrew });
      playersLinked++;
    } else {
      // Update if changed
      if (
        existingTP.tier !== tierVal ||
        existingTP.madeCut !== madeCut ||
        existingTP.withdrew !== withdrew
      ) {
        tpUpdates.push({ playerId, tier: tierVal, madeCut, withdrew });
      }
    }

    // Process round scores
    const linescores = comp.linescores ?? [];
    for (const ls of linescores) {
      if (ls.period >= 1 && ls.period <= 4 && ls.value > 0) {
        const round = ls.period;
        const strokes = Math.round(ls.value);
        const scoreKey = `${playerId}:${round}`;
        const existingStrokes = scoreMap.get(scoreKey);

        if (existingStrokes === undefined) {
          // New score
          newScores.push({ tournamentId, playerId, round, strokes, isEstimated: false });
          scoreMap.set(scoreKey, strokes);
          scoresCreated++;
        } else if (existingStrokes !== strokes) {
          // Update existing score
          scoreUpdates.push({ playerId, round, strokes });
          scoreMap.set(scoreKey, strokes);
          scoresUpdated++;
        }
      }
    }
  }

  // 4. Batch write: create new tournament players
  if (newTPs.length > 0) {
    try {
      await prisma.tournamentPlayer.createMany({
        data: newTPs.map(({ tournamentId: tid, playerId, tier, madeCut, withdrew }) => ({
          tournamentId: tid, playerId, tier, madeCut, withdrew,
        })),
        skipDuplicates: true,
      });
    } catch {
      // Fallback to individual creates
      for (const tp of newTPs) {
        try {
          await prisma.tournamentPlayer.create({ data: tp });
        } catch { /* race condition */ }
      }
    }
  }

  // 5. Batch update tournament player tiers/madeCut
  for (const update of tpUpdates) {
    try {
      await prisma.tournamentPlayer.update({
        where: { tournamentId_playerId: { tournamentId, playerId: update.playerId } },
        data: {
          tier: update.tier,
          madeCut: update.madeCut,
          withdrew: update.withdrew,
        },
      });
    } catch { /* ignore */ }
  }

  // 6. Batch create new scores
  if (newScores.length > 0) {
    try {
      await prisma.score.createMany({ data: newScores, skipDuplicates: true });
    } catch {
      // Fallback
      for (const s of newScores) {
        try { await prisma.score.create({ data: s }); } catch { /* race */ }
      }
    }
  }

  // 7. Batch update scores
  for (const update of scoreUpdates) {
    try {
      await prisma.score.update({
        where: { tournamentId_playerId_round: { tournamentId, playerId: update.playerId, round: update.round } },
        data: { strokes: update.strokes, isEstimated: false },
      });
    } catch { /* ignore */ }
  }

  return { playersLinked, scoresCreated, scoresUpdated };
}

// ── Tournament Results Sync ────────────────────────────────────────────────

/**
 * syncTournamentResults
 * ---------------------
 * For a completed tournament, pulls real scores from ESPN and stores them.
 * Also links players to the tournament if not already linked.
 *
 * @param tournamentId  The DB tournament ID (slug)
 */
export async function syncTournamentResults(tournamentId?: string): Promise<SyncResult> {
  const errors: string[] = [];
  let totalScoresCreated = 0;
  let totalScoresUpdated = 0;
  let totalPlayersLinked = 0;
  let tournamentsProcessed = 0;

  // Determine which tournaments to sync
  let tournaments: Array<{ id: string; name: string; startDate: Date; endDate: Date; status: string }>;

  if (tournamentId) {
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return { ok: false, errors: [`Tournament not found: ${tournamentId}`] };
    tournaments = [t];
  } else {
    // All completed tournaments
    tournaments = await prisma.tournament.findMany({
      where: { status: "completed" },
    });
  }

  for (const tournament of tournaments) {
    try {
      // Format dates for ESPN API
      const startDate = tournament.startDate.toISOString().slice(0, 10).replace(/-/g, "");
      const endDate = tournament.endDate.toISOString().slice(0, 10).replace(/-/g, "");
      const dateRange = `${startDate}-${endDate}`;

      const data = await fetchScoreboard(dateRange);
      if (!data || !data.events) {
        errors.push(`No ESPN data for "${tournament.name}" (${dateRange})`);
        continue;
      }

      // Find the matching event using alias-aware helper
      const meta = getTournamentMeta(tournament.name);
      const matchingEvent = findMatchingESPNEvent(data.events, tournament.name, meta);

      if (!matchingEvent) {
        errors.push(`No matching ESPN event for "${tournament.name}"`);
        continue;
      }

      const competitors = matchingEvent.competitions?.[0]?.competitors ?? [];

      // Process all competitors using batch helper
      const result = await processESPNCompetitors(tournament.id, competitors);
      totalPlayersLinked += result.playersLinked;
      totalScoresCreated += result.scoresCreated;
      totalScoresUpdated += result.scoresUpdated;
      await recalculateTeamScores(tournament.id);

      tournamentsProcessed++;
    } catch (e) {
      errors.push(`Error syncing "${tournament.name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: true,
    created: totalScoresCreated,
    updated: totalScoresUpdated,
    details: {
      tournamentsProcessed,
      playersLinked: totalPlayersLinked,
      scoresCreated: totalScoresCreated,
      scoresUpdated: totalScoresUpdated,
    },
    errors,
  };
}

// ── Live Scores Sync ───────────────────────────────────────────────────────

/**
 * syncLiveScores
 * --------------
 * For any in-progress tournament, pulls current round scores from ESPN.
 *
 * @param tournamentId  Optional: specific tournament to sync. If omitted, syncs all in_progress.
 */
export async function syncLiveScores(tournamentId?: string): Promise<SyncResult> {
  const errors: string[] = [];
  let totalScoresCreated = 0;
  let totalScoresUpdated = 0;
  let tournamentsProcessed = 0;
  let substitutionsProcessed = 0;

  let tournaments: Array<{ id: string; name: string; startDate: Date; endDate: Date }>;

  if (tournamentId) {
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) return { ok: false, errors: [`Tournament not found: ${tournamentId}`] };
    tournaments = [t];
  } else {
    tournaments = await prisma.tournament.findMany({
      where: { status: "in_progress" },
    });
  }

  if (tournaments.length === 0) {
    return { ok: true, skipped: 0, details: { message: "No in-progress tournaments to sync" } };
  }

  for (const tournament of tournaments) {
    try {
      const startDate = tournament.startDate.toISOString().slice(0, 10).replace(/-/g, "");
      const endDate = tournament.endDate.toISOString().slice(0, 10).replace(/-/g, "");
      const dateRange = `${startDate}-${endDate}`;

      const data = await fetchScoreboard(dateRange);
      if (!data || !data.events) {
        errors.push(`No ESPN data for "${tournament.name}"`);
        continue;
      }

      // Find matching event using alias-aware helper
      const meta = getTournamentMeta(tournament.name);
      const matchingEvent = findMatchingESPNEvent(data.events, tournament.name, meta);

      if (!matchingEvent) {
        errors.push(`No matching ESPN event for "${tournament.name}"`);
        continue;
      }

      const competitors = matchingEvent.competitions?.[0]?.competitors ?? [];
      const competition = matchingEvent.competitions?.[0];
      const espnCurrentRound = competition?.status?.period ?? 0;
      const liveState = deriveLiveTournamentState({
        eventState:
          matchingEvent.status?.type?.state ??
          competition?.status?.type?.state,
        completed:
          matchingEvent.status?.type?.completed === true ||
          competition?.status?.type?.completed === true,
        currentRound: espnCurrentRound,
      });

      // Keep the public event lifecycle aligned with ESPN while scores arrive.
      if (liveState) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: liveState,
        });
      }

      // Process all competitors using batch helper
      const result = await processESPNCompetitors(tournament.id, competitors);
      totalScoresCreated += result.scoresCreated;
      totalScoresUpdated += result.scoresUpdated;
      const substitutions = await processAutoSubs(tournament.id);
      substitutionsProcessed += substitutions.subsProcessed;
      if (espnCurrentRound >= 3) {
        await applyCutLogic(tournament.id);
      }
      await recalculateTeamScores(tournament.id);

      tournamentsProcessed++;
    } catch (e) {
      errors.push(`Error syncing live scores for "${tournament.name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: true,
    created: totalScoresCreated,
    updated: totalScoresUpdated,
    details: { tournamentsProcessed, substitutionsProcessed },
    errors,
  };
}

// ── Cleanup old year-suffixed tournaments ─────────────────────────────────

/**
 * cleanupYearBranding
 * ---------------------
 * Removes year suffixes from tournament names and IDs in the database.
 * Merges data from old IDs (e.g. "the-open-2026") into clean IDs (e.g. "the-open").
 */
export async function cleanupYearBranding(): Promise<SyncResult> {
  const errors: string[] = [];
  let updated = 0;
  let merged = 0;

  const tournaments = await prisma.tournament.findMany();

  for (const t of tournaments) {
    const hasYearId = /-20\d{2}$/.test(t.id);
    const hasYearName = /\s+20\d{2}$/.test(t.name);

    if (!hasYearId && hasYearName) {
      // Just update the name
      const cleanName = t.name.replace(/\s+20\d{2}$/, "");
      await prisma.tournament.update({ where: { id: t.id }, data: { name: cleanName } });
      updated++;
    } else if (hasYearId) {
      // Need to merge into clean ID
      const cleanId = t.id.replace(/-20\d{2}$/, "");
      const cleanName = t.name.replace(/\s+20\d{2}$/, "");

      // Check if clean tournament exists
      const existing = await prisma.tournament.findUnique({ where: { id: cleanId } });

      if (existing) {
        // Clean tournament already exists (from sync). Just delete the old one.
        // Scores and TPs on the clean tournament are already correct from sync.
        try {
          // First delete related records from the old tournament (order matters for FK constraints)
          await prisma.teamSelection.deleteMany({
            where: { team: { tournamentId: t.id } },
          });
          await prisma.score.deleteMany({ where: { tournamentId: t.id } });
          await prisma.tournamentPlayer.deleteMany({ where: { tournamentId: t.id } });
          await prisma.team.deleteMany({ where: { tournamentId: t.id } });
          await prisma.broadcastMessage.deleteMany({ where: { tournamentId: t.id } });
          await prisma.sideBet.deleteMany({ where: { tournamentId: t.id } });
          await prisma.tournamentSidePot.deleteMany({ where: { tournamentId: t.id } });
          await prisma.tournament.delete({ where: { id: t.id } });
          merged++;
        } catch (e) {
          errors.push(`Failed to delete old ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        // Rename: update ID directly via raw SQL (Prisma can't update ID field directly)
        try {
          await prisma.$executeRaw`UPDATE "Tournament" SET id = ${cleanId}, name = ${cleanName} WHERE id = ${t.id}`;
          updated++;
        } catch (e) {
          errors.push(`Failed to rename ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  return { ok: true, updated, details: { merged, total: tournaments.length }, errors };
}

// ── Static course data for venue fixes ─────────────────────────────────────

/**
 * Static course data for PGA Tour events that commonly show "TBD" or null.
 * Used by fixVenues() to backfill missing course, yardage, architect, location.
 * Keyed by tournament slug.
 */
const STATIC_COURSE_DATA: Record<string, {
  course: string;
  yardage?: number;
  architect?: string;
  courseLocation?: string;
}> = {
  // Majors
  "masters": { course: "Augusta National Golf Club", yardage: 7545, architect: "Bobby Jones / Alister MacKenzie", courseLocation: "Augusta, Georgia" },
  "pga-championship": { course: "Quail Hollow Club", yardage: 7600, architect: "George Cobb", courseLocation: "Charlotte, North Carolina" },
  "us-open": { course: "Oakmont Country Club", yardage: 7372, architect: "Henry Fownes", courseLocation: "Oakmont, Pennsylvania" },
  "the-open": { course: "Royal Birkdale Golf Club", yardage: 7133, architect: "George Lowe / Fred Hawtree", courseLocation: "Southport, England" },

  // Signature events
  "players-championship": { course: "TPC Sawgrass (Stadium Course)", yardage: 7275, architect: "Pete Dye", courseLocation: "Ponte Vedra Beach, Florida" },
  "genesis-invitational": { course: "Riviera Country Club", yardage: 7322, architect: "George C. Thomas", courseLocation: "Pacific Palisades, California" },
  "arnold-palmer-invitational": { course: "Bay Hill Golf Club", yardage: 7466, architect: "Dick Wilson / Arnold Palmer", courseLocation: "Orlando, Florida" },
  "memorial-tournament": { course: "Muirfield Village Golf Club", yardage: 7392, architect: "Jack Nicklaus", courseLocation: "Dublin, Ohio" },

  // Playoffs
  "tour-championship": { course: "East Lake Golf Club", yardage: 7419, architect: "Donald Ross", courseLocation: "Atlanta, Georgia" },
  "fedex-st-jude-championship": { course: "TPC Southwind", yardage: 7244, architect: "Ron Prichard", courseLocation: "Memphis, Tennessee" },
  "bmw-championship": { course: "Castle Pines Golf Club", yardage: 7642, architect: "Jack Nicklaus", courseLocation: "Castle Rock, Colorado" },

  // Regular PGA Tour events — the ones that commonly show TBD
  "att-pebble-beach-pro-am": { course: "Pebble Beach Golf Links", yardage: 6964, architect: "Jack Neville / Douglas Grant", courseLocation: "Pebble Beach, California" },
  "puerto-rico-open": { course: "Grand Reserve Golf Club", yardage: 7508, architect: "Rees Jones", courseLocation: "Rio Grande, Puerto Rico" },
  "texas-childrens-houston-open": { course: "Memorial Park Golf Course", yardage: 7432, architect: "John Bredemus / Tom Doak", courseLocation: "Houston, Texas" },
  "masters-tournament": { course: "Augusta National Golf Club", yardage: 7545, architect: "Bobby Jones / Alister MacKenzie", courseLocation: "Augusta, Georgia" },

  // Additional common events
  "wells-fargo-championship": { course: "Quail Hollow Club", yardage: 7600, architect: "George Cobb", courseLocation: "Charlotte, North Carolina" },
  "byron-nelson": { course: "TPC Craig Ranch", yardage: 7468, architect: "Tom Weiskopf", courseLocation: "McKinney, Texas" },
  "att-byron-nelson": { course: "TPC Craig Ranch", yardage: 7468, architect: "Tom Weiskopf", courseLocation: "McKinney, Texas" },
  "mexico-open": { course: "Vidanta Vallarta", yardage: 7536, architect: "Greg Norman", courseLocation: "Nuevo Vallarta, Mexico" },
  "rocket-mortgage-classic": { course: "Detroit Golf Club", yardage: 7370, architect: "Donald Ross", courseLocation: "Detroit, Michigan" },
  "charles-schwab-challenge": { course: "Colonial Country Club", yardage: 7209, architect: "John Bredemus / Perry Maxwell", courseLocation: "Fort Worth, Texas" },
  "farmers-insurance-open": { course: "Torrey Pines Golf Course (South)", yardage: 7702, architect: "William P. Bell / Rees Jones", courseLocation: "La Jolla, California" },
  "sony-open-in-hawaii": { course: "Waialae Country Club", yardage: 7044, architect: "Seth Raynor", courseLocation: "Honolulu, Hawaii" },
  "american-express": { course: "PGA West (Stadium Course)", yardage: 7187, architect: "Pete Dye", courseLocation: "La Quinta, California" },
  "wm-phoenix-open": { course: "TPC Scottsdale (Stadium Course)", yardage: 7261, architect: "Jay Morrish / Tom Weiskopf", courseLocation: "Scottsdale, Arizona" },
  "cognizant-classic": { course: "PGA National Resort (Champion Course)", yardage: 7147, architect: "Jack Nicklaus", courseLocation: "Palm Beach Gardens, Florida" },
  "Valspar Championship": { course: "Innisbrook Resort (Copperhead)", yardage: 7340, architect: "Larry Packard", courseLocation: "Palm Harbor, Florida" },
  "valspar-championship": { course: "Innisbrook Resort (Copperhead)", yardage: 7340, architect: "Larry Packard", courseLocation: "Palm Harbor, Florida" },
  "RBC Heritage": { course: "Harbour Town Golf Links", yardage: 7121, architect: "Pete Dye / Jack Nicklaus", courseLocation: "Hilton Head Island, South Carolina" },
  "rbc-heritage": { course: "Harbour Town Golf Links", yardage: 7121, architect: "Pete Dye / Jack Nicklaus", courseLocation: "Hilton Head Island, South Carolina" },
  "Zurich Classic": { course: "TPC Louisiana", yardage: 7399, architect: "Pete Dye", courseLocation: "Avondale, Louisiana" },
  "zurich-classic": { course: "TPC Louisiana", yardage: 7399, architect: "Pete Dye", courseLocation: "Avondale, Louisiana" },
  "HP Byron Nelson Championship": { course: "TPC Four Seasons", yardage: 7114, architect: "Jay Morrish", courseLocation: "Irving, Texas" },

  // Women's majors
  "chevron-championship": { course: "The Club at Carlton Woods", yardage: 6745, architect: "Jack Nicklaus", courseLocation: "The Woodlands, Texas" },
  "kpmg-womens-pga-championship": { course: "Sahalee Country Club", yardage: 6799, architect: "Rees Jones / Ted Robinson", courseLocation: "Sammamish, Washington" },
  "us-womens-open": { course: "Lancaster Country Club", yardage: 6775, architect: "William Flynn", courseLocation: "Lancaster, Pennsylvania" },
};

/**
 * fixVenues
 * ---------
 * Backfills missing course names, yardage, architect, and course location
 * for tournaments that have null/TBD course data, using the static course map.
 */
export async function fixVenues(): Promise<SyncResult> {
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;

  const tournaments = await prisma.tournament.findMany();

  for (const t of tournaments) {
    const meta = getTournamentMeta(t.name);
    const courseData = STATIC_COURSE_DATA[t.id] ?? STATIC_COURSE_DATA[meta.slug];

    if (!courseData) {
      skipped++;
      continue;
    }

    // Build update object for fields that are missing or TBD
    const updateData: Record<string, unknown> = {};

    if (!t.course || t.course === "TBD" || t.course.trim() === "") {
      updateData.course = courseData.course;
    }

    if (t.yardage == null && courseData.yardage != null) {
      updateData.yardage = courseData.yardage;
    }
    if (t.architect == null && courseData.architect) {
      updateData.architect = courseData.architect;
    }
    if (t.courseLocation == null && courseData.courseLocation) {
      updateData.courseLocation = courseData.courseLocation;
    }

    if (Object.keys(updateData).length === 0) {
      skipped++;
      continue;
    }

    try {
      await prisma.tournament.update({
        where: { id: t.id },
        data: updateData,
      });
      updated++;
    } catch (e) {
      errors.push(`Failed to update venue for "${t.name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { ok: true, updated, skipped, errors };
}

// ── Link All Players to Tournaments ────────────────────────────────────────

/**
 * linkPlayersToTournaments
 * ------------------------
 * For each tournament, ensure all ranked players are linked as TournamentPlayer
 * records with appropriate tiers. This should be called after rankings sync.
 */
export async function linkPlayersToTournaments(): Promise<SyncResult> {
  let totalLinked = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  const tournaments = await prisma.tournament.findMany({
    where: {
      status: { in: ["upcoming", "entries_open"] },
      id: { not: "rocket-classic" },
    },
  });
  const players = await prisma.player.findMany({
    where: { dataGolfRank: { not: null } },
  });

  for (const tournament of tournaments) {
    for (const player of players) {
      try {
        // Use upsert to handle existing records gracefully
        await prisma.tournamentPlayer.upsert({
          where: {
            tournamentId_playerId: {
              tournamentId: tournament.id,
              playerId: player.id,
            },
          },
          create: {
            tournamentId: tournament.id,
            playerId: player.id,
            tier: tierForRank(player.dataGolfRank),
            madeCut: null,
          },
          update: {
            tier: tierForRank(player.dataGolfRank),
          },
        });
        totalLinked++;
      } catch {
        // Ignore unique constraint violations (race conditions)
        totalSkipped++;
      }
    }
  }

  return {
    ok: true,
    created: totalLinked,
    skipped: totalSkipped,
    details: { tournaments: tournaments.length, players: players.length },
    errors,
  };
}

function normalizePlayerName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
