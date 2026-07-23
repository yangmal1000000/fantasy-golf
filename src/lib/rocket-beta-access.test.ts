import assert from "node:assert/strict";
import test from "node:test";
import { isRocketBetaRegistrationOpen } from "./rocket-beta-access";

const close = new Date("2026-07-30T10:45:00.000Z");

test("open registration accepts a verified account before the deadline", () => {
  assert.equal(
    isRocketBetaRegistrationOpen({
      status: "OPEN",
      entryClosesAt: close,
      now: new Date("2026-07-30T10:44:59.999Z"),
    }),
    true,
  );
});

test("registration closes exactly at the deadline", () => {
  assert.equal(
    isRocketBetaRegistrationOpen({
      status: "OPEN",
      entryClosesAt: close,
      now: close,
    }),
    false,
  );
});

test("paused and final campaigns never self-enrol new accounts", () => {
  assert.equal(
    isRocketBetaRegistrationOpen({
      status: "PAUSED",
      entryClosesAt: close,
      now: new Date("2026-07-29T12:00:00.000Z"),
    }),
    false,
  );
  assert.equal(
    isRocketBetaRegistrationOpen({
      status: "FINAL",
      entryClosesAt: null,
      now: new Date("2026-07-29T12:00:00.000Z"),
    }),
    false,
  );
});
