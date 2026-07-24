import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseNearestRankReserve,
  parseRocketDraft,
  reconcileRocketDraft,
  type RocketDraft,
  type RocketReserveCandidate,
} from "./rocket-draft";

const tiers = ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS"];

function candidate(
  playerId: string,
  tier: string,
  rank: number | null,
): RocketReserveCandidate {
  return { playerId, playerName: playerId, tier, rank };
}

function draft(): RocketDraft {
  return {
    schemaVersion: 1,
    tournamentId: "rocket-classic",
    teamName: "Weekend Draft",
    fieldVersion: "initial",
    fieldHash: "initial-hash",
    status: "PROVISIONAL",
    savedAt: "2026-07-24T22:15:00.000Z",
    picks: tiers.map((tier, index) =>
      candidate(`original-${index}`, tier, [5, 15, 25, 40, 80][index]),
    ),
  };
}

test("nearest reserve prefers the next lower-ranked golfer on an equal distance", () => {
  const replacement = chooseNearestRankReserve(
    { playerId: "removed", rank: 80 },
    [
      candidate("rank-79", "T51_PLUS", 79),
      candidate("rank-81", "T51_PLUS", 81),
      candidate("rank-84", "T51_PLUS", 84),
    ],
  );
  assert.equal(replacement?.playerId, "rank-81");
});

test("nearest reserve uses the closest higher-ranked golfer when none is below", () => {
  const replacement = chooseNearestRankReserve(
    { playerId: "removed", rank: 80 },
    [
      candidate("rank-75", "T51_PLUS", 75),
      candidate("rank-79", "T51_PLUS", 79),
    ],
  );
  assert.equal(replacement?.playerId, "rank-79");
});

test("an unranked selection prefers another unranked reserve deterministically", () => {
  const replacement = chooseNearestRankReserve(
    { playerId: "removed", rank: null },
    [
      candidate("rank-140", "T51_PLUS", 140),
      candidate("z-player", "T51_PLUS", null),
      candidate("a-player", "T51_PLUS", null),
    ],
  );
  assert.equal(replacement?.playerId, "a-player");
});

test("final reconciliation preserves valid picks and replaces only an invalid tier", () => {
  const input = draft();
  const roster = [
    ...input.picks.slice(0, 4),
    candidate("rank-79", "T51_PLUS", 79),
    candidate("rank-81", "T51_PLUS", 81),
  ];
  const result = reconcileRocketDraft(input, roster, {
    fieldVersion: "final",
    fieldHash: "final-hash",
    reconciledAt: "2026-07-27T20:10:00.000Z",
  });
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].oldPlayerId, "original-4");
  assert.equal(result.changes[0].newPlayerId, "rank-81");
  assert.deepEqual(
    result.draft.picks.slice(0, 4).map((pick) => pick.playerId),
    input.picks.slice(0, 4).map((pick) => pick.playerId),
  );
  assert.equal(result.draft.status, "FINAL_RECONCILED");
});

test("field-relative re-tiering replaces a moved boundary pick within its original slot", () => {
  const input = draft();
  const roster = [
    input.picks[0],
    { ...input.picks[1], tier: "T1_10" },
    candidate("rank-16", "T11_20", 16),
    ...input.picks.slice(2),
  ];
  const result = reconcileRocketDraft(input, roster, {
    fieldVersion: "final",
    fieldHash: "final-hash",
    reconciledAt: "2026-07-27T20:10:00.000Z",
  });

  assert.deepEqual(result.changes, [
    {
      tier: "T11_20",
      oldPlayerId: "original-1",
      oldPlayerName: "original-1",
      oldRank: 15,
      newPlayerId: "rank-16",
      newPlayerName: "rank-16",
      newRank: 16,
      reason: "TIER_CHANGED",
    },
  ]);
  assert.equal(result.draft.picks[1].tier, "T11_20");
  assert.equal(result.draft.picks[1].playerId, "rank-16");
});

test("draft parser rejects missing tiers and duplicate players", () => {
  const valid = draft();
  assert.ok(parseRocketDraft(valid));
  assert.equal(
    parseRocketDraft({ ...valid, picks: valid.picks.slice(0, 4) }),
    null,
  );
  assert.equal(
    parseRocketDraft({
      ...valid,
      picks: valid.picks.map((pick) => ({
        ...pick,
        playerId: valid.picks[0].playerId,
      })),
    }),
    null,
  );
});
