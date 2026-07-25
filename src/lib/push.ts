import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import {
  beginOperationalRun,
  completeOperationalRun,
} from "@/lib/operational-jobs";

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
export interface PushDeliveryResult {
  configured: boolean;
  subscriptions: number;
  delivered: number;
  failed: number;
  removed: number;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushDeliveryResult> {
  const run = await beginOperationalRun(
    {
      key: "push-delivery",
      name: "Push delivery",
      source: "web-push",
    },
    "notification",
  );
  if (!ensureConfigured()) {
    await completeOperationalRun(run, {
      status: "SKIPPED",
      summary: "VAPID is not configured",
    });
    return {
      configured: false,
      subscriptions: 0,
      delivered: 0,
      failed: 0,
      removed: 0,
    };
  }

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

    if (subs.length === 0) {
      await completeOperationalRun(run, {
        status: "SKIPPED",
        summary: "No push subscription for this delivery",
      });
      return {
        configured: true,
        subscriptions: 0,
        delivered: 0,
        failed: 0,
        removed: 0,
      };
    }

    const outcomes = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
          );
          return "delivered" as const;
        } catch (err: unknown) {
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? (err as { statusCode: number }).statusCode
              : 0;
          if (statusCode === 410 || statusCode === 404) {
            await prisma
              .$executeRawUnsafe(
                `DELETE FROM "PushSubscription" WHERE endpoint = $1`,
                sub.endpoint,
              )
              .catch(() => {});
            return "removed" as const;
          }
          return "failed" as const;
        }
      }),
    );
    const delivered = outcomes.filter((outcome) => outcome === "delivered").length;
    const failed = outcomes.filter((outcome) => outcome === "failed").length;
    const removed = outcomes.filter((outcome) => outcome === "removed").length;
    await completeOperationalRun(run, {
      status: failed > 0 ? "FAILED" : "SUCCESS",
      recordsProcessed: subs.length,
      summary: `${delivered}/${subs.length} delivered · ${removed} expired removed`,
      errorSummary:
        failed > 0 ? `${failed} push delivery attempt(s) failed` : undefined,
    });
    return {
      configured: true,
      subscriptions: subs.length,
      delivered,
      failed,
      removed,
    };
  } catch {
    await completeOperationalRun(run, {
      status: "FAILED",
      errorSummary: "Push delivery infrastructure failed",
    });
    return {
      configured: true,
      subscriptions: 0,
      delivered: 0,
      failed: 1,
      removed: 0,
    };
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
