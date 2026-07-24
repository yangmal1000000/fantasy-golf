import assert from "node:assert/strict";
import test from "node:test";
import {
  ROCKET_BETA_ENTRY_OPENS_AT,
  formatRocketBetaEntryDeadline,
} from "./rocket-beta-config";

test("Rocket team entry has one server-owned scheduled opening", () => {
  assert.equal(
    ROCKET_BETA_ENTRY_OPENS_AT.toISOString(),
    "2026-07-28T08:00:00.000Z",
  );
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
