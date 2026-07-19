"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and sets up push subscription.
 * Renders nothing — runs as a side-effect on mount.
 *
 * Flow:
 * 1. Register /sw-push.js
 * 2. Wait for Notification permission (granted by NotificationBell)
 * 3. Subscribe via PushManager
 * 4. POST subscription to /api/push/subscribe
 */
export default function PushRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only proceed if service workers and push are supported
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let subscribed = false;

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register("/sw-push.js", {
          scope: "/",
        });
        await navigator.serviceWorker.ready;

        // Check if we already have a subscription
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Re-sync to server in case it was lost
          await sendSubscription(existing);
          return;
        }

        // Only auto-subscribe if permission is already granted
        if (window.Notification?.permission !== "granted") return;

        const vapidKey = await fetchVapidKey();
        if (!vapidKey) return; // VAPID not configured yet

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        await sendSubscription(sub);
      } catch {
        // SW registration or push failure — not critical
      }
    }

    async function sendSubscription(sub: PushSubscription) {
      if (subscribed) return;
      subscribed = true;
      try {
        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys?.p256dh,
              auth: json.keys?.auth,
            },
          }),
        });
      } catch {
        // non-critical
      }
    }

    async function fetchVapidKey(): Promise<string | null> {
      try {
        const res = await fetch("/api/push/vapid-key");
        if (!res.ok) return null;
        const data = await res.json();
        return data.publicKey ?? null;
      } catch {
        return null;
      }
    }

    register();

    // Re-attempt subscription when NotificationBell grants permission
    function onPermissionGranted() {
      subscribed = false;
      register();
    }
    window.addEventListener("notification-permission-granted", onPermissionGranted);

    return () => {
      window.removeEventListener("notification-permission-granted", onPermissionGranted);
    };
  }, []);

  return null;
}
