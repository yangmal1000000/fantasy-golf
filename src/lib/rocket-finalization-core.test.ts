import assert from "node:assert/strict";
import test from "node:test";
import { buildRocketFinalResult } from "./rocket-finalization-core";

test("sealed Rocket results include estimated rounds and stable tie state", () => {
  const input = {
    tournamentId: "rocket-classic",
    fieldVersion: "official-final-v1",
    fieldHash: "field-hash",
    finalizedAt: "2026-08-03T09:00:00.000Z",
    teams: [
      {
        teamId: "one",
        teamName: "One",
        ownerName: "A",
        position: 1,
        totalStrokes: 1375,
        vsPar: -25,
        roundsScored: 20,
        estimatedRounds: 0,
      },
      {
        teamId: "two",
        teamName: "Two",
        ownerName: "B",
        position: 1,
        totalStrokes: 1375,
        vsPar: -25,
        roundsScored: 20,
        estimatedRounds: 4,
      },
    ],
  };
  const first = buildRocketFinalResult(input);
  const second = buildRocketFinalResult(input);

  assert.equal(first.resultsHash, second.resultsHash);
  assert.equal(first.result.teams[0].tied, true);
  assert.equal(first.result.teams[1].estimatedRounds, 4);
});
