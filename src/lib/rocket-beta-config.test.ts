import assert from "node:assert/strict";
import test from "node:test";
import {
  ROCKET_BETA_ENTRY_OPENS_AT,
  ROCKET_BETA_FIELD_EXPECTED_AT,
  formatRocketBetaEntryDeadline,
} from "./rocket-beta-config";

test("Rocket field has one server-owned expected availability time", () => {
  assert.equal(
    ROCKET_BETA_FIELD_EXPECTED_AT.toISOString(),
    "2026-07-27T21:00:00.000Z",
  );
  assert.equal(ROCKET_BETA_ENTRY_OPENS_AT, ROCKET_BETA_FIELD_EXPECTED_AT);
});

test("public Rocket deadline stays tied to first tee until officially confirmed", () => {
  assert.equal(
    formatRocketBetaEntryDeadline({
      closesAt: "2026-07-30T10:45:00.000Z",
      confirmed: false,
    }),
    "At first tee",
  );
});

test("a confirmed Rocket deadline shows the verified local time", () => {
  assert.equal(
    formatRocketBetaEntryDeadline({
      closesAt: "2026-07-30T10:45:00.000Z",
      confirmed: true,
      timeZone: "Europe/London",
    }),
    "Thu 11:45",
  );
});
