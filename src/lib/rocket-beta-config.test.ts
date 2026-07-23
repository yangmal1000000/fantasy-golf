import assert from "node:assert/strict";
import test from "node:test";
import { formatRocketBetaEntryDeadline } from "./rocket-beta-config";

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
