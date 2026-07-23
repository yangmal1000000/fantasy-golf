import assert from "node:assert/strict";
import test from "node:test";
import { deriveLiveTournamentState } from "./live-sync-state";

test("scheduled events do not change the tournament lifecycle", () => {
  assert.equal(
    deriveLiveTournamentState({
      eventState: "pre",
      completed: false,
      currentRound: 0,
    }),
    null,
  );
});

test("an active ESPN event advances the tournament and clamps its round", () => {
  assert.deepEqual(
    deriveLiveTournamentState({
      eventState: "in",
      completed: false,
      currentRound: 0,
    }),
    { status: "in_progress", currentRound: 1 },
  );
  assert.deepEqual(
    deriveLiveTournamentState({
      eventState: "in",
      completed: false,
      currentRound: 7,
    }),
    { status: "in_progress", currentRound: 4 },
  );
});

test("a completed ESPN event advances the tournament to final", () => {
  assert.deepEqual(
    deriveLiveTournamentState({
      eventState: "post",
      completed: true,
      currentRound: 4,
    }),
    { status: "completed", currentRound: 4 },
  );
});
