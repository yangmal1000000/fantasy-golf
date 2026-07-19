import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * Push notification infrastructure.
 *
 * Requires VAPID keys in env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *
 * Generate with: npx web-push generate-vapid-keys
 *
 * Until keys are set, push is a no-op (graceful degradation).
 */

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@fantasygolf.com",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to all subscriptions belonging to a user.
 * Silently skips if VAPID keys aren't configured.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  try {
    const subs = await prisma.$queryRawUnsafe<
      { endpoint: string; p256dh: string; auth: string }[]
    >(
      `SELECT endpoint, p256dh, auth FROM "PushSubscription" WHERE "userId" = $1`,
      userId,
    );

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
      tag: payload.tag ?? "fantasy-golf",
    });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
          )
          .catch(async (err: unknown) => {
            // 410 / 404 → subscription is dead, remove it
            const statusCode =
              err && typeof err === "object" && "statusCode" in err
                ? (err as { statusCode: number }).statusCode
                : 0;
            if (statusCode === 410 || statusCode === 404) {
              await prisma.$executeRawUnsafe(
                `DELETE FROM "PushSubscription" WHERE endpoint = $1`,
                sub.endpoint,
              ).catch(() => {});
            }
          }),
      ),
    );
  } catch {
    // Push failures should never crash the calling code
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
