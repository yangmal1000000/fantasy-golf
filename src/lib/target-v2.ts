import {
  mapSpaceToTargetPoint,
  targetPointToMapSpace,
  type TargetPoint,
  type TargetScenario,
  type TargetYardageAnchor,
  type TargetYardageCalibration,
  type TargetYardageGuide,
} from "./target-challenge";

export const TARGET_V2_VERSION = "hawthorn-vale-finish-position-2.2";

export interface TargetV2Metric {
  label: string;
  value: string;
}

export interface TargetV2Scenario extends TargetScenario {
  metrics: TargetV2Metric[];
  details: string[];
}

// Presentation-only copy deliberately lives outside TARGET_V2_SCENARIOS.
// Those frozen scenario objects are included in the live judging hash, while
// these labels may be clarified without invalidating an entry or judge round.
export const TARGET_V2_EXPECTED_FINISH_INSTRUCTION =
  "Using the supplied golfer and situation, place the centre of the expected finishing pattern where it gives the best strategic outcome.";

export const TARGET_V2_TASK_EXPLANATION =
  "Imagine you are advising the supplied golfer. Use their distance, shot pattern and tendencies together with the hole, wind and hazards. Choose the strategic centre of the expected finish pattern—not the exact result of one shot.";

export const TARGET_V2_FIXED_SHOT_EXPLANATION =
  "The supplied profile already includes the shot’s normal distance, release and dispersion, plus any stated bias. You choose only the intended line and expected finish centre.";

export const TARGET_V2_SCORING_EXPLANATION =
  "Three judges make the same three decisions from the same frozen information. Their final markers form one robust consensus reference for each decision; the lowest combined distance from all three references ranks first.";

export const TARGET_V2_DETAIL_HEADING = "Golfer & course detail";

export function targetV2DisplayMetrics(
  metrics: readonly TargetV2Metric[],
): TargetV2Metric[] {
  const labels: Record<string, string> = {
    "Expected total": "Golfer’s expected total",
    "Controlled finish": "Golfer’s controlled finish",
    "Shot pattern": "Golfer’s shot pattern",
  };
  return metrics.map((metric) => ({
    ...metric,
    label: labels[metric.label] ?? metric.label,
  }));
}

const TEE_BALL = { x: 48_000, y: 93_000 };
const APPROACH_BALL = { x: 49_000, y: 93_000 };
const SECOND_SHOT_BALL = { x: 47_000, y: 94_000 };

const TEE_YARDAGE: TargetYardageCalibration = {
  anchors: [
    { viewBoxY: 604.5, forwardYards: 0, centerX: 480, lateralYardsPerUnit: 0.08 },
    { viewBoxY: 430, forwardYards: 200, centerX: 495, lateralYardsPerUnit: 0.1 },
    { viewBoxY: 350, forwardYards: 240, centerX: 525, lateralYardsPerUnit: 0.12 },
    { viewBoxY: 285, forwardYards: 270, centerX: 555, lateralYardsPerUnit: 0.14 },
    { viewBoxY: 220, forwardYards: 300, centerX: 580, lateralYardsPerUnit: 0.17 },
    { viewBoxY: 140, forwardYards: 340, centerX: 600, lateralYardsPerUnit: 0.2 },
    { viewBoxY: 85, forwardYards: 390, centerX: 615, lateralYardsPerUnit: 0.24 },
  ],
  guides: [
    { yards: 220, startX: 190, endX: 812 },
    { yards: 250, startX: 205, endX: 825 },
    { yards: 275, startX: 225, endX: 840 },
    { yards: 300, startX: 250, endX: 850 },
  ],
};

const APPROACH_YARDAGE: TargetYardageCalibration = {
  anchors: [
    { viewBoxY: 604.5, forwardYards: 0, centerX: 490, lateralYardsPerUnit: 0.06 },
    { viewBoxY: 455, forwardYards: 75, centerX: 482, lateralYardsPerUnit: 0.08 },
    { viewBoxY: 330, forwardYards: 125, centerX: 472, lateralYardsPerUnit: 0.11 },
    { viewBoxY: 240, forwardYards: 160, centerX: 463, lateralYardsPerUnit: 0.15 },
    { viewBoxY: 205, forwardYards: 175, centerX: 458, lateralYardsPerUnit: 0.18 },
    { viewBoxY: 180, forwardYards: 181, centerX: 455, lateralYardsPerUnit: 0.2 },
    { viewBoxY: 145, forwardYards: 195, centerX: 450, lateralYardsPerUnit: 0.23 },
  ],
  guides: [
    { yards: 160, startX: 300, endX: 620 },
    { yards: 175, startX: 318, endX: 602 },
    { yards: 190, startX: 335, endX: 585 },
  ],
};

