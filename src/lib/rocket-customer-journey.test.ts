import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRocketFinalRecap,
  formatPlacement,
  formatToPar,
} from "./rocket-customer-journey";
import type { RocketFinalResultV2 } from "./rocket-finalization-core";

const result: RocketFinalResultV2 = {
  version: "rocket-beta-result-v2",
  scoringPolicy: "relative-to-par-with-cut-and-withdrawal-estimates-v2",
  tournamentId: "rocket-classic",
  fieldVersion: "final",
  fieldHash: "field-hash",
  finalizedAt: "2026-08-03T09:00:00.000Z",
  teams: [
    {
      teamId: "winner",
      teamName: "Winner",
      ownerName: "A",
      position: 1,
      totalStrokes: 1357,
      vsPar: -43,
      roundsScored: 20,
      estimatedRounds: 0,
      tied: false,
    },
    {
      teamId: "mine",
      teamName: "Mine",
      ownerName: "B",
      position: 5,
      totalStrokes: 1375,
      vsPar: -25,
      roundsScored: 20,
      estimatedRounds: 4,
      tied: true,
    },
  ],
};

test("a sealed result becomes a personal final recap", () => {
  const recap = buildRocketFinalRecap(result, "mine");
  assert.equal(recap.teamCount, 2);
  assert.equal(recap.winners[0].teamName, "Winner");
  assert.equal(recap.winnerScore, "−43");
  assert.equal(recap.personalPlacement, "joint 5th");
  assert.equal(recap.personalScore, "−25");
  assert.equal(recap.shotsFromLead, 18);
});

test("anonymous visitors receive only the public final recap", () => {
  const recap = buildRocketFinalRecap(result, null);
  assert.equal(recap.personalTeam, null);
  assert.equal(recap.personalPlacement, null);
  assert.equal(recap.shotsFromLead, null);
});

test("placement and to-par copy handle golf edge cases", () => {
  assert.equal(formatPlacement(1, false), "1st");
  assert.equal(formatPlacement(2, true), "joint 2nd");
  assert.equal(formatPlacement(11, false), "11th");
  assert.equal(formatPlacement(23, false), "23rd");
  assert.equal(formatToPar(0), "E");
  assert.equal(formatToPar(3), "+3");
  assert.equal(formatToPar(-7), "−7");
});
