"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChartBarIcon, GolfFlagIcon, FinishFlagIcon, ClockIcon, ChatIcon, TrophyIcon, InfoIcon, BellIcon } from "@/components/icons";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  position_change: <ChartBarIcon className="h-4 w-4" />,
  score_update: <GolfFlagIcon className="h-4 w-4" />,
  round_complete: <FinishFlagIcon className="h-4 w-4" />,
  entries_closing: <ClockIcon className="h-4 w-4" />,
  league_message: <ChatIcon className="h-4 w-4" />,
  achievement: <TrophyIcon className="h-4 w-4" />,
  deadline: <ClockIcon className="h-4 w-4" />,
  info: <InfoIcon className="h-4 w-4" />,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushSupported] = useState(
    () => typeof window !== "undefined" && "Notification" in window,
  );
  const [pushEnabled, setPushEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      window.Notification.permission === "granted",
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotificationsData = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) return await res.json();
    } catch {
      // silently ignore
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await fetchNotificationsData();
      if (!active || !data) return;
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);

      // Fire browser notification for the most recent unread notification
      // if permission is granted and tab is hidden
      if (
        typeof window !== "undefined" &&
        window.Notification?.permission === "granted" &&
        document.hidden
      ) {
        const latest = (data.notifications ?? []).find((n: Notification) => !n.read);
        if (latest) {
          try {
            new window.Notification(latest.title, { body: latest.body });
          } catch {
            /* ignore */
          }
        }
      }
    };
    load();
    const interval = setInterval(load, 60_000); // poll every minute
    return () => { active = false; clearInterval(interval); };
  }, [fetchNotificationsData]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function requestPushPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await window.Notification.requestPermission();
      setPushEnabled(permission === "granted");
      if (permission === "granted") {
        new window.Notification("Fantasy Golf notifications enabled", {
          body: "You'll now get push notifications for position changes, deadlines, and more.",
        });

        // Trigger service worker registration + push subscription
        // PushRegistration component will pick this up, but we also
        // dispatch an event so it can re-attempt subscription immediately.
        window.dispatchEvent(new Event("notification-permission-granted"));
      }
    } catch {
      /* ignore */
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 text-white/90 transition hover:bg-white/15 hover:text-white"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4a843] px-1 text-xs font-bold text-[#1a3a20]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <h3 className="text-sm font-bold text-[#0f3d20]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs font-semibold text-[#1a6b3c] transition hover:text-[#0f3d20] disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Push prompt */}
          {pushSupported && !pushEnabled && (
            <button
              onClick={requestPushPermission}
              className="flex w-full items-center gap-2 border-b border-zinc-100 bg-amber-50 px-4 py-2.5 text-left transition hover:bg-amber-100"
            >
              <span className="text-base"><BellIcon className="h-4 w-4" /></span>
              <div>
                <p className="text-xs font-semibold text-amber-800">Enable push notifications</p>
                <p className="text-xs text-amber-600">Get alerts for deadlines & score changes</p>
              </div>
            </button>
          )}

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="mx-auto h-8 w-8 text-zinc-400" />
                <p className="mt-2 text-sm text-zinc-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-zinc-50 px-4 py-3 transition ${
                    !n.read ? "bg-[#1a6b3c]/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">
                      {TYPE_ICONS[n.type] ?? <InfoIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-800">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-600">{n.body}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d4a843]" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
