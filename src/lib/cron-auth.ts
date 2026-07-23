import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronHeader(
  authorization: string | null,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32) return false;
  const supplied = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
