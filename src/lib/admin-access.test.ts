import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminPortalUser,
  normaliseAdminAccessEmail,
} from "./admin-access";

test("admin portal access is explicit, exact and case-insensitive", () => {
  assert.equal(isAdminPortalUser(" YANGMAL1000000@GMAIL.COM "), true);
  assert.equal(isAdminPortalUser(" RussGlenn2@Gmail.com "), true);
  assert.equal(isAdminPortalUser("russglenn2+other@gmail.com"), false);
  assert.equal(isAdminPortalUser("another@example.com"), false);
  assert.equal(isAdminPortalUser(null), false);
  assert.equal(
    normaliseAdminAccessEmail(" USER@Example.com "),
    "user@example.com",
  );
});
