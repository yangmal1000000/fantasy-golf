import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGET_COORDINATE_MAX,
  clampTargetCoordinate,
  compareTargetScores,
  formatAttemptTime,
  moveTargetPoint,
  normaliseTargetPoint,
  scoreTargetEntry,
  TARGET_SCENARIOS,
} from "./target-challenge";

test("normaliseTargetPoint converts ratios to bounded integer coordinates", () => {
  assert.deepEqual(normaliseTargetPoint(0.5, 0.25), { x: 50_000, y: 25_000 });
  assert.deepEqual(normaliseTargetPoint(-1, 2), { x: 0, y: TARGET_COORDINATE_MAX });
  assert.equal(clampTargetCoordinate(Number.NaN), 0);
});

test("moveTargetPoint keeps fine adjustments inside the map", () => {
  assert.deepEqual(moveTargetPoint({ x: 100, y: 99_900 }, -500, 500), {
    x: 0,
    y: TARGET_COORDINATE_MAX,
  });
});

test("scoreTargetEntry returns zero for an exact match", () => {
  const points = [
    { x: 10_000, y: 20_000 },
    { x: 30_000, y: 40_000 },
    { x: 50_000, y: 60_000 },
  ];
  const score = scoreTargetEntry({ entryId: "exact", points }, points);

  assert.equal(score.totalError, 0);
  assert.deepEqual(score.scenarioErrors, [0, 0, 0]);
});

test("compareTargetScores applies the published scenario 3 tie-break first", () => {
  const a = {
    entryId: "a",
    totalError: 0.3,
    scenarioErrors: [0.1, 0.15, 0.05],
  };
  const b = {
    entryId: "b",
    totalError: 0.3,
    scenarioErrors: [0.05, 0.1, 0.15],
  };

  assert.ok(compareTargetScores(a, b) < 0);
  assert.ok(compareTargetScores(b, a) > 0);
});

test("formatAttemptTime is stable at boundaries", () => {
  assert.equal(formatAttemptTime(1_200), "20:00");
  assert.equal(formatAttemptTime(61.9), "1:01");
  assert.equal(formatAttemptTime(-1), "0:00");
});

test("lay-up decision supplies one fixed shot rather than a club choice", () => {
  const layup = TARGET_SCENARIOS[2];
  const suppliedText = [...layup.playerFacts, ...layup.conditions, layup.question].join(" ");

  assert.match(suppliedText, /174 yards/);
  assert.match(suppliedText, /19 yards wide/);
  assert.doesNotMatch(suppliedText, /hybrid|\d-iron/i);
});

test("approach wind guide matches the written right-to-left condition", () => {
  const approach = TARGET_SCENARIOS[1];

  assert.match(approach.conditions.join(" "), /right-to-left/i);
  assert.equal(approach.windArrowDegrees, 180);
});
