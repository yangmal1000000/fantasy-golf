import assert from "node:assert/strict";
import test from "node:test";
import { isAdminOwner, normaliseAdminEmail } from "./admin-owner";

test("admin owner matching is exact and case-insensitive", () => {
  assert.equal(isAdminOwner(" YANGMAL1000000@GMAIL.COM "), true);
  assert.equal(isAdminOwner("another@example.com"), false);
  assert.equal(isAdminOwner(null), false);
  assert.equal(normaliseAdminEmail(" USER@Example.com "), "user@example.com");
});
