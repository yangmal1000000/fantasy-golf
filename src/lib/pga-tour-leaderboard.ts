import { createHash } from "node:crypto";

export interface PgaTourPlayerRow {
  name: string;
  position: string;
  playerState: string;
  rounds: (number | null)[];
  withdrew: boolean;
  disqualified: boolean;
  madeCut: boolean | null;
}

export interface PgaTourLeaderboardEvidence {
  leaderboardId: string;
  tournamentStatus: string;
  sourceUrl: string;
  players: PgaTourPlayerRow[];
}

export interface PgaTourEvidenceAssessment {
  ok: boolean;
  finalizationReady: boolean;
  fieldPlayers: number;
  officialPlayers: number;
  matchedFieldPlayers: number;
  requiredMatches: number;
  evidenceHash: string;
  errors: string[];
}

type JsonRecord = Record<string, unknown>;

/**
 * Parse PGA TOUR's public Next.js payload. The leaderboard page includes the
 * same LeaderboardV3 data used to render the official table, so this gives us
 * a deterministic fallback when ESPN omits WD/DNS state.
 */
export function parsePgaTourLeaderboardHtml(
  html: string,
  expectedLeaderboardId: string,
  sourceUrl: string,
): PgaTourLeaderboardEvidence {
  const script = html.match(
    /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!script) {
    throw new Error("PGA TOUR page did not contain __NEXT_DATA__");
  }

  const root = JSON.parse(script) as JsonRecord;
  const pageProps = record(record(root.props)?.pageProps);
  const dehydratedState = record(pageProps?.dehydratedState);
  const queries = Array.isArray(dehydratedState?.queries)
    ? dehydratedState.queries
    : [];
  const leaderboard = queries
    .map((query) => record(record(record(query)?.state)?.data))
    .find((data) => data?.__typename === "LeaderboardV3");

  if (!leaderboard) {
    throw new Error("PGA TOUR page did not contain LeaderboardV3 data");
  }
  if (leaderboard.id !== expectedLeaderboardId) {
    throw new Error(
      `PGA TOUR leaderboard mismatch: expected ${expectedLeaderboardId}`,
    );
  }

  const rawPlayers = Array.isArray(leaderboard.players)
    ? leaderboard.players
    : [];
  const players = rawPlayers.flatMap((raw): PgaTourPlayerRow[] => {
    const row = record(raw);
    if (row?.__typename !== "PlayerRowV3") return [];
    const player = record(row.player);
    const scoring = record(row.scoringData);
    const name = stringValue(player?.displayName);
    if (!name || !scoring) return [];

    const position = stringValue(scoring.position).toUpperCase();
    const playerState = stringValue(scoring.playerState).toUpperCase();
    const rawRounds = Array.isArray(scoring.rounds) ? scoring.rounds : [];
    const rounds = [0, 1, 2, 3].map((index) => parseRound(rawRounds[index]));
    const disqualified =
      playerState === "DISQUALIFIED" || position === "DQ";
    const withdrew =
      playerState === "WITHDRAWN" ||
      position === "WD" ||
      position === "W/D" ||
      position === "DNS";
    const madeCut =
      position === "CUT"
        ? false
        : rounds[2] !== null || rounds[3] !== null
          ? true
          : null;

    return [
      {
        name,
        position,
        playerState,
        rounds,
        withdrew,
        disqualified,
        madeCut,
      },
    ];
  });

  if (players.length === 0) {
    throw new Error("PGA TOUR leaderboard contained no player rows");
  }

  return {
    leaderboardId: expectedLeaderboardId,
    tournamentStatus: stringValue(leaderboard.tournamentStatus).toUpperCase(),
    sourceUrl,
    players,
  };
}

export function assessPgaTourLeaderboardEvidence(input: {
  evidence: PgaTourLeaderboardEvidence;
  fieldPlayerNames: readonly string[];
}): PgaTourEvidenceAssessment {
  const officialNames = new Set(
    input.evidence.players.map((player) => normalizeGolfPlayerName(player.name)),
  );
  const fieldNames = new Set(
    input.fieldPlayerNames.map((name) => normalizeGolfPlayerName(name)),
  );
  const matchedFieldPlayers = [...fieldNames].filter((name) =>
    officialNames.has(name),
  ).length;
  const allowedMissing = Math.min(5, Math.floor(fieldNames.size * 0.05));
  const requiredMatches = Math.max(1, fieldNames.size - allowedMissing);
  const errors: string[] = [];
  if (fieldNames.size === 0) errors.push("Frozen tournament field is empty");
  if (matchedFieldPlayers < requiredMatches) {
    errors.push(
      `Official leaderboard matched ${matchedFieldPlayers}/${fieldNames.size} field players; ${requiredMatches} required`,
    );
  }
  if (officialNames.size < requiredMatches) {
    errors.push(
      `Official leaderboard contained ${officialNames.size} unique players; ${requiredMatches} required`,
    );
  }
  const ok = errors.length === 0;
  return {
    ok,
    finalizationReady:
      ok && input.evidence.tournamentStatus === "COMPLETED",
    fieldPlayers: fieldNames.size,
    officialPlayers: officialNames.size,
    matchedFieldPlayers,
    requiredMatches,
    evidenceHash: hashPgaTourLeaderboardEvidence(input.evidence),
    errors,
  };
}

export function hashPgaTourLeaderboardEvidence(
  evidence: PgaTourLeaderboardEvidence,
): string {
  const canonical = {
    leaderboardId: evidence.leaderboardId,
    tournamentStatus: evidence.tournamentStatus,
    sourceUrl: evidence.sourceUrl,
    players: [...evidence.players]
      .map((player) => ({
        name: normalizeGolfPlayerName(player.name),
        position: player.position,
        playerState: player.playerState,
        rounds: player.rounds,
        withdrew: player.withdrew,
        disqualified: player.disqualified,
        madeCut: player.madeCut,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export async function fetchPgaTourLeaderboard(
  input: {
    leaderboardId: string;
    sourceUrl: string;
  },
): Promise<PgaTourLeaderboardEvidence> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(input.sourceUrl, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; FantasyGolfSync/1.0)",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`PGA TOUR leaderboard returned HTTP ${response.status}`);
    }
    return parsePgaTourLeaderboardHtml(
      await response.text(),
      input.leaderboardId,
      input.sourceUrl,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeGolfPlayerName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐðÐ]/g, "d")
    .replace(/[þÞ]/g, "th")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function parseRound(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
