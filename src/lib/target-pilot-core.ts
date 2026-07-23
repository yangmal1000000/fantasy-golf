import {
  TARGET_SCENARIOS,
  compareTargetScores,
  scoreTargetEntry,
  type TargetEntryScore,
  type TargetPoint,
} from "@/lib/target-challenge";

export const TARGET_PILOT_SCORING_ALGORITHM = "target-distance-v1" as const;
export const TARGET_PILOT_TIE_ORDER = [2, 1, 0] as const;

export interface TargetPilotPoint {
  scenarioId: string;
  point: TargetPoint;
}

export interface TargetPilotSubmission {
  points: TargetPilotPoint[];
}

export interface TargetPilotEntryDto {
  id: string;
  reference: string;
  email?: string;
  submission?: TargetPilotSubmission;
  submissionHash: string;
  submittedAt: string;
}

export interface TargetPilotStatusDto {
  roundStatus: string;
  entryOpen: boolean;
  sealedAt: string | null;
  entry: TargetPilotEntryDto | null;
}

export interface TargetPilotRankedResult {
  entryId: string;
  rank: number;
  tied: boolean;
  totalError: number;
  scenarioErrors: number[];
}

export interface TargetPilotResultsRecord {
  algorithm: typeof TARGET_PILOT_SCORING_ALGORITHM;
  tieOrder: readonly [2, 1, 0];
  entries: TargetPilotRankedResult[];
}

export function validateTargetPilotSubmission(value: unknown): TargetPilotSubmission {
  if (!value || typeof value !== "object") {
    throw new Error("A complete pilot entry is required");
  }

  const points = (value as { points?: unknown }).points;
  if (!Array.isArray(points) || points.length !== TARGET_SCENARIOS.length) {
    throw new Error(`Exactly ${TARGET_SCENARIOS.length} target points are required`);
  }

  const expectedIds = new Set(TARGET_SCENARIOS.map((scenario) => scenario.id));
  const seen = new Set<string>();
  const validated = points.map((item): TargetPilotPoint => {
    if (!item || typeof item !== "object") throw new Error("Invalid target point");
    const candidate = item as {
      scenarioId?: unknown;
      point?: { x?: unknown; y?: unknown };
    };
    if (typeof candidate.scenarioId !== "string" || !expectedIds.has(candidate.scenarioId)) {
      throw new Error("Pilot entry contains an unknown scenario");
    }
    if (seen.has(candidate.scenarioId)) throw new Error("Each scenario may be submitted only once");
    seen.add(candidate.scenarioId);

    const x = candidate.point?.x;
    const y = candidate.point?.y;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x > 100_000 ||
      y < 0 ||
      y > 100_000
    ) {
      throw new Error("Every pilot target needs a valid coordinate");
    }
    return { scenarioId: candidate.scenarioId, point: { x, y } };
  });

  return {
    points: TARGET_SCENARIOS.map((scenario) =>
      validated.find((item) => item.scenarioId === scenario.id),
    ).filter((item): item is TargetPilotPoint => Boolean(item)),
  };
}

export function rankTargetPilotEntries(
  entries: ReadonlyArray<{ entryId: string; submission: TargetPilotSubmission }>,
  officialTargets: readonly TargetPoint[],
): TargetPilotResultsRecord {
  const scored = entries.map(({ entryId, submission }) => {
    const validated = validateTargetPilotSubmission(submission);
    return scoreTargetEntry(
      { entryId, points: validated.points.map((item) => item.point) },
      officialTargets,
    );
  });
  scored.sort(compareTargetScores);

  return {
    algorithm: TARGET_PILOT_SCORING_ALGORITHM,
    tieOrder: TARGET_PILOT_TIE_ORDER,
    entries: scored.map((score, index) => {
      const previous = scored[index - 1];
      const next = scored[index + 1];
      const tiedWithPrevious = Boolean(previous && compareTargetScores(previous, score) === 0);
      const tiedWithNext = Boolean(next && compareTargetScores(score, next) === 0);
      return {
        entryId: score.entryId,
        rank: tiedWithPrevious
          ? resultRank(scored, index - 1)
          : index + 1,
        tied: tiedWithPrevious || tiedWithNext,
        totalError: score.totalError,
        scenarioErrors: score.scenarioErrors,
      };
    }),
  };
}

function resultRank(scores: readonly TargetEntryScore[], index: number): number {
  let first = index;
  while (first > 0 && compareTargetScores(scores[first - 1], scores[first]) === 0) first -= 1;
  return first + 1;
}

export function validateTargetPilotResults(value: unknown): TargetPilotResultsRecord {
  if (!value || typeof value !== "object") throw new Error("Pilot results are missing");
  const candidate = value as { algorithm?: unknown; tieOrder?: unknown; entries?: unknown };
  if (candidate.algorithm !== TARGET_PILOT_SCORING_ALGORITHM) {
    throw new Error("Unknown pilot scoring algorithm");
  }
  if (JSON.stringify(candidate.tieOrder) !== JSON.stringify(TARGET_PILOT_TIE_ORDER)) {
    throw new Error("Unknown pilot tie order");
  }
  if (!Array.isArray(candidate.entries)) throw new Error("Pilot results are invalid");

  const entries = candidate.entries.map((item): TargetPilotRankedResult => {
    if (!item || typeof item !== "object") throw new Error("Pilot result is invalid");
    const result = item as Partial<TargetPilotRankedResult>;
    if (
      typeof result.entryId !== "string" ||
      !Number.isInteger(result.rank) ||
      (result.rank ?? 0) < 1 ||
      typeof result.tied !== "boolean" ||
      typeof result.totalError !== "number" ||
      !Array.isArray(result.scenarioErrors) ||
      result.scenarioErrors.length !== TARGET_SCENARIOS.length ||
      result.scenarioErrors.some((error) => typeof error !== "number" || error < 0)
    ) {
      throw new Error("Pilot result is invalid");
    }
    return result as TargetPilotRankedResult;
  });

  return {
    algorithm: TARGET_PILOT_SCORING_ALGORITHM,
    tieOrder: TARGET_PILOT_TIE_ORDER,
    entries,
  };
}

export function targetPilotReference(id: string): string {
  return `HV-PILOT-${id.slice(-8).toUpperCase()}`;
}
