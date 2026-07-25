import assert from "node:assert/strict";
import test from "node:test";
import {
  hasAdminCapability,
  isAdminRole,
  maskAdminEmail,
} from "./admin-roles";

test("admin roles expose only their intended capabilities", () => {
  assert.equal(hasAdminCapability("OWNER", "MANAGE_ADMINS"), true);
  assert.equal(hasAdminCapability("OPERATOR", "OPERATE_TOURNAMENT"), true);
  assert.equal(hasAdminCapability("SUPPORT", "VIEW_CUSTOMERS"), true);
  assert.equal(hasAdminCapability("SUPPORT", "REVEAL_CUSTOMER_PII"), false);
  assert.equal(hasAdminCapability("READ_ONLY", "OPERATE_TOURNAMENT"), false);
});

test("admin roles and masked emails are deterministic", () => {
  assert.equal(isAdminRole("OWNER"), true);
  assert.equal(isAdminRole("ADMIN"), false);
  assert.equal(maskAdminEmail("RussGlenn2@gmail.com"), "ru********@gmail.com");
  assert.equal(maskAdminEmail("a@example.com"), "a***@example.com");
});