const SECOND_SHOT_YARDAGE: TargetYardageCalibration = {
  anchors: [
    { viewBoxY: 611, forwardYards: 0, centerX: 470, lateralYardsPerUnit: 0.08 },
    { viewBoxY: 470, forwardYards: 80, centerX: 474, lateralYardsPerUnit: 0.1 },
    { viewBoxY: 365, forwardYards: 125, centerX: 478, lateralYardsPerUnit: 0.12 },
    { viewBoxY: 320, forwardYards: 145, centerX: 481, lateralYardsPerUnit: 0.13 },
    { viewBoxY: 260, forwardYards: 185, centerX: 485, lateralYardsPerUnit: 0.15 },
    { viewBoxY: 190, forwardYards: 230, centerX: 488, lateralYardsPerUnit: 0.18 },
    { viewBoxY: 120, forwardYards: 285, centerX: 488, lateralYardsPerUnit: 0.21 },
    { viewBoxY: 78, forwardYards: 336, centerX: 487, lateralYardsPerUnit: 0.24 },
  ],
  guides: [
    { yards: 125, startX: 120, endX: 845 },
    { yards: 175, startX: 170, endX: 805 },
    { yards: 225, startX: 220, endX: 765 },
    { yards: 275, startX: 270, endX: 720 },
  ],
};

export const TARGET_V2_SCENARIOS: readonly TargetV2Scenario[] = [
  {
    id: "hawthorn-6-tee-finish-v2",
    number: 1,
    title: "Tee-shot finish",
    eyebrow: "Decision 1 · Tee strategy",
    hole: "Hawthorn Vale 6th · Par 4 · 438 yards",
    mapKind: "tee",
    summary: "Balance distance against the hazards on both sides of the fairway.",
    question: "Place the marker where you want the ball to finish.",
    skill: "Choose a finish that preserves distance without bringing the largest penalties into play.",
    playerFacts: [],
    conditions: [],
    metrics: [
      { label: "Expected total", value: "270 yd" },
      { label: "Wind", value: "14 mph L→R" },
      { label: "Fairway", value: "Firm" },
      { label: "Shot pattern", value: "38 × 24 yd" },
    ],
    details: [
      "Typical carry is 258 yards with about 12 yards of release.",
      "Water runs down the left from roughly 244–281 carry yards.",
      "The right bunker begins around 267 yards; out of bounds is beyond the far-right rough.",
      "The tee is 12 feet above the fairway at the expected finish distance.",
    ],
    windLabel: "14 MPH",
    windArrowDegrees: 0,
    ballPoint: TEE_BALL,
    yardage: TEE_YARDAGE,
  },
  {
    id: "hawthorn-11-approach-finish-v2",
    number: 2,
    title: "Approach finish",
    eyebrow: "Decision 2 · Green strategy",
    hole: "Hawthorn Vale 11th · Par 3 · 181 yards",
    mapKind: "approach",
    summary: "Use the wind, elevation and pin sheet to choose the safest scoring position.",
    question: "Place the marker where you want the ball to finish.",
    skill: "Decide how much of the flag to challenge while respecting the water and bunker.",
    playerFacts: [],
    conditions: [],
    metrics: [
      { label: "Distance", value: "181 yd" },
      { label: "Elevation", value: "5 ft uphill" },
      { label: "Wind", value: "11 mph R→L" },
      { label: "Pin sheet", value: "14 on · 5 left" },
    ],
    details: [
      "The green sits five feet above the ball.",
      "The pin is 14 paces from the front and five paces from the left edge.",
      "The normal shot pattern finishes about four yards right of the chosen target.",
      "The typical finish pattern is 24 yards wide by 18 yards deep.",
      "Water guards the left; a deep bunker guards short-right; the green is receptive.",
    ],
    windLabel: "11 MPH",
    windArrowDegrees: 180,
    ballPoint: APPROACH_BALL,
    yardage: APPROACH_YARDAGE,
    pinSheetLabel: "PIN · 14 ON / 5 LEFT",
  },
  {
    id: "hawthorn-15-second-shot-finish-v2",
    number: 3,
    title: "Par-5 second shot",
    eyebrow: "Decision 3 · Multi-shot strategy",
    hole: "Hawthorn Vale 15th · 336 yards to the pin",
    mapKind: "layup",
    summary: "Advance the ball while creating the strongest angle and distance for the third shot.",
    question: "Place the marker where you want the ball to finish.",
    skill: "Choose the strongest third-shot setup while keeping the creek and approach angle in view.",
    playerFacts: [],
    conditions: [],
    metrics: [
      { label: "To pin", value: "336 yd" },
      { label: "Controlled finish", value: "235–250 yd" },
      { label: "Lie", value: "Light rough" },
      { label: "Wind", value: "13 mph behind/right" },
      { label: "Creek", value: "137 yd centre" },
      { label: "Shot pattern", value: "26 × 20 yd" },
    ],
    details: [
      "The green is out of range from this lie.",
      "A strongest controlled shot from this lie normally finishes 235–250 yards from the ball.",
      "The typical finish pattern is 26 yards wide by 20 yards deep.",
      "The creek requires about 154 yards on the left, 137 through the centre and 121 on the right.",
      "The fairway opens widest beyond the creek, centre-left.",
      "Right rough and trees can partially block the third-shot angle.",
      "A finish leaving roughly 85–105 yards gives the supplied golfer a preferred third-shot distance.",
    ],
    windLabel: "13 MPH",
    windArrowDegrees: -135,
    ballPoint: SECOND_SHOT_BALL,
    yardage: SECOND_SHOT_YARDAGE,
    pinSheetLabel: "PIN · 336 YDS",
    hardest: true,
  },
] as const;

