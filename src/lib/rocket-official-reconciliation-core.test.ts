import assert from "node:assert/strict";
import test from "node:test";
import type { PgaTourPlayerRow } from "./pga-tour-leaderboard";
import { deriveRocketOfficialPlayerState } from "./rocket-official-reconciliation-core";

function official(
  overrides: Partial<PgaTourPlayerRow> = {},
): PgaTourPlayerRow {
  return {
    name: "Golfer",
    position: "1",
    playerState: "COMPLETE",
    rounds: [70, 70, 70, 70],
    withdrew: false,
    disqualified: false,
    madeCut: true,
    ...overrides,
  };
}

test("WD and DQ both complete the fantasy slot without conflating evidence", () => {
  assert.equal(
    deriveRocketOfficialPlayerState({
      currentWithdrew: false,
      currentMadeCut: null,
      official: official({ withdrew: true, playerState: "WITHDRAWN" }),
      hasAnyScore: true,
      finalizationReady: true,
    }).withdrew,
    true,
  );
  assert.equal(
    deriveRocketOfficialPlayerState({
      currentWithdrew: false,
      currentMadeCut: null,
      official: official({
        disqualified: true,
        playerState: "DISQUALIFIED",
      }),
      hasAnyScore: true,
      finalizationReady: true,
    }).withdrew,
    true,
  );
});

test("absence becomes DNS only with complete official evidence and no score", () => {
  assert.equal(
    deriveRocketOfficialPlayerState({
      currentWithdrew: false,
      currentMadeCut: null,
      official: undefined,
      hasAnyScore: false,
      finalizationReady: true,
    }).absentFinalStarter,
    true,
  );
  assert.equal(
    deriveRocketOfficialPlayerState({
      currentWithdrew: false,
      currentMadeCut: null,
      official: undefined,
      hasAnyScore: false,
      finalizationReady: false,
    }).absentFinalStarter,
    false,
  );
  assert.equal(
    deriveRocketOfficialPlayerState({
      currentWithdrew: false,
      currentMadeCut: null,
      official: undefined,
      hasAnyScore: true,
      finalizationReady: true,
    }).absentFinalStarter,
    false,
  );
});
