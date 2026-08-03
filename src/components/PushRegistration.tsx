"use client";

import { useEffect } from "react";
import { syncCurrentBrowserPush } from "@/lib/browser-push";

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

    if (window.Notification?.permission === "granted") {
      void syncCurrentBrowserPush();
    }

    // Re-attempt subscription when NotificationBell grants permission
    function onPermissionGranted() {
      void syncCurrentBrowserPush({ explicit: true });
    }
    window.addEventListener("notification-permission-granted", onPermissionGranted);

    return () => {
      window.removeEventListener("notification-permission-granted", onPermissionGranted);
    };
  }, []);

  return null;
}
