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

async function fetchESPN(path: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(`https://site.api.espn.com${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.json();
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
  return fetchESPN(`/apis/site/v2/sports/golf/pga/scoreboard?dates=${dateRange}`);
}

// ── Tier helper ────────────────────────────────────────────────────────────

export function tierForRank(rank: number | null | undefined): string {
  if (rank == null) return "T51_PLUS";
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
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch("https://www.espn.com/golf/rankings", {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const html = await res.text();
    return parseESPNRankings(html);
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
 * Recalculate tier assignments for all TournamentPlayer records.
 */
async function recalculateAllTiers(): Promise<{ tiersChanged: number; totalChecked: number }> {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
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

      // Find the matching event by name
      const meta = getTournamentMeta(tournament.name);
      const matchingEvent = data.events.find(
        (e) =>
          e.name === tournament.name ||
          e.name.includes(tournament.name) ||
          tournament.name.includes(e.name) ||
          getTournamentMeta(e.name).slug === meta.slug
      );

      if (!matchingEvent) {
        errors.push(`No matching ESPN event for "${tournament.name}"`);
        continue;
      }

      const competitors = matchingEvent.competitions?.[0]?.competitors ?? [];

      // Process each competitor
      for (const comp of competitors) {
        const playerName = comp.athlete?.fullName;
        if (!playerName) continue;

        // Find or create the player
        let player = await prisma.player.findFirst({
          where: { name: { equals: playerName, mode: "insensitive" } },
        });

        if (!player) {
          player = await prisma.player.create({
            data: {
              name: playerName,
              country: countryFromFlag(comp.athlete?.flag),
            },
          });
        }

        // Link player to tournament
        let tournamentPlayer = await prisma.tournamentPlayer.findUnique({
          where: {
            tournamentId_playerId: {
              tournamentId: tournament.id,
              playerId: player.id,
            },
          },
        });

        if (!tournamentPlayer) {
          tournamentPlayer = await prisma.tournamentPlayer.create({
            data: {
              tournamentId: tournament.id,
              playerId: player.id,
              tier: tierForRank(player.dataGolfRank),
              madeCut: comp.status?.type?.name !== "STATUS_CUT",
            },
          });
          totalPlayersLinked++;
        } else {
          // Update madeCut
          const madeCut = comp.status?.type?.name !== "STATUS_CUT" && comp.thru !== "CUT";
          if (tournamentPlayer.madeCut !== madeCut) {
            await prisma.tournamentPlayer.update({
              where: { id: tournamentPlayer.id },
              data: { madeCut },
            });
          }
        }

        // Process round scores from linescores
        const linescores = comp.linescores ?? [];
        for (const ls of linescores) {
          if (ls.period >= 1 && ls.period <= 4 && ls.value > 0) {
            const round = ls.period;
            const strokes = Math.round(ls.value);

            const existingScore = await prisma.score.findUnique({
              where: {
                tournamentId_playerId_round: {
                  tournamentId: tournament.id,
                  playerId: player.id,
                  round,
                },
              },
            });

            if (existingScore) {
              if (existingScore.strokes !== strokes) {
                await prisma.score.update({
                  where: { id: existingScore.id },
                  data: { strokes, isEstimated: false },
                });
                totalScoresUpdated++;
              }
            } else {
              await prisma.score.create({
                data: {
                  tournamentId: tournament.id,
                  playerId: player.id,
                  round,
                  strokes,
                  isEstimated: false,
                },
              });
              totalScoresCreated++;
            }
          }
        }
      }

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

      // Find matching event
      const meta = getTournamentMeta(tournament.name);
      const matchingEvent = data.events.find(
        (e) =>
          e.name === tournament.name ||
          e.name.includes(tournament.name) ||
          tournament.name.includes(e.name) ||
          getTournamentMeta(e.name).slug === meta.slug
      );

      if (!matchingEvent) {
        errors.push(`No matching ESPN event for "${tournament.name}"`);
        continue;
      }

      const competitors = matchingEvent.competitions?.[0]?.competitors ?? [];
      const espnCurrentRound = matchingEvent.competitions?.[0]?.status?.period ?? 0;

      // Update current round on tournament
      if (espnCurrentRound > 0) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { currentRound: espnCurrentRound },
        });
      }

      for (const comp of competitors) {
        const playerName = comp.athlete?.fullName;
        if (!playerName) continue;

        let player = await prisma.player.findFirst({
          where: { name: { equals: playerName, mode: "insensitive" } },
        });

        if (!player) {
          player = await prisma.player.create({
            data: {
              name: playerName,
              country: countryFromFlag(comp.athlete?.flag),
            },
          });
        }

        // Ensure tournament link
        let tournamentPlayer = await prisma.tournamentPlayer.findUnique({
          where: {
            tournamentId_playerId: {
              tournamentId: tournament.id,
              playerId: player.id,
            },
          },
        });

        if (!tournamentPlayer) {
          tournamentPlayer = await prisma.tournamentPlayer.create({
            data: {
              tournamentId: tournament.id,
              playerId: player.id,
              tier: tierForRank(player.dataGolfRank),
              madeCut: comp.thru !== "CUT",
            },
          });
        }

        // Process round scores
        const linescores = comp.linescores ?? [];
        for (const ls of linescores) {
          if (ls.period >= 1 && ls.period <= 4 && ls.value > 0) {
            const round = ls.period;
            const strokes = Math.round(ls.value);

            const existingScore = await prisma.score.findUnique({
              where: {
                tournamentId_playerId_round: {
                  tournamentId: tournament.id,
                  playerId: player.id,
                  round,
                },
              },
            });

            if (existingScore) {
              if (existingScore.strokes !== strokes) {
                await prisma.score.update({
                  where: { id: existingScore.id },
                  data: { strokes, isEstimated: false },
                });
                totalScoresUpdated++;
              }
            } else {
              await prisma.score.create({
                data: {
                  tournamentId: tournament.id,
                  playerId: player.id,
                  round,
                  strokes,
                  isEstimated: false,
                },
              });
              totalScoresCreated++;
            }
          }
        }
      }

      tournamentsProcessed++;
    } catch (e) {
      errors.push(`Error syncing live scores for "${tournament.name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: true,
    created: totalScoresCreated,
    updated: totalScoresUpdated,
    details: { tournamentsProcessed },
    errors,
  };
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
  let errors: string[] = [];

  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["upcoming", "entries_open"] } },
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
      } catch (e) {
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
