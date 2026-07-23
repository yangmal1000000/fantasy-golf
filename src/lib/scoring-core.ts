export type FantasyScoreState = "NOT_STARTED" | "PROVISIONAL" | "FINAL";

export interface PlayerRoundScore {
  roundScores: (number | null)[];
  isEstimated: boolean[];
  totalStrokes: number;
  roundsScored: number;
  vsPar: number;
}

export interface TeamScoreKey {
  totalStrokes: number;
  vsPar: number;
  roundsScored: number;
}

/**
 * Apply the closed-beta score policy without ever treating an unplayed future
 * round as zero.
 *
 * - Active/made-cut players keep future rounds as null.
 * - Missed-cut players receive their rounded R1/R2 average for R3 and R4.
 * - A post-lock withdrawal receives the rounded average of completed rounds
 *   for every missing round; with no completed round, par + 10 is used.
 */
export function applyFantasyScorePolicy(input: {
  scores: readonly (number | null)[];
  estimates?: readonly boolean[];
  par: number;
  madeCut: boolean | null;
  withdrew: boolean;
}): PlayerRoundScore {
  const roundScores = [0, 1, 2, 3].map((index) => input.scores[index] ?? null);
  const isEstimated = [0, 1, 2, 3].map(
    (index) => input.estimates?.[index] ?? false,
  );
  const completed = roundScores.filter((score): score is number => score !== null);

  if (input.withdrew) {
    const replacement =
      completed.length > 0
        ? Math.round(completed.reduce((sum, score) => sum + score, 0) / completed.length)
        : input.par + 10;
    for (let index = 0; index < roundScores.length; index += 1) {
      if (roundScores[index] === null) {
        roundScores[index] = replacement;
        isEstimated[index] = true;
      }
    }
  } else if (input.madeCut === false) {
    const openingRounds = roundScores
      .slice(0, 2)
      .filter((score): score is number => score !== null);
    if (openingRounds.length > 0) {
      const replacement = Math.round(
        openingRounds.reduce((sum, score) => sum + score, 0) / openingRounds.length,
      );
      for (const index of [2, 3]) {
        if (roundScores[index] === null) {
          roundScores[index] = replacement;
          isEstimated[index] = true;
        }
      }
    }
  }

  const scored = roundScores.filter((score): score is number => score !== null);
  const totalStrokes = scored.reduce((sum, score) => sum + score, 0);
  const roundsScored = scored.length;
  return {
    roundScores,
    isEstimated,
    totalStrokes,
    roundsScored,
    vsPar: totalStrokes - input.par * roundsScored,
  };
}

export function fantasyScoreState(
  roundsScored: number,
  expectedRounds: number,
): FantasyScoreState {
  if (roundsScored === 0) return "NOT_STARTED";
  if (roundsScored >= expectedRounds) return "FINAL";
  return "PROVISIONAL";
}

export function compareTeamScoreKeys(a: TeamScoreKey, b: TeamScoreKey) {
  if (a.roundsScored === 0 && b.roundsScored > 0) return 1;
  if (b.roundsScored === 0 && a.roundsScored > 0) return -1;
  if (a.vsPar !== b.vsPar) return a.vsPar - b.vsPar;
  if (a.roundsScored !== b.roundsScored) return b.roundsScored - a.roundsScored;
  return a.totalStrokes - b.totalStrokes;
}

export function sameTeamScorePosition(a: TeamScoreKey, b: TeamScoreKey) {
  return (
    a.roundsScored > 0 &&
    a.vsPar === b.vsPar &&
    a.roundsScored === b.roundsScored &&
    a.totalStrokes === b.totalStrokes
  );
}

export function deriveCutLine(
  twoRoundTotals: readonly number[],
  places = 65,
): number | null {
  if (places < 1 || twoRoundTotals.length < places) return null;
  return [...twoRoundTotals].sort((a, b) => a - b)[places - 1] ?? null;
}
