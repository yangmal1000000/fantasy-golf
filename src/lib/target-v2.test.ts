import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGET_V2_PRACTICE,
  TARGET_V2_SCENARIOS,
  TARGET_V2_VERSION,
  buildTargetYardageGuidePoints,
  estimateTargetFinishYards,
  targetV2EssentialFacts,
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

test("v2 uses one clear finishing-position instruction throughout", () => {
  for (const scenario of TARGET_V2_SCENARIOS) {
    assert.equal(scenario.question, "Place the marker where you want the ball to finish.");
  }
  assert.match(TARGET_V2_PRACTICE.question, /finish/i);

  const allCopy = [
    ...TARGET_V2_SCENARIOS.map((_, index) => visibleScenarioText(index)),
    TARGET_V2_PRACTICE.question,
  ].join(" ");
  assert.doesNotMatch(allCopy, /landing|6[\s-]?iron|lay[\s-]?up|above the tee/i);
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

test("v2 preview has a distinct version identifier", () => {
  assert.equal(TARGET_V2_VERSION, "hawthorn-vale-finish-position-preview-2.2");
});

test("each folded shot brief retains three essential facts including wind", () => {
  assert.deepEqual(
    TARGET_V2_SCENARIOS.map((scenario) =>
      targetV2EssentialFacts(scenario).map((metric) => metric.value),
    ),
    [
      ["270 yd", "14 mph L→R", "Firm"],
      ["181 yd", "5 ft uphill", "11 mph R→L"],
      ["336 yd", "235–250 yd", "13 mph behind/right"],
    ],
  );
});
