import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedCronHeader } from "./cron-auth";

const secret = "a".repeat(32);

test("accepts the exact Vercel cron bearer token", () => {
  assert.equal(isAuthorizedCronHeader(`Bearer ${secret}`, secret), true);
});

test("rejects absent, short and mismatched cron secrets", () => {
  assert.equal(isAuthorizedCronHeader(null, secret), false);
  assert.equal(isAuthorizedCronHeader(`Bearer ${secret}`, "short"), false);
  assert.equal(isAuthorizedCronHeader(`Bearer ${"b".repeat(32)}`, secret), false);
});
