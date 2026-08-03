"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BellIcon, CheckCircleIcon, ShieldIcon } from "@/components/icons";
import {
  browserPushSupported,
  syncCurrentBrowserPush,
  unsubscribeCurrentBrowserPush,
  type BrowserPushState,
} from "@/lib/browser-push";

type ViewState = BrowserPushState | "checking" | "working";

export default function NextEventNotificationOptIn() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [state, setState] = useState<ViewState>("checking");

  useEffect(() => {
    let active = true;
    if (loading || !user) return () => undefined;

    void syncCurrentBrowserPush().then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, [loading, user]);

  const viewState: ViewState = loading
    ? "checking"
    : user
      ? state
      : "signed-out";

  async function enableAlerts() {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    if (!browserPushSupported()) {
      setState("unsupported");
      return;
    }

    setState("working");
    try {
      let permission = window.Notification.permission;
      if (permission === "default") {
        permission = await window.Notification.requestPermission();
      }
      if (permission !== "granted") {
        setState(
          permission === "denied"
            ? "permission-denied"
            : "permission-required",
        );
        return;
      }

      setState(await syncCurrentBrowserPush({ explicit: true }));
    } catch {
      setState("failed");
    }
  }

  async function disableAlerts() {
    setState("working");
    setState(await unsubscribeCurrentBrowserPush());
  }

  const subscribed = viewState === "subscribed";
  const disabled = viewState === "checking" || viewState === "working";

  return (
    <section className="rounded-3xl border border-[#c8a951]/45 bg-white p-5 shadow-sm dark:border-[#c8a951]/25 dark:bg-zinc-900 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0a3d2a] text-[#e4cc85]">
          {subscribed ? (
            <CheckCircleIcon className="h-6 w-6" />
          ) : (
            <BellIcon className="h-6 w-6" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9b7b25] dark:text-[#d7bc6a]">
            Optional browser alert
          </p>
          <h2 className="mt-1 text-xl font-black text-zinc-900 dark:text-white">
            {subscribed
              ? "Event alerts are on for this browser"
              : "Know when the next test opens"}
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300" aria-live="polite">
        {notificationMessage(viewState)}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {subscribed ? (
          <button
            type="button"
            onClick={disableAlerts}
            disabled={disabled}
            className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:border-zinc-400 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
          >
            Turn off on this browser
          </button>
        ) : viewState !== "unsupported" && viewState !== "permission-denied" ? (
          <button
            type="button"
            onClick={enableAlerts}
            disabled={disabled}
            className="min-h-11 rounded-xl bg-[#c8a951] px-4 py-2.5 text-sm font-black text-[#17251d] transition hover:bg-[#d7bc6a] disabled:opacity-60"
          >
            {viewState === "signed-out"
              ? "Sign in to get alerts"
              : viewState === "working"
                ? "Checking this browser…"
                : viewState === "ready"
                  ? "Turn event alerts back on"
                  : "Enable event alerts"}
          </button>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <ShieldIcon className="h-4 w-4" /> No alert is sent now
        </span>
      </div>
    </section>
  );
}

function notificationMessage(state: ViewState) {
  switch (state) {
    case "checking":
      return "Checking whether this browser is ready for Fantasy Golf alerts.";
    case "working":
      return "Finishing the browser subscription. Keep this page open for a moment.";
    case "signed-out":
      return "Sign in first so this browser subscription belongs only to your Fantasy Golf account.";
    case "unsupported":
      return "This browser does not support web push. You can still return to this page for the next event announcement.";
    case "permission-denied":
      return "Notifications are blocked in this browser's settings. Fantasy Golf cannot override that choice.";
    case "unconfigured":
      return "Event alerts are temporarily unavailable. Nothing was subscribed; you can still use this page normally.";
    case "failed":
      return "We could not finish the subscription. Nothing changed; try again when your connection is stable.";
    case "subscribed":
      return "This browser can receive Fantasy Golf event-opening and entry-deadline alerts. You can turn it off here at any time.";
    case "ready":
      return "Browser permission is available, but event alerts are currently off on this browser.";
    default:
      return "Enable alerts only if you want browser notifications about a future test flight.";
  }
}
