export const TARGET_COORDINATE_MAX = 100_000;
export const TARGET_ATTEMPT_SECONDS = 20 * 60;
export const TARGET_MAP_WIDTH = 1_000;
export const TARGET_MAP_HEIGHT = 650;

// Ground-contact coordinate in the 1000 × 650 course-map viewBox. Keep the
// full anchor comfortably inside the front-left putting surface rather than
// letting its outline overlap the waterline.
export const APPROACH_FLAG_GROUND_VIEWBOX = { x: 455, y: 180 } as const;

export type CourseMapKind = "tee" | "approach" | "layup" | "practice";

export interface TargetPoint {
  x: number;
  y: number;
}

export interface TargetScenario {
  id: string;
  number: number;
  title: string;
  eyebrow: string;
  hole: string;
  mapKind: CourseMapKind;
  summary: string;
  question: string;
  skill: string;
  playerFacts: string[];
  conditions: string[];
  windLabel: string;
  windArrowDegrees: number;
  hardest?: boolean;
}

export interface ScoredTargetEntry {
  entryId: string;
  points: TargetPoint[];
}

export interface TargetEntryScore {
  entryId: string;
  scenarioErrors: number[];
  totalError: number;
}

export const TARGET_SCENARIOS: readonly TargetScenario[] = [
  {
    id: "hawthorn-6-tee",
    number: 1,
    title: "Controlled tee shot",
    eyebrow: "Decision 1 · Tee strategy",
    hole: "Hawthorn Vale 6th · Par 4 · 438 yards",
    mapKind: "tee",
    summary:
      "Balance driver dispersion against water, a fairway bunker and out-of-bounds pressure.",
    question:
      "Place the centre of the intended driver carry landing dispersion that minimises expected strokes.",
    skill:
      "Translate wind and dispersion into a risk-adjusted target instead of clicking the visible fairway centre.",
    playerFacts: [
      "Right-handed golfer",
      "Driver carry centre: 258 yards",
      "Expected release: 12 yards",
      "80% dispersion: 38 yards wide × 24 yards deep",
    ],
    conditions: [
      "14 mph wind left-to-right, slightly helping",
      "Tee sits 12 feet above the landing area",
      "Firm fairway",
      "Water left from 244–281 carry yards",
      "Right bunker from 267–292 yards",
      "Out of bounds beyond the far-right rough",
    ],
    windLabel: "14 MPH",
    windArrowDegrees: 0,
  },
  {
    id: "hawthorn-11-approach",
    number: 2,
    title: "Flag or safe section?",
    eyebrow: "Decision 2 · Green strategy",
    hole: "Hawthorn Vale 11th · Par 3 · 181 yards",
    mapKind: "approach",
    summary:
      "Use shot bias, wind and asymmetric penalty costs to choose a green target.",
    question:
      "Place the centre of the intended 6-iron carry landing dispersion that minimises expected strokes.",
    skill:
      "The flag is only a reference point. The best target may use the safer depth and width of the green.",
    playerFacts: [
      "6-iron carry centre: 179 yards",
      "80% dispersion: 24 yards wide × 18 yards deep",
      "Normal pattern finishes four yards right of target",
    ],
    conditions: [
      "11 mph wind right-to-left",
      "Green is five feet above the tee",
      "Front-left pin sits four paces from water",
      "Deep bunker guards short-right",
      "Back-centre offers the widest safe depth",
      "Receptive green with little release",
    ],
    windLabel: "11 MPH",
    windArrowDegrees: 180,
  },
  {
    id: "hawthorn-15-layup",
    number: 3,
    title: "Par-5 lay-up geometry",
    eyebrow: "Decision 3 · Multi-shot planning",
    hole: "Hawthorn Vale 15th · Second shot · 286 yards remaining",
    mapKind: "layup",
    summary:
      "Balance advancement, creek risk and the preferred distance for the next shot.",
    question:
      "Place the centre of the supplied lay-up shot's carry landing pattern to leave the strongest next shot.",
    skill:
      "Choose the safest landing position beyond the creek while preserving a clear angle for the approach.",
    playerFacts: [
      "Supplied lay-up shot carry centre: 174 yards",
      "Expected release: 10 yards",
      "80% dispersion: 19 yards wide × 14 yards deep",
      "Preferred next shot: 92–108 yards",
    ],
    conditions: [
      "13 mph wind quartering from behind and right",
      "Creek carry: 154 yards left · 137 centre · 121 right",
      "Fairway opens widest beyond the creek centre-left",
      "Right rough and trees partially block the approach",
      "The supplied shot leaves about 102 yards after release",
    ],
    windLabel: "13 MPH",
    windArrowDegrees: -135,
    hardest: true,
  },
] as const;

export const PRACTICE_SCENARIO: TargetScenario = {
  id: "practice-target",
  number: 0,
  title: "Practice the marker",
  eyebrow: "Free interaction example",
  hole: "Hawthorn Vale practice hole",
  mapKind: "practice",
  summary: "Place and fine-tune a target before entering the prototype.",
  question:
    "Tap the fairway to place a practice pin. The pin is the centre of your intended carry landing pattern.",
  skill: "This image is never used in a live competition and has no correct answer.",
  playerFacts: ["Practice carry centre: 220 yards", "Practice dispersion: 28 yards wide"],
  conditions: ["Light crosswind", "Soft fairway", "No score is recorded"],
  windLabel: "LIGHT",
  windArrowDegrees: 0,
};

