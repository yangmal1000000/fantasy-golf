const TARGET_PREVIEW_EMAILS = new Set(["yangmal1000000@gmail.com"]);

export function isTargetPreviewAllowed(email: string | null | undefined) {
  return TARGET_PREVIEW_EMAILS.has(email?.trim().toLowerCase() ?? "");
}
