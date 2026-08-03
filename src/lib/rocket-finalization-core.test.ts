import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRocketFinalResult,
  overlayRocketFinalLeaderboard,
  rocketFinalResultMatchesLiveLeaderboard,
  verifyRocketFinalResult,
} from "./rocket-finalization-core";

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

test("a retrieved sealed result is rebuilt canonically before hash verification", () => {
  const sealed = buildRocketFinalResult({
    tournamentId: "rocket-classic",
    fieldVersion: "official-final-v1",
    fieldHash: "field-hash",
    finalizedAt: "2026-08-03T09:00:00.000Z",
    teams: [
      {
        teamId: "winner",
        teamName: "Winner",
        ownerName: "Owner",
        position: 1,
        totalStrokes: 1357,
        vsPar: -43,
        roundsScored: 20,
        estimatedRounds: 0,
      },
    ],
  });
  const jsonbStyleValue = {
    teams: sealed.result.teams.map((team) => ({
      tied: team.tied,
      vsPar: team.vsPar,
      teamId: team.teamId,
      position: team.position,
      teamName: team.teamName,
      ownerName: team.ownerName,
      roundsScored: team.roundsScored,
      totalStrokes: team.totalStrokes,
      estimatedRounds: team.estimatedRounds,
    })),
    version: sealed.result.version,
    fieldHash: sealed.result.fieldHash,
    finalizedAt: sealed.result.finalizedAt,
    tournamentId: sealed.result.tournamentId,
    fieldVersion: sealed.result.fieldVersion,
    scoringPolicy: sealed.result.scoringPolicy,
  };

  const verified = verifyRocketFinalResult({
    value: jsonbStyleValue,
    expectedHash: sealed.resultsHash,
    expectedTournamentId: "rocket-classic",
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.ok && verified.winners[0].teamId, "winner");
});

test("sealed result verification fails closed on any post-seal mutation", () => {
  const sealed = buildRocketFinalResult({
    tournamentId: "rocket-classic",
    fieldVersion: null,
    fieldHash: "field-hash",
    finalizedAt: "2026-08-03T09:00:00.000Z",
    teams: [
      {
        teamId: "winner",
        teamName: "Winner",
        ownerName: "Owner",
        position: 1,
        totalStrokes: 1357,
        vsPar: -43,
        roundsScored: 20,
        estimatedRounds: 0,
      },
    ],
  });
  const mutated = structuredClone(sealed.result);
  mutated.teams[0].vsPar = -44;

  assert.deepEqual(
    verifyRocketFinalResult({
      value: mutated,
      expectedHash: sealed.resultsHash,
      expectedTournamentId: "rocket-classic",
    }),
    { ok: false, issue: "Sealed result hash verification failed" },
  );
});

test("a final leaderboard ignores mutable live aggregate values", () => {
  const sealed = buildRocketFinalResult({
    tournamentId: "rocket-classic",
    fieldVersion: null,
    fieldHash: "field-hash",
    finalizedAt: "2026-08-03T09:00:00.000Z",
    teams: [
      {
        teamId: "winner",
        teamName: "Sealed winner",
        ownerName: "Sealed owner",
        position: 1,
        totalStrokes: 1357,
        vsPar: -43,
        roundsScored: 20,
        estimatedRounds: 4,
      },
    ],
  });
  const live = [
    {
      teamId: "winner",
      teamName: "Mutated name",
      ownerName: "Mutated owner",
      players: [],
      totalStrokes: 9999,
      vsPar: 99,
      roundsScored: 4,
      scoreState: "PROVISIONAL" as const,
      position: 15,
    },
  ];

  const displayed = overlayRocketFinalLeaderboard(live, sealed.result);
  assert.deepEqual(
    {
      teamName: displayed[0].teamName,
      ownerName: displayed[0].ownerName,
      totalStrokes: displayed[0].totalStrokes,
      vsPar: displayed[0].vsPar,
      roundsScored: displayed[0].roundsScored,
      position: displayed[0].position,
    },
    {
      teamName: "Sealed winner",
      ownerName: "Sealed owner",
      totalStrokes: 1357,
      vsPar: -43,
      roundsScored: 20,
      position: 1,
    },
  );
  assert.equal(
    rocketFinalResultMatchesLiveLeaderboard(live, sealed.result),
    false,
  );
});