const TARGET_V2_DISPERSION_YARDS: Readonly<
  Record<string, { width: number; depth: number }>
> = {
  "hawthorn-6-tee-finish-v2": { width: 38, depth: 24 },
  "hawthorn-11-approach-finish-v2": { width: 24, depth: 18 },
  "hawthorn-15-second-shot-finish-v2": { width: 26, depth: 20 },
  "hawthorn-practice-finish-v2": { width: 28, depth: 18 },
};

export interface TargetV2DispersionEllipse {
  radiusX: number;
  radiusY: number;
  widthYards: number;
  depthYards: number;
}

export function targetV2DispersionEllipse(
  scenario: Pick<TargetScenario, "id" | "yardage">,
  point: TargetPoint | null,
): TargetV2DispersionEllipse | null {
  const dispersion = TARGET_V2_DISPERSION_YARDS[scenario.id];
  if (!dispersion || !scenario.yardage || !point) return null;

  const centre = targetPointToMapSpace(point);
  const anchor = interpolateYardageAnchor(
    scenario.yardage.anchors,
    centre.y,
  );
  const centreDistance = targetFinishDistanceAtMapPoint(
    scenario.yardage,
    centre,
  );
  const nearY = solveViewBoxYForDistance(
    scenario.yardage,
    Math.max(0, centreDistance - dispersion.depth / 2),
    centre.x,
  );
  const farY = solveViewBoxYForDistance(
    scenario.yardage,
    centreDistance + dispersion.depth / 2,
    centre.x,
  );

  return {
    radiusX: Math.max(
      12,
      dispersion.width / 2 / Math.max(0.01, anchor.lateralYardsPerUnit),
    ),
    radiusY: Math.max(8, Math.abs(nearY - farY) / 2),
    widthYards: dispersion.width,
    depthYards: dispersion.depth,
  };
}

export const TARGET_V2_PRACTICE: TargetV2Scenario = {
  id: "hawthorn-practice-finish-v2",
  number: 0,
  title: "Try the finish marker",
  eyebrow: "Practice · Not recorded",
  hole: "Hawthorn Vale practice hole",
  mapKind: "practice",
  summary: "Move the marker and watch the approximate distance update.",
  question: "Tap to place the centre of an expected finishing pattern.",
  skill: "This practice map has no correct answer and is never submitted.",
  playerFacts: [],
  conditions: [],
  metrics: [
    { label: "Purpose", value: "Learn the marker" },
    { label: "Result", value: "Not recorded" },
  ],
  details: ["Tap the map, then use the arrow controls for fine adjustment."],
  windLabel: "LIGHT",
  windArrowDegrees: 0,
  ballPoint: TEE_BALL,
  yardage: TEE_YARDAGE,
};

