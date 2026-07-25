import assert from "node:assert/strict";
import test from "node:test";
import {
  canEdgeOperateAdmin,
  edgeAdminRoleForEmail,
  isEdgeAdminPathAllowed,
  isAdminPortalUser,
  normaliseAdminAccessEmail,
} from "./admin-access";

test("admin portal access is explicit, exact and case-insensitive", () => {
  assert.equal(isAdminPortalUser(" YANGMAL1000000@GMAIL.COM "), true);
  assert.equal(isAdminPortalUser(" RussGlenn2@Gmail.com "), true);
  assert.equal(isAdminPortalUser("russglenn2+other@gmail.com"), false);
  assert.equal(isAdminPortalUser("another@example.com"), false);
  assert.equal(isAdminPortalUser(null), false);
  assert.equal(edgeAdminRoleForEmail("yangmal1000000@gmail.com"), "OWNER");
  assert.equal(edgeAdminRoleForEmail("russglenn2@gmail.com"), "READ_ONLY");
  assert.equal(
    isEdgeAdminPathAllowed("russglenn2@gmail.com", "/admin/customers"),
    true,
  );
  assert.equal(
    isEdgeAdminPathAllowed("russglenn2@gmail.com", "/admin/tournaments"),
    false,
  );
  assert.equal(canEdgeOperateAdmin("russglenn2@gmail.com"), false);
  assert.equal(canEdgeOperateAdmin("yangmal1000000@gmail.com"), true);
  assert.equal(
    normaliseAdminAccessEmail(" USER@Example.com "),
    "user@example.com",
  );
});
