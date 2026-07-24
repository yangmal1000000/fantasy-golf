import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { TARGET_MAP_HEIGHT, TARGET_MAP_WIDTH } from "./target-challenge";
import {
  TARGET_V2_DETAIL_HEADING,
  TARGET_V2_EXPECTED_FINISH_INSTRUCTION,
  TARGET_V2_FIXED_SHOT_EXPLANATION,
  TARGET_V2_PRACTICE,
  TARGET_V2_SCORING_EXPLANATION,
  TARGET_V2_SCENARIOS,
  TARGET_V2_TASK_EXPLANATION,
  TARGET_V2_VERSION,
  buildTargetYardageGuidePoints,
  estimateTargetFinishYards,
  targetV2DisplayMetrics,
  targetV2DispersionEllipse,
  targetFinishDistanceYards,
  targetPointAtViewBox,
} from "./target-v2";

function visibleScenarioText(index: number): string {
  const scenario = TARGET_V2_SCENARIOS[index];
  return [
    scenario.title,
    scenario.eyebrow,
    scenario.hole,
    scenario.summary,
    scenario.question,
    scenario.skill,
    ...scenario.metrics.flatMap((metric) => [metric.label, metric.value]),
    ...scenario.details,
  ].join(" ");
}

test("v2 presentation clearly asks for an expected finish centre", () => {
  assert.match(TARGET_V2_EXPECTED_FINISH_INSTRUCTION, /supplied golfer and situation/i);
  assert.match(TARGET_V2_EXPECTED_FINISH_INSTRUCTION, /centre of the expected finishing pattern/i);
  assert.match(TARGET_V2_TASK_EXPLANATION, /not the exact result of one shot/i);
  assert.match(TARGET_V2_FIXED_SHOT_EXPLANATION, /intended line and expected finish centre/i);
  assert.match(TARGET_V2_SCORING_EXPLANATION, /same frozen information/i);
  assert.match(TARGET_V2_SCORING_EXPLANATION, /lowest combined distance/i);
  assert.equal(TARGET_V2_DETAIL_HEADING, "Golfer & course detail");
  assert.match(TARGET_V2_PRACTICE.question, /expected finishing pattern/i);

  const allPresentationCopy = [
    TARGET_V2_EXPECTED_FINISH_INSTRUCTION,
    TARGET_V2_TASK_EXPLANATION,
    TARGET_V2_FIXED_SHOT_EXPLANATION,
    TARGET_V2_SCORING_EXPLANATION,
  ].join(" ");
  assert.doesNotMatch(allPresentationCopy, /landing position|exact flight path/i);
});

test("presentation labels distinguish golfer data from course information", () => {
  const teeMetrics = targetV2DisplayMetrics(TARGET_V2_SCENARIOS[0].metrics);
  assert.ok(teeMetrics.some((metric) => metric.label === "Golfer’s expected total"));
  assert.ok(teeMetrics.some((metric) => metric.label === "Golfer’s shot pattern"));

  const secondShotMetrics = targetV2DisplayMetrics(TARGET_V2_SCENARIOS[2].metrics);
  assert.ok(
    secondShotMetrics.some(
      (metric) => metric.label === "Golfer’s controlled finish",
    ),
  );
});

test("approach copy uses the ball and a conventional pin sheet", () => {
  const approachCopy = visibleScenarioText(1);
  assert.match(approachCopy, /above the ball/i);
  assert.match(approachCopy, /14 paces from the front/i);
  assert.match(approachCopy, /five paces from the left edge/i);
  assert.match(approachCopy, /14 on · 5 left/i);
});

test("par-five decision makes the green unreachable without prescribing a club", () => {
  const secondShotCopy = visibleScenarioText(2);
  assert.match(secondShotCopy, /336 yards to the pin/i);
  assert.match(secondShotCopy, /green is out of range from this lie/i);
  assert.match(secondShotCopy, /235–250 yards from the ball/i);
  assert.match(secondShotCopy, /26 yards wide by 20 yards deep/i);
  assert.doesNotMatch(secondShotCopy, /wood|hybrid|iron|supplied shot/i);
});

test("calibrated finish readout starts at zero and reaches the stated shot regions", () => {
  for (const scenario of TARGET_V2_SCENARIOS) {
    assert.equal(estimateTargetFinishYards(scenario, scenario.ballPoint ?? null), 0);
    assert.ok((scenario.yardage?.guides.length ?? 0) >= 3);
  }

  const approachFlag = targetPointAtViewBox(455, 180);
  assert.equal(estimateTargetFinishYards(TARGET_V2_SCENARIOS[1], approachFlag), 181);

  const parFiveFlag = targetPointAtViewBox(487, 78);
  assert.equal(estimateTargetFinishYards(TARGET_V2_SCENARIOS[2], parFiveFlag), 336);
});

test("finish readout resolves every yard rather than five-yard bands", () => {
  const tee = TARGET_V2_SCENARIOS[0];
  const calibration = tee.yardage!;
  const point251 = buildTargetYardageGuidePoints(
    calibration,
    { yards: 251, startX: 525, endX: 525 },
  )[0];
  const point252 = buildTargetYardageGuidePoints(
    calibration,
    { yards: 252, startX: 525, endX: 525 },
  )[0];

  assert.equal(estimateTargetFinishYards(tee, targetPointAtViewBox(point251.x, point251.y)), 251);
  assert.equal(estimateTargetFinishYards(tee, targetPointAtViewBox(point252.x, point252.y)), 252);
});

test("every generated yardage guide follows the same proportional distance model", () => {
  for (const scenario of TARGET_V2_SCENARIOS) {
    const calibration = scenario.yardage!;
    for (const guide of calibration.guides) {
      const points = buildTargetYardageGuidePoints(calibration, guide, 41);
      for (const point of points) {
        const actual = targetFinishDistanceYards(
          scenario,
          targetPointAtViewBox(point.x, point.y),
        );
        assert.ok(actual !== null);
        assert.ok(
          Math.abs(actual - guide.yards) < 0.05,
          `${scenario.id} ${guide.yards}-yard guide measured ${actual}`,
        );
      }
    }
  }
});

test("each live decision draws a calibrated expected-finish dispersion area", () => {
  for (const scenario of TARGET_V2_SCENARIOS) {
    const guide = scenario.yardage!.guides[Math.floor(scenario.yardage!.guides.length / 2)];
    const point = buildTargetYardageGuidePoints(scenario.yardage!, guide, 3)[1];
    const ellipse = targetV2DispersionEllipse(
      scenario,
      targetPointAtViewBox(point.x, point.y),
    );
    assert.ok(ellipse);
    assert.ok(ellipse.radiusX > 0);
    assert.ok(ellipse.radiusY > 0);
    assert.ok(ellipse.widthYards > 0);
    assert.ok(ellipse.depthYards > 0);
  }
});

test("presentation-only clarity changes preserve the frozen live scenario hash", () => {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        scenarioVersion: TARGET_V2_VERSION,
        coordinateSpace: {
          width: TARGET_MAP_WIDTH,
          height: TARGET_MAP_HEIGHT,
        },
        scenarios: TARGET_V2_SCENARIOS,
      }),
    )
    .digest("hex");
  assert.equal(
    hash,
    "f16df993e576bed2c59dab0f0d0232679d8944b02fb2a7fc7994007149af5567",
  );
});

test("v2 live Target has a distinct stable version identifier", () => {
  assert.equal(TARGET_V2_VERSION, "hawthorn-vale-finish-position-2.2");
});
