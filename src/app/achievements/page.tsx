"use client";

/**
 * Achievements page — badge grid with progress bars.
 */

import { useState, useEffect } from "react";
import Link from "next/link";

interface AchievementItem {
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
  earnedAt: string | null;
  progress: { current: number; target: number } | null;
}

interface Data {
  stats: Record<string, number>;
  achievements: AchievementItem[];
}

export default function AchievementsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-2xl bg-zinc-200" />
          <div className="h-48 rounded-2xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
          Please sign in to view achievements.
        </div>
      </div>
    );
  }

  const earnedCount = data.achievements.filter((a) => a.earned).length;
  const totalCount = data.achievements.length;
  const overallPct = Math.round((earnedCount / totalCount) * 100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Your Trophy Room</p>
            <h1 className="text-2xl font-bold">🏆 Achievements</h1>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-yellow-300">
              {earnedCount}
              <span className="text-base text-white/40">/{totalCount}</span>
            </p>
            <p className="text-xs text-white/50">Earned</p>
          </div>
        </div>
        {/* Overall progress bar */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-gradient-to-r from-yellow-300 to-amber-500 transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-white/50">{overallPct}% complete</p>
      </div>

      {/* Badge grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {data.achievements.map((a) => {
          const pct = a.progress
            ? Math.min(100, Math.round((a.progress.current / a.progress.target) * 100))
            : a.earned
              ? 100
              : 0;
          return (
            <div
              key={a.type}
              className={`relative overflow-hidden rounded-2xl border-2 p-4 text-center transition ${
                a.earned
                  ? `border-transparent bg-gradient-to-br ${a.color} shadow-lg`
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              {/* Icon */}
              <div className={`text-4xl ${a.earned ? "" : "opacity-30 grayscale"}`}>
                {a.icon}
              </div>

              {/* Label */}
              <p className={`mt-2 text-sm font-bold ${
                a.earned ? "text-white" : "text-zinc-500"
              }`}>
                {a.label}
              </p>

              {/* Description */}
              <p className={`mt-1 text-xs ${
                a.earned ? "text-white/80" : "text-zinc-400"
              }`}>
                {a.description}
              </p>

              {/* Progress */}
              {!a.earned && a.progress && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full bg-[#1a6b3c] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {a.progress.current}/{a.progress.target}
                  </p>
                </div>
              )}

              {/* Earned date */}
              {a.earned && a.earnedAt && (
                <p className="mt-2 text-xs text-white/60">
                  {new Date(a.earnedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}

              {/* Lock icon for unearned */}
              {!a.earned && (
                <span className="absolute right-2 top-2 text-xs opacity-30">🔒</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/tournaments"
          className="text-sm font-semibold text-[#1a6b3c] hover:underline"
        >
          ← Back to tournaments
        </Link>
      </div>
    </div>
  );
}