export function clampTargetCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(TARGET_COORDINATE_MAX, Math.round(value)));
}

export function normaliseTargetPoint(xRatio: number, yRatio: number): TargetPoint {
  return {
    x: clampTargetCoordinate(xRatio * TARGET_COORDINATE_MAX),
    y: clampTargetCoordinate(yRatio * TARGET_COORDINATE_MAX),
  };
}

export function moveTargetPoint(
  point: TargetPoint,
  deltaX: number,
  deltaY: number,
): TargetPoint {
  return {
    x: clampTargetCoordinate(point.x + deltaX),
    y: clampTargetCoordinate(point.y + deltaY),
  };
}

export function targetDistance(a: TargetPoint, b: TargetPoint): number {
  const aMap = targetPointToMapSpace(a);
  const bMap = targetPointToMapSpace(b);
  return Math.hypot(aMap.x - bMap.x, aMap.y - bMap.y);
}

export function targetPointToMapSpace(point: TargetPoint): TargetPoint {
  return {
    x: (clampTargetCoordinate(point.x) / TARGET_COORDINATE_MAX) * TARGET_MAP_WIDTH,
    y: (clampTargetCoordinate(point.y) / TARGET_COORDINATE_MAX) * TARGET_MAP_HEIGHT,
  };
}

export function mapSpaceToTargetPoint(point: TargetPoint): TargetPoint {
  return {
    x: clampTargetCoordinate((point.x / TARGET_MAP_WIDTH) * TARGET_COORDINATE_MAX),
    y: clampTargetCoordinate((point.y / TARGET_MAP_HEIGHT) * TARGET_COORDINATE_MAX),
  };
}

/**
 * Deterministic Weiszfeld calculation in the real 1000 × 650 map geometry.
 * Inputs are sorted before iteration so database ordering cannot affect the
 * rounded official coordinate.
 */
export function geometricMedianTarget(points: readonly TargetPoint[]): TargetPoint {
  if (points.length === 0) throw new Error("At least one target point is required");
  if (points.length === 1) return {
    x: clampTargetCoordinate(points[0].x),
    y: clampTargetCoordinate(points[0].y),
  };

  const mapPoints = points
    .map(targetPointToMapSpace)
    .sort((a, b) => a.x - b.x || a.y - b.y);

  let current = {
    x: mapPoints.reduce((sum, point) => sum + point.x, 0) / mapPoints.length,
    y: mapPoints.reduce((sum, point) => sum + point.y, 0) / mapPoints.length,
  };

  for (let iteration = 0; iteration < 1_000; iteration += 1) {
    const exact = mapPoints.find(
      (point) => Math.hypot(point.x - current.x, point.y - current.y) < 1e-10,
    );
    if (exact) return mapSpaceToTargetPoint(exact);

    let weightTotal = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const point of mapPoints) {
      const distance = Math.hypot(point.x - current.x, point.y - current.y);
      const weight = 1 / Math.max(distance, 1e-10);
      weightTotal += weight;
      weightedX += point.x * weight;
      weightedY += point.y * weight;
    }

    const next = { x: weightedX / weightTotal, y: weightedY / weightTotal };
    if (Math.hypot(next.x - current.x, next.y - current.y) < 1e-8) {
      return mapSpaceToTargetPoint(next);
    }
    current = next;
  }

  return mapSpaceToTargetPoint(current);
}

export function scoreTargetEntry(
  entry: ScoredTargetEntry,
  officialTargets: readonly TargetPoint[],
): TargetEntryScore {
  if (entry.points.length !== TARGET_SCENARIOS.length) {
    throw new Error(`Expected ${TARGET_SCENARIOS.length} entrant points`);
  }
  if (officialTargets.length !== TARGET_SCENARIOS.length) {
    throw new Error(`Expected ${TARGET_SCENARIOS.length} official targets`);
  }

  const diagonal = Math.hypot(TARGET_MAP_WIDTH, TARGET_MAP_HEIGHT);
  const scenarioErrors = entry.points.map(
    (point, index) => targetDistance(point, officialTargets[index]) / diagonal,
  );

  return {
    entryId: entry.entryId,
    scenarioErrors,
    totalError: scenarioErrors.reduce((sum, error) => sum + error, 0),
  };
}

/**
 * Primary score first, followed by the published tie order: scenario 3, 2, 1.
 * A zero result means every scoring and tie-break value is identical.
 */
export function compareTargetScores(a: TargetEntryScore, b: TargetEntryScore): number {
  if (a.totalError !== b.totalError) return a.totalError - b.totalError;

  for (const index of [2, 1, 0]) {
    if (a.scenarioErrors[index] !== b.scenarioErrors[index]) {
      return a.scenarioErrors[index] - b.scenarioErrors[index];
    }
  }

  return 0;
}

export function formatTargetCoordinate(value: number): string {
  return `${(clampTargetCoordinate(value) / 1_000).toFixed(1)}%`;
}

export function formatAttemptTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