export function estimateTargetFinishYards(
  scenario: Pick<TargetScenario, "yardage">,
  point: TargetPoint | null,
): number | null {
  const distance = targetFinishDistanceYards(scenario, point);
  return distance === null ? null : Math.max(0, Math.round(distance));
}

export function targetFinishDistanceYards(
  scenario: Pick<TargetScenario, "yardage">,
  point: TargetPoint | null,
): number | null {
  if (!scenario.yardage || !point) return null;
  const position = targetPointToMapSpace(point);
  return targetFinishDistanceAtMapPoint(scenario.yardage, position);
}

export function buildTargetYardageGuidePoints(
  calibration: TargetYardageCalibration,
  guide: TargetYardageGuide,
  sampleCount = 25,
): TargetPoint[] {
  const count = Math.max(2, Math.round(sampleCount));
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const x = lerp(guide.startX, guide.endX, ratio);
    return {
      x,
      y: solveViewBoxYForDistance(calibration, guide.yards, x),
    };
  });
}

function targetFinishDistanceAtMapPoint(
  calibration: TargetYardageCalibration,
  position: TargetPoint,
): number {
  const sample = interpolateYardageAnchor(calibration.anchors, position.y);
  const lateralYards = (position.x - sample.centerX) * sample.lateralYardsPerUnit;
  return Math.hypot(sample.forwardYards, lateralYards);
}

function solveViewBoxYForDistance(
  calibration: TargetYardageCalibration,
  targetYards: number,
  viewBoxX: number,
): number {
  const ordered = [...calibration.anchors].sort((a, b) => b.viewBoxY - a.viewBoxY);
  if (ordered.length === 0) {
    throw new Error("At least one yardage anchor is required");
  }

  let nearY = ordered[0].viewBoxY;
  let farY = ordered[ordered.length - 1].viewBoxY;
  const distanceAt = (viewBoxY: number) =>
    targetFinishDistanceAtMapPoint(calibration, { x: viewBoxX, y: viewBoxY });

  if (targetYards <= distanceAt(nearY)) return nearY;
  if (targetYards >= distanceAt(farY)) return farY;

  for (let iteration = 0; iteration < 48; iteration += 1) {
    const midY = (nearY + farY) / 2;
    if (distanceAt(midY) < targetYards) {
      nearY = midY;
    } else {
      farY = midY;
    }
  }

  return (nearY + farY) / 2;
}

export function targetPointAtViewBox(x: number, y: number): TargetPoint {
  return mapSpaceToTargetPoint({ x, y });
}

function interpolateYardageAnchor(
  anchors: readonly TargetYardageAnchor[],
  viewBoxY: number,
): TargetYardageAnchor {
  if (anchors.length === 0) {
    throw new Error("At least one yardage anchor is required");
  }
  const ordered = [...anchors].sort((a, b) => b.viewBoxY - a.viewBoxY);
  if (viewBoxY >= ordered[0].viewBoxY) return ordered[0];
  if (viewBoxY <= ordered[ordered.length - 1].viewBoxY) {
    return ordered[ordered.length - 1];
  }

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const near = ordered[index];
    const far = ordered[index + 1];
    if (viewBoxY > near.viewBoxY || viewBoxY < far.viewBoxY) continue;
    const span = near.viewBoxY - far.viewBoxY;
    const ratio = span === 0 ? 0 : (near.viewBoxY - viewBoxY) / span;
    return {
      viewBoxY,
      forwardYards: lerp(near.forwardYards, far.forwardYards, ratio),
      centerX: lerp(near.centerX, far.centerX, ratio),
      lateralYardsPerUnit: lerp(
        near.lateralYardsPerUnit,
        far.lateralYardsPerUnit,
        ratio,
      ),
    };
  }

  return ordered[ordered.length - 1];
}

function lerp(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}
