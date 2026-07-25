export const ADMIN_ROLES = [
  "OWNER",
  "OPERATOR",
  "SUPPORT",
  "READ_ONLY",
] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

export const ADMIN_CAPABILITIES = [
  "VIEW_DASHBOARD",
  "VIEW_CUSTOMERS",
  "VIEW_OPERATIONS",
  "REVEAL_CUSTOMER_PII",
  "OPERATE_TOURNAMENT",
  "MANAGE_ADMINS",
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<
  AdminRoleName,
  ReadonlySet<AdminCapability>
> = {
  OWNER: new Set(ADMIN_CAPABILITIES),
  OPERATOR: new Set([
    "VIEW_DASHBOARD",
    "VIEW_CUSTOMERS",
    "VIEW_OPERATIONS",
    "OPERATE_TOURNAMENT",
  ]),
  SUPPORT: new Set(["VIEW_DASHBOARD", "VIEW_CUSTOMERS"]),
  READ_ONLY: new Set(["VIEW_DASHBOARD", "VIEW_CUSTOMERS"]),
};

export const ADMIN_ROLE_LABELS: Record<AdminRoleName, string> = {
  OWNER: "Owner",
  OPERATOR: "Operator",
  SUPPORT: "Support",
  READ_ONLY: "Read-only",
};

export function isAdminRole(value: unknown): value is AdminRoleName {
  return (
    typeof value === "string" &&
    ADMIN_ROLES.includes(value as AdminRoleName)
  );
}

export function hasAdminCapability(
  role: AdminRoleName,
  capability: AdminCapability,
): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function maskAdminEmail(email: string): string {
  const normalised = email.trim().toLowerCase();
  const separator = normalised.indexOf("@");
  if (separator <= 0) return "hidden";
  const local = normalised.slice(0, separator);
  const domain = normalised.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
