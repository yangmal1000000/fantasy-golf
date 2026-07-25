const ADMIN_OWNER_EMAILS = new Set([
  "yangmal1000000@gmail.com",
]);

export function normaliseAdminEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isAdminOwner(email: string | null | undefined): boolean {
  return ADMIN_OWNER_EMAILS.has(normaliseAdminEmail(email));
}
