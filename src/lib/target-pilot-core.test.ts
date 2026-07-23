import assert from "node:assert/strict";
import test from "node:test";
import { TARGET_SCENARIOS, type TargetPoint } from "./target-challenge";
import {
  rankTargetPilotEntries,
  targetPilotReference,
  targetPilotWinners,
  validateTargetPilotResults,
  validateTargetPilotSubmission,
  type TargetPilotSubmission,
} from "./target-pilot-core";

function submission(points: TargetPoint[]): TargetPilotSubmission {
  return {
    points: TARGET_SCENARIOS.map((scenario, index) => ({
      scenarioId: scenario.id,
      point: points[index],
    })),
  };
}

test("validates and canonicalises a complete pilot entry", () => {
  const input = submission([
    { x: 10_000, y: 20_000 },
    { x: 30_000, y: 40_000 },
    { x: 50_000, y: 60_000 },
  ]);
  assert.deepEqual(validateTargetPilotSubmission(input), input);

  const duplicate = structuredClone(input);
  duplicate.points[1].scenarioId = duplicate.points[0].scenarioId;
  assert.throws(() => validateTargetPilotSubmission(duplicate), /only once/);
});

test("ranks pilot entries by total distance", () => {
  const official = [
    { x: 20_000, y: 20_000 },
    { x: 40_000, y: 40_000 },
    { x: 60_000, y: 60_000 },
  ];
  const results = rankTargetPilotEntries([
    { entryId: "far", submission: submission(official.map((point) => ({ x: point.x + 5_000, y: point.y }))) },
    { entryId: "exact", submission: submission(official) },
  ], official);

  assert.deepEqual(results.entries.map((entry) => [entry.entryId, entry.rank]), [
    ["exact", 1],
    ["far", 2],
  ]);
  assert.deepEqual(validateTargetPilotResults(results), results);
});

test("applies Decision 3, then 2, then 1 to equal totals", () => {
  const official = [
    { x: 50_000, y: 50_000 },
    { x: 50_000, y: 50_000 },
    { x: 50_000, y: 50_000 },
  ];
  const results = rankTargetPilotEntries([
    {
      entryId: "better-third",
      submission: submission([
        { x: 60_000, y: 50_000 },
        { x: 50_000, y: 50_000 },
        { x: 50_000, y: 50_000 },
      ]),
    },
    {
      entryId: "worse-third",
      submission: submission([
        { x: 50_000, y: 50_000 },
        { x: 50_000, y: 50_000 },
        { x: 60_000, y: 50_000 },
      ]),
    },
  ], official);

  assert.deepEqual(results.entries.map((entry) => entry.entryId), ["better-third", "worse-third"]);
});

test("gives identical entries the same rank", () => {
  const official = TARGET_SCENARIOS.map(() => ({ x: 50_000, y: 50_000 }));
  const same = submission(TARGET_SCENARIOS.map(() => ({ x: 52_000, y: 50_000 })));
  const results = rankTargetPilotEntries([
    { entryId: "one", submission: same },
    { entryId: "two", submission: same },
  ], official);

  assert.deepEqual(results.entries.map((entry) => [entry.rank, entry.tied]), [[1, true], [1, true]]);
  assert.equal(targetPilotReference("cm1234567890"), "HV-PILOT-34567890");
});

test("identifies the confirmed winner or joint winners from rank one", () => {
  const official = TARGET_SCENARIOS.map(() => ({ x: 50_000, y: 50_000 }));
  const singleWinner = rankTargetPilotEntries([
    { entryId: "near", submission: submission(official) },
    { entryId: "far", submission: submission(TARGET_SCENARIOS.map(() => ({ x: 70_000, y: 70_000 }))) },
  ], official);
  assert.deepEqual(targetPilotWinners(singleWinner).map((entry) => entry.entryId), ["near"]);

  const same = submission(official);
  const jointWinners = rankTargetPilotEntries([
    { entryId: "one", submission: same },
    { entryId: "two", submission: same },
  ], official);
  assert.deepEqual(targetPilotWinners(jointWinners).map((entry) => entry.entryId), ["one", "two"]);
});
