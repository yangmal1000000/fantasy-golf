import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOfficialTargets,
  isTargetJudgePanelMode,
  validateTargetJudgePanel,
  validateJudgeSubmission,
  type TargetJudgeSubmission,
} from "./target-judge-core";
import { TARGET_SCENARIOS, geometricMedianTarget } from "./target-challenge";

function submission(offset: number): TargetJudgeSubmission {
  return {
    marks: TARGET_SCENARIOS.map((scenario, index) => ({
      scenarioId: scenario.id,
      point: { x: 40_000 + offset + index * 1_000, y: 45_000 + offset + index * 1_000 },
      rationale: "A sufficiently detailed strategic explanation for this private judging rehearsal.",
    })),
  };
}

test("validates a complete three-scenario judge submission", () => {
  assert.deepEqual(validateJudgeSubmission(submission(0)), submission(0));
});

test("requires three distinct, identified panel members", () => {
  const panel = [1, 2, 3].map((seat) => ({
    email: `judge${seat}@example.com`,
    displayName: `Judge ${seat}`,
    credential: "PGA-qualified golf professional",
  }));
  assert.deepEqual(validateTargetJudgePanel(panel), panel);
  assert.throws(() => validateTargetJudgePanel(panel.slice(0, 2)), /Exactly three/);
  assert.throws(
    () => validateTargetJudgePanel([panel[0], panel[0], panel[2]]),
    /must be unique/,
  );
});

test("accepts only explicit official and coordinator-rehearsal panel modes", () => {
  assert.equal(isTargetJudgePanelMode("OFFICIAL"), true);
  assert.equal(isTargetJudgePanelMode("COORDINATOR_REHEARSAL"), true);
  assert.equal(isTargetJudgePanelMode("COORDINATOR_AS_PGA_JUDGE"), false);
});

test("rejects short rationales and duplicate scenarios", () => {
  const short = submission(0);
  short.marks[0].rationale = "Too short";
  assert.throws(() => validateJudgeSubmission(short), /between 40 and 1,000/);

  const duplicate = submission(0);
  duplicate.marks[1].scenarioId = duplicate.marks[0].scenarioId;
  assert.throws(() => validateJudgeSubmission(duplicate), /only once/);
});

test("geometric median uses rectangular map geometry and is order-independent", () => {
  const points = [
    { x: 20_000, y: 25_000 },
    { x: 60_000, y: 25_000 },
    { x: 50_000, y: 80_000 },
  ];
  const result = geometricMedianTarget(points);
  const reversed = geometricMedianTarget([...points].reverse());

  assert.deepEqual(result, reversed);
  assert.ok(result.x >= 40_000 && result.x <= 52_000);
  assert.ok(result.y >= 25_000 && result.y <= 50_000);
});

test("calculates one official target per scenario from exactly three judges", () => {
  const targets = calculateOfficialTargets([submission(-2_000), submission(0), submission(2_000)]);
  assert.deepEqual(targets, [
    { x: 40_000, y: 45_000 },
    { x: 41_000, y: 46_000 },
    { x: 42_000, y: 47_000 },
  ]);
  assert.throws(() => calculateOfficialTargets([submission(0)]), /Exactly three/);
});
