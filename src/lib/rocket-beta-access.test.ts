import assert from "node:assert/strict";
import test from "node:test";
import {
  isRocketBetaFieldOpen,
  isRocketBetaRegistrationOpen,
} from "./rocket-beta-access";

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

test("a verified frozen field opens as soon as it is frozen", () => {
  assert.equal(
    isRocketBetaFieldOpen({
      fieldFrozenAt: "2026-07-27T19:55:00.000Z",
      fieldHash: "verified-field-hash",
    }),
    true,
  );
});

test("a malformed frozen timestamp never opens the field", () => {
  assert.equal(
    isRocketBetaFieldOpen({
      fieldFrozenAt: "not-a-date",
      fieldHash: "verified-field-hash",
    }),
    false,
  );
});

test("an expected time never opens an incomplete field", () => {
  const now = new Date("2026-07-27T21:00:00.000Z");
  assert.equal(
    isRocketBetaFieldOpen({
      fieldFrozenAt: null,
      fieldHash: "verified-field-hash",
    }),
    false,
  );
  assert.equal(
    isRocketBetaFieldOpen({
      fieldFrozenAt: now,
      fieldHash: null,
    }),
    false,
  );
});
