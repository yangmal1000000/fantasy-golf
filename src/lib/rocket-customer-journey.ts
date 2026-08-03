import type {
  RocketFinalResultTeam,
  RocketFinalResultV2,
} from "@/lib/rocket-finalization-core";

export interface RocketFinalRecap {
  teamCount: number;
  winners: RocketFinalResultTeam[];
  winnerScore: string;
  personalTeam: RocketFinalResultTeam | null;
  personalPlacement: string | null;
  personalScore: string | null;
  shotsFromLead: number | null;
}

export function buildRocketFinalRecap(
  result: RocketFinalResultV2,
  teamId?: string | null,
): RocketFinalRecap {
  const winners = result.teams.filter((team) => team.position === 1);
  const personalTeam = teamId
    ? result.teams.find((team) => team.teamId === teamId) ?? null
    : null;
  const leadingStrokes = Math.min(
    ...winners.map((winner) => winner.totalStrokes),
  );

  return {
    teamCount: result.teams.length,
    winners,
    winnerScore: formatToPar(winners[0]?.vsPar ?? 0),
    personalTeam,
    personalPlacement: personalTeam
      ? formatPlacement(personalTeam.position, personalTeam.tied)
      : null,
    personalScore: personalTeam ? formatToPar(personalTeam.vsPar) : null,
    shotsFromLead: personalTeam
      ? Math.max(0, personalTeam.totalStrokes - leadingStrokes)
      : null,
  };
}

export function formatPlacement(position: number, tied: boolean) {
  return `${tied ? "joint " : ""}${ordinal(position)}`;
}

export function formatToPar(score: number) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `−${Math.abs(score)}`;
}

function ordinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
