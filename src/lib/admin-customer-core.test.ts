import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCustomerAccess,
  deriveCustomerStage,
  isDemoCustomer,
  latestRecordedAt,
  type CustomerLifecycleInput,
} from "./admin-customer-core";

const BASE: CustomerLifecycleInput = {
  isOwner: false,
  isRocketMember: false,
  memberActive: null,
  targetSubmittedAt: null,
  passStatus: null,
  passUnlockedAt: null,
  draftUpdatedAt: null,
  passRedeemedAt: null,
  hasOfficialTeam: false,
};

test("customer stages use the furthest verified Rocket milestone", () => {
  assert.equal(deriveCustomerStage(BASE), "account_only");
  assert.equal(
    deriveCustomerStage({ ...BASE, isRocketMember: true, memberActive: true }),
    "rocket_joined",
  );
  assert.equal(
    deriveCustomerStage({
      ...BASE,
      isRocketMember: true,
      targetSubmittedAt: new Date("2026-07-25T09:00:00Z"),
    }),
    "target_complete",
  );
  assert.equal(
    deriveCustomerStage({
      ...BASE,
      isRocketMember: true,
      passUnlockedAt: new Date("2026-07-25T09:05:00Z"),
    }),
    "test_pass",
  );
  assert.equal(
    deriveCustomerStage({
      ...BASE,
      isRocketMember: true,
      draftUpdatedAt: new Date("2026-07-25T09:10:00Z"),
    }),
    "draft_saved",
  );
  assert.equal(
    deriveCustomerStage({
      ...BASE,
      isRocketMember: true,
      draftUpdatedAt: new Date("2026-07-25T09:10:00Z"),
      hasOfficialTeam: true,
    }),
    "official_team",
  );
});

test("customer access separates owner, inactive and revoked accounts", () => {
  assert.equal(deriveCustomerAccess({ ...BASE, isOwner: true }), "owner");
  assert.equal(deriveCustomerAccess(BASE), "account");
  assert.equal(
    deriveCustomerAccess({ ...BASE, isRocketMember: true, memberActive: false }),
    "deactivated",
  );
  assert.equal(
    deriveCustomerAccess({
      ...BASE,
      isRocketMember: true,
      memberActive: true,
      passStatus: "REVOKED",
    }),
    "revoked",
  );
  assert.equal(
    deriveCustomerAccess({ ...BASE, isRocketMember: true, memberActive: true }),
    "active",
  );
});

test("demo detection and recorded activity are deterministic", () => {
  assert.equal(isDemoCustomer(" DEMO@fantasygolf.com "), true);
  assert.equal(isDemoCustomer("person@example.com"), false);
  assert.equal(
    latestRecordedAt(
      new Date("2026-07-24T12:00:00Z"),
      null,
      new Date("2026-07-25T12:00:00Z"),
    ).toISOString(),
    "2026-07-25T12:00:00.000Z",
  );
});
