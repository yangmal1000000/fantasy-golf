export const CUSTOMER_STAGE_OPTIONS = [
  "official_team",
  "draft_saved",
  "test_pass",
  "target_complete",
  "rocket_joined",
  "account_only",
] as const;

export type CustomerStage = (typeof CUSTOMER_STAGE_OPTIONS)[number];

export type CustomerAccess = "owner" | "active" | "deactivated" | "revoked" | "account";

export interface CustomerLifecycleInput {
  isOwner: boolean;
  isRocketMember: boolean;
  memberActive: boolean | null;
  targetSubmittedAt: Date | null;
  passStatus: string | null;
  passUnlockedAt: Date | null;
  draftUpdatedAt: Date | null;
  passRedeemedAt: Date | null;
  hasOfficialTeam: boolean;
}

export const CUSTOMER_STAGE_LABELS: Record<CustomerStage, string> = {
  official_team: "Official team",
  draft_saved: "Draft saved",
  test_pass: "Test Pass",
  target_complete: "Target complete",
  rocket_joined: "Rocket joined",
  account_only: "Account only",
};

export const CUSTOMER_ACCESS_LABELS: Record<CustomerAccess, string> = {
  owner: "Owner",
  active: "Active",
  deactivated: "Deactivated",
  revoked: "Pass revoked",
  account: "Account",
};

export function deriveCustomerStage(input: CustomerLifecycleInput): CustomerStage {
  if (input.hasOfficialTeam || input.passRedeemedAt) return "official_team";
  if (input.draftUpdatedAt) return "draft_saved";
  if (input.passUnlockedAt || input.passStatus === "UNLOCKED") return "test_pass";
  if (input.targetSubmittedAt) return "target_complete";
  if (input.isRocketMember) return "rocket_joined";
  return "account_only";
}

export function deriveCustomerAccess(input: CustomerLifecycleInput): CustomerAccess {
  if (input.isOwner) return "owner";
  if (!input.isRocketMember) return "account";
  if (input.memberActive === false) return "deactivated";
  if (input.passStatus === "REVOKED") return "revoked";
  return "active";
}

export function isDemoCustomer(email: string): boolean {
  return email.trim().toLowerCase() === "demo@fantasygolf.com";
}

export function latestRecordedAt(...dates: Array<Date | null | undefined>): Date {
  const timestamps = dates
    .filter((date): date is Date => date instanceof Date)
    .map((date) => date.getTime());
  return new Date(Math.max(...timestamps));
}
