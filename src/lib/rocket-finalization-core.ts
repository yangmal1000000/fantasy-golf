import { createHash } from "node:crypto";

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

export function buildRocketFinalResult(input: {
  tournamentId: string;
  fieldVersion: string | null;
  fieldHash: string;
  finalizedAt: string;
  teams: FinalizableTeam[];
}) {
  const result = {
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
    resultsHash: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  };
}
