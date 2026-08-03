import { createHash } from "node:crypto";
import type { TeamScoreResult } from "@/lib/scoring";

export interface FinalizableTeam {
  teamId: string;
  teamName: string;
  ownerName: string;
  position: number;
  totalStrokes: number;
  vsPar: number;
  roundsScored: number;
  estimatedRounds: number;
}

export interface RocketFinalResultTeam extends FinalizableTeam {
  tied: boolean;
}

export interface RocketFinalResultV2 {
  version: "rocket-beta-result-v2";
  scoringPolicy: "relative-to-par-with-cut-and-withdrawal-estimates-v2";
  tournamentId: string;
  fieldVersion: string | null;
  fieldHash: string;
  finalizedAt: string;
  teams: RocketFinalResultTeam[];
}

export type RocketFinalResultVerification =
  | {
      ok: true;
      result: RocketFinalResultV2;
      resultsHash: string;
      winners: RocketFinalResultTeam[];
    }
  | { ok: false; issue: string };

export function buildRocketFinalResult(input: {
  tournamentId: string;
  fieldVersion: string | null;
  fieldHash: string;
  finalizedAt: string;
  teams: FinalizableTeam[];
}) {
  const result: RocketFinalResultV2 = {
    version: "rocket-beta-result-v2",
    scoringPolicy: "relative-to-par-with-cut-and-withdrawal-estimates-v2",
    tournamentId: input.tournamentId,
    fieldVersion: input.fieldVersion,
    fieldHash: input.fieldHash,
    finalizedAt: input.finalizedAt,
    teams: input.teams.map((team) => ({
      ...team,
      tied:
        input.teams.filter((candidate) => candidate.position === team.position)
          .length > 1,
    })),
  };
  return {
    result,
    resultsHash: hashRocketFinalResult(result),
  };
}

export function verifyRocketFinalResult(input: {
  value: unknown;
  expectedHash: string | null | undefined;
  expectedTournamentId: string;
}): RocketFinalResultVerification {
  if (!input.expectedHash || !/^[a-f0-9]{64}$/.test(input.expectedHash)) {
    return { ok: false, issue: "Sealed result hash is missing or malformed" };
  }
  const record = objectValue(input.value);
  if (!record || record.version !== "rocket-beta-result-v2") {
    return { ok: false, issue: "Sealed result payload is missing or unsupported" };
  }
  if (
    record.scoringPolicy !==
      "relative-to-par-with-cut-and-withdrawal-estimates-v2" ||
    record.tournamentId !== input.expectedTournamentId ||
    typeof record.fieldHash !== "string" ||
    !record.fieldHash ||
    (typeof record.fieldVersion !== "string" && record.fieldVersion !== null) ||
    typeof record.finalizedAt !== "string" ||
    !Number.isFinite(Date.parse(record.finalizedAt)) ||
    !Array.isArray(record.teams) ||
    record.teams.length === 0
  ) {
    return { ok: false, issue: "Sealed result payload failed integrity validation" };
  }

  const teams: RocketFinalResultTeam[] = [];
  const teamIds = new Set<string>();
  for (const value of record.teams) {
    const team = parseTeam(value);
    if (!team || teamIds.has(team.teamId)) {
      return { ok: false, issue: "Sealed result contains an invalid team row" };
    }
    teamIds.add(team.teamId);
    teams.push(team);
  }

  const result: RocketFinalResultV2 = {
    version: "rocket-beta-result-v2",
    scoringPolicy: "relative-to-par-with-cut-and-withdrawal-estimates-v2",
    tournamentId: input.expectedTournamentId,
    fieldVersion: record.fieldVersion,
    fieldHash: record.fieldHash,
    finalizedAt: record.finalizedAt,
    teams,
  };
  if (!validTieState(teams) || hashRocketFinalResult(result) !== input.expectedHash) {
    return { ok: false, issue: "Sealed result hash verification failed" };
  }
  const winners = teams.filter((team) => team.position === 1);
  if (winners.length === 0) {
    return { ok: false, issue: "Sealed result contains no winner" };
  }
  return { ok: true, result, resultsHash: input.expectedHash, winners };
}

export function hashRocketFinalResult(result: RocketFinalResultV2): string {
  return createHash("sha256").update(JSON.stringify(result)).digest("hex");
}

export function overlayRocketFinalLeaderboard(
  liveTeams: readonly TeamScoreResult[],
  result: RocketFinalResultV2,
): TeamScoreResult[] {
  const liveById = new Map(liveTeams.map((team) => [team.teamId, team]));
  return result.teams.map((sealed) => {
    const live = liveById.get(sealed.teamId);
    return {
      teamId: sealed.teamId,
      teamName: sealed.teamName,
      ownerName: sealed.ownerName,
      players: live?.players ?? [],
      totalStrokes: sealed.totalStrokes,
      vsPar: sealed.vsPar,
      roundsScored: sealed.roundsScored,
      scoreState: "FINAL",
      position: sealed.position,
    };
  });
}

export function rocketFinalResultMatchesLiveLeaderboard(
  liveTeams: readonly TeamScoreResult[],
  result: RocketFinalResultV2,
) {
  if (liveTeams.length !== result.teams.length) return false;
  const liveById = new Map(liveTeams.map((team) => [team.teamId, team]));
  return result.teams.every((sealed) => {
    const live = liveById.get(sealed.teamId);
    if (!live) return false;
    const estimatedRounds = live.players.reduce(
      (total, player) =>
        total + player.isEstimated.filter((estimated) => estimated).length,
      0,
    );
    return (
      live.teamName === sealed.teamName &&
      live.ownerName === sealed.ownerName &&
      live.position === sealed.position &&
      live.totalStrokes === sealed.totalStrokes &&
      live.vsPar === sealed.vsPar &&
      live.roundsScored === sealed.roundsScored &&
      estimatedRounds === sealed.estimatedRounds
    );
  });
}

function parseTeam(value: unknown): RocketFinalResultTeam | null {
  const team = objectValue(value);
  if (
    !team ||
    typeof team.teamId !== "string" ||
    !team.teamId ||
    typeof team.teamName !== "string" ||
    !team.teamName ||
    typeof team.ownerName !== "string" ||
    !team.ownerName ||
    !positiveInteger(team.position) ||
    !finiteNumber(team.totalStrokes) ||
    !finiteNumber(team.vsPar) ||
    team.roundsScored !== 20 ||
    !integerInRange(team.estimatedRounds, 0, 20) ||
    typeof team.tied !== "boolean"
  ) {
    return null;
  }
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    ownerName: team.ownerName,
    position: team.position,
    totalStrokes: team.totalStrokes,
    vsPar: team.vsPar,
    roundsScored: 20,
    estimatedRounds: team.estimatedRounds,
    tied: team.tied,
  };
}

function validTieState(teams: RocketFinalResultTeam[]) {
  return teams.every(
    (team) =>
      team.tied ===
      (teams.filter((candidate) => candidate.position === team.position).length >
        1),
  );
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveInteger(value: unknown): value is number {
  return finiteNumber(value) && Number.isInteger(value) && value >= 1;
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    finiteNumber(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
