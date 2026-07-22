import assert from "node:assert/strict";
import test from "node:test";
import {
  isTargetJudgeCoordinator,
  normaliseTargetEmail,
} from "./target-judge-access";

test("normalises judge emails without broadening access", () => {
  assert.equal(normaliseTargetEmail("  Judge@Example.COM "), "judge@example.com");
  assert.equal(normaliseTargetEmail(null), "");
});

test("coordinator access is restricted to Harry's verified account", () => {
  assert.equal(isTargetJudgeCoordinator("yangmal1000000@gmail.com"), true);
  assert.equal(isTargetJudgeCoordinator(" YANGMAL1000000@gmail.com "), true);
  assert.equal(isTargetJudgeCoordinator("russglenn2@gmail.com"), false);
  assert.equal(isTargetJudgeCoordinator("judge@example.com"), false);
});
