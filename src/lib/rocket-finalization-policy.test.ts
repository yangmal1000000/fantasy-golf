import assert from "node:assert/strict";
import test from "node:test";
import {
  isRocketOfficialFinalizationEvidenceValid,
  type RocketOfficialFinalizationEvidence,
} from "./rocket-finalization";
import { ROCKET_OFFICIAL_LEADERBOARD_URL } from "./rocket-official-config";

const validEvidence: RocketOfficialFinalizationEvidence = {
  ok: true,
  finalizationReady: true,
  source: ROCKET_OFFICIAL_LEADERBOARD_URL,
  leaderboardId: "R2026524",
  tournamentStatus: "COMPLETED",
  evidenceHash: "a".repeat(64),
  fieldPlayers: 147,
  matchedFieldPlayers: 146,
  requiredMatches: 142,
};

test("verified completed official evidence permits finalization", () => {
  assert.equal(isRocketOfficialFinalizationEvidenceValid(validEvidence), true);
});

test("missing, partial and non-completed official evidence fail closed", () => {
  assert.equal(isRocketOfficialFinalizationEvidenceValid(null), false);
  assert.equal(
    isRocketOfficialFinalizationEvidenceValid({
      ...validEvidence,
      matchedFieldPlayers: 100,
    }),
    false,
  );
  assert.equal(
    isRocketOfficialFinalizationEvidenceValid({
      ...validEvidence,
      finalizationReady: false,
      tournamentStatus: "IN_PROGRESS",
    }),
    false,
  );
  assert.equal(
    isRocketOfficialFinalizationEvidenceValid({
      ...validEvidence,
      evidenceHash: null,
    }),
    false,
  );
  assert.equal(
    isRocketOfficialFinalizationEvidenceValid({
      ...validEvidence,
      leaderboardId: "wrong-event",
    }),
    false,
  );
  assert.equal(
    isRocketOfficialFinalizationEvidenceValid({
      ...validEvidence,
      source: "https://example.com/lookalike",
    }),
    false,
  );
});
