import { timingSafeEqual } from "node:crypto";

export function isAuthorizedOpsHeartbeat(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const presented = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const presentedBuffer = Buffer.from(presented);
  return (
    presentedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(presentedBuffer, expectedBuffer)
  );
}
