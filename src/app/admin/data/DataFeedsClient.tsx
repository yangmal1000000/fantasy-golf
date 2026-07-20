"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Feed {
  id: string;
  feedType: string;
  feedSource: string;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  recordsTotal: number;
  recordsSynced: number;
  errorCount: number;
  lastError: string | null;
  lastMessage: string | null;
  enabled: boolean;
}

interface Metrics {
  total: number;
  withPhoto: number;
  withBio: number;
  withDob: number;
  withCollege: number;
  withEarnings: number;
  enriched: number;
  photoPct: number;
  bioPct: number;
  enrichedPct: number;
}

const STATUS_STYLES: Record<string, string> = {
  idle: "bg-zinc-100 text-zinc-600",
  running: "bg-blue-100 text-blue-700 animate-pulse",
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

const FEED_ICONS: Record<string, string> = {
  players: "👤",
  rankings: "📊",
  results: "🏆",
  schedule: "📅",
};

export default function DataFeedsClient({
  feeds,
  metrics,
}: {
  feeds: Feed[];
  metrics: Metrics;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeFeed, setActiveFeed] = useState<string | null>(null);

  function triggerFeed(feedId: string, feedType: string, feedSource: string) {
    setActiveFeed(feedId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/feeds/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedId, feedType, feedSource }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Feed failed");
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Feed trigger failed");
      } finally {
        setActiveFeed(null);
      }
    });
  }

  function toggleFeed(feedId: string, enabled: boolean) {
    startTransition(async () => {
      await fetch("/api/admin/feeds/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId, enabled: !enabled }),
      });
      router.refresh();
    });
  }

  // Group feeds by type
  const feedGroups = feeds.reduce((acc, f) => {
    if (!acc[f.feedType]) acc[f.feedType] = [];
    acc[f.feedType].push(f);
    return acc;
  }, {} as Record<string, Feed[]>);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Data Feeds</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage data enrichment feeds and monitor sync status.
        </p>
      </div>

      {/* Data Quality Dashboard */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Player Data Quality
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <QualityCard label="Total" value={metrics.total} color="text-zinc-900" />
          <QualityCard label="Photos" value={metrics.withPhoto} pct={metrics.photoPct} color="text-blue-600" />
          <QualityCard label="Bios" value={metrics.withBio} pct={metrics.bioPct} color="text-purple-600" />
          <QualityCard label="Enriched" value={metrics.enriched} pct={metrics.enrichedPct} color="text-green-600" />
          <QualityCard label="DOB" value={metrics.withDob} color="text-amber-600" />
          <QualityCard label="College" value={metrics.withCollege} color="text-indigo-600" />
          <QualityCard label="Earnings" value={metrics.withEarnings} color="text-emerald-600" />
        </div>
      </div>

      {/* Feed Groups */}
      <div className="space-y-6">
        {Object.entries(feedGroups).map(([type, groupFeeds]) => (
          <div key={type}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              <span>{FEED_ICONS[type] || "📦"}</span>
              {type}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {groupFeeds.map((feed) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  onTrigger={() => triggerFeed(feed.id, feed.feedType, feed.feedSource)}
                  onToggle={() => toggleFeed(feed.id, feed.enabled)}
                  isRunning={activeFeed === feed.id || feed.status === "running"}
                  disabled={isPending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityCard({
  label,
  value,
  pct,
  color = "text-zinc-900",
}: {
  label: string;
  value: number;
  pct?: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
      {pct !== undefined && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-current opacity-40"
            style={{ width: `${pct}%`, color: color.replace("text-", "") }}
          />
        </div>
      )}
    </div>
  );
}

function FeedCard({
  feed,
  onTrigger,
  onToggle,
  isRunning,
  disabled,
}: {
  feed: Feed;
  onTrigger: () => void;
  onToggle: () => void;
  isRunning: boolean;
  disabled: boolean;
}) {
  const statusClass = STATUS_STYLES[feed.status] || STATUS_STYLES.idle;
  const lastRun = feed.lastRunAt
    ? new Date(feed.lastRunAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
    : "Never";

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm transition ${feed.enabled ? "border-zinc-200" : "border-zinc-200 opacity-60"}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold capitalize text-zinc-900">{feed.feedSource}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass}`}>
              {feed.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{feed.lastMessage || "No description"}</p>
        </div>
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`relative ml-2 h-5 w-9 shrink-0 rounded-full transition ${feed.enabled ? "bg-green-500" : "bg-zinc-300"}`}
          disabled={disabled}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${feed.enabled ? "left-4" : "left-0.5"}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-zinc-400">Last Run</p>
          <p className="font-medium text-zinc-700">{lastRun}</p>
        </div>
        <div>
          <p className="text-zinc-400">Records</p>
          <p className="font-medium text-zinc-700">
            {feed.recordsSynced.toLocaleString()}
            {feed.recordsTotal > 0 && ` / ${feed.recordsTotal.toLocaleString()}`}
          </p>
        </div>
        <div>
          <p className="text-zinc-400">Errors</p>
          <p className={`font-medium ${feed.errorCount > 0 ? "text-red-600" : "text-zinc-700"}`}>
            {feed.errorCount}
          </p>
        </div>
      </div>

      {/* Error detail */}
      {feed.lastError && (
        <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/20">
          {feed.lastError.slice(0, 200)}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onTrigger}
          disabled={isRunning || disabled}
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {isRunning ? "Running…" : "Sync Now"}
        </button>
        {feed.nextRunAt && (
          <span className="text-xs text-zinc-400">
            Next: {new Date(feed.nextRunAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
          </span>
        )}
      </div>
    </div>
  );
}
