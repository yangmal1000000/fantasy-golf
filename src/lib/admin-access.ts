const ADMIN_PORTAL_EMAILS = new Set([
  "yangmal1000000@gmail.com",
  "russglenn2@gmail.com",
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
  return ADMIN_PORTAL_EMAILS.has(normaliseAdminAccessEmail(email));
}
