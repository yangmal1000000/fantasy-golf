import type { AdminRoleName } from "@/lib/admin-roles";

const ADMIN_PORTAL_ROLES = new Map<string, AdminRoleName>([
  ["yangmal1000000@gmail.com", "OWNER"],
  ["russglenn2@gmail.com", "READ_ONLY"],
]);

export function normaliseAdminAccessEmail(
  email: string | null | undefined,
): string {
  return email?.trim().toLowerCase() ?? "";
}

/**
 * Edge-safe prefilter for protected admin routes.
 *
 * Server layouts and API guards must still verify User.isAdmin before reading
 * or changing admin data.
 */
export function isAdminPortalUser(email: string | null | undefined): boolean {
  return edgeAdminRoleForEmail(email) !== null;
}

export function edgeAdminRoleForEmail(
  email: string | null | undefined,
): AdminRoleName | null {
  return ADMIN_PORTAL_ROLES.get(normaliseAdminAccessEmail(email)) ?? null;
}

export function isEdgeAdminPathAllowed(
  email: string | null | undefined,
  pathname: string,
): boolean {
  const role = edgeAdminRoleForEmail(email);
  if (!role) return false;
  if (role === "OWNER" || role === "OPERATOR") return true;
  return (
    pathname === "/admin" ||
    pathname === "/admin/customers" ||
    pathname.startsWith("/admin/customers/")
  );
}

export function canEdgeOperateAdmin(
  email: string | null | undefined,
): boolean {
  const role = edgeAdminRoleForEmail(email);
  return role === "OWNER" || role === "OPERATOR";
}
