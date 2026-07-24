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

test("a frozen field stays closed until the scheduled opening", () => {
  assert.equal(
    isRocketBetaFieldOpen({
      entryOpensAt: "2026-07-28T08:00:00.000Z",
      fieldFrozenAt: "2026-07-28T07:55:00.000Z",
      fieldHash: "verified-field-hash",
      now: new Date("2026-07-28T07:59:59.999Z"),
    }),
    false,
  );
});

test("a verified frozen field opens exactly at the scheduled time", () => {
  const opensAt = new Date("2026-07-28T08:00:00.000Z");
  assert.equal(
    isRocketBetaFieldOpen({
      entryOpensAt: opensAt,
      fieldFrozenAt: "2026-07-28T07:55:00.000Z",
      fieldHash: "verified-field-hash",
      now: opensAt,
    }),
    true,
  );
});

test("the scheduled time never opens an incomplete field", () => {
  const now = new Date("2026-07-28T08:00:00.000Z");
  assert.equal(
    isRocketBetaFieldOpen({
      entryOpensAt: now,
      fieldFrozenAt: null,
      fieldHash: "verified-field-hash",
      now,
    }),
    false,
  );
  assert.equal(
    isRocketBetaFieldOpen({
      entryOpensAt: now,
      fieldFrozenAt: now,
      fieldHash: null,
      now,
    }),
    false,
  );
});
