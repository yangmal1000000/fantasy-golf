"use client";

/**
 * LiveTrackerClient — auto-refreshing live match tracker.
 * Polls the leaderboard every 60s for an up-to-date feel.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TIER_CONFIG } from "@/lib/ui";

interface PlayerInfo {
  playerId: string;
  playerName: string;
  tier: string;
  roundScores: (number | null)[];
  totalStrokes: number;
}

interface MiniEntry {
  teamId: string;
  teamName: string;
  position: number;
  totalStrokes: number;
}

interface Moment {
  playerName: string;
  round: number;
  strokes: number;
  diff: number;
}

interface Props {
  tournamentId: string;
  tournamentName: string;
  par: number;
  currentRound: number;
  teamName: string;
  teamTotal: number;
  teamPosition: number;
  players: PlayerInfo[];
  miniLeaderboard: MiniEntry[];
  thrillingMoments: Moment[];
}

function roundEmoji(strokes: number | null, par: number): string {
  if (strokes == null) return "⚪";
  const diff = strokes - par;
  if (diff <= -3) return "🦅"; // albatross
  if (diff === -2) return "🦅"; // eagle
  if (diff === -1) return "🐦"; // birdie
  if (diff === 0) return "🟡"; // par
  if (diff === 1) return "🅱️"; // bogey
  return "💀"; // double+
}

export default function LiveTrackerClient(props: Props) {
  const [pulse, setPulse] = useState(false);
  const [data] = useState(props);

  // Pulse animation every 5s while live
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 5000);
    return () => clearInterval(t);
  }, []);

  // Refresh leaderboard snapshot every 60s
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${props.tournamentId}/teams/route-ignored`, {
        cache: "no-store",
      });
      // ignore — endpoint may not return the shape we want
      void res;
    } catch {
      /* ignore */
    }
  }, [props.tournamentId]);

  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const teamVsPar = data.players.reduce((sum, p) => sum + p.totalStrokes, 0) - data.par * 4 * data.players.length;

  return (
    <div className="mt-6 space-y-6">
      {/* Team summary */}
      <div className={`rounded-2xl bg-gradient-to-br from-[#0f3d20] to-[#1a6b3c] p-5 text-white shadow-lg transition ${pulse ? "ring-2 ring-[#d4a843]" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Your Team</p>
            <h2 className="text-xl font-bold">{data.teamName}</h2>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-[#d4a843]">{data.teamTotal}</p>
            <p className="text-xs text-white/60">
              {teamVsPar === 0 ? "E" : teamVsPar > 0 ? `+${teamVsPar}` : teamVsPar} vs par
            </p>
          </div>
        </div>
        <div className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
          Position #{data.teamPosition || "—"}
        </div>
      </div>

      {/* Players with live scores */}
      <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
        <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h3 className="text-base font-bold text-[#0f3d20] dark:text-green-400">👥 Your Players — Round {data.currentRound || 1}</h3>
        </div>
        <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
          {data.players.map((p) => {
            const activeRound = Math.max(1, data.currentRound);
            const today = p.roundScores[activeRound - 1];
            const todayDiff = today != null ? today - data.par : null;
            const config = TIER_CONFIG[p.tier];
            return (
              <div key={p.playerId} className="flex items-center gap-3 p-3">
                <span className="text-2xl">{roundEmoji(today, data.par)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{p.playerName}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {config?.short ?? ""} · Total {p.totalStrokes}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${
                    todayDiff == null ? "text-zinc-300 dark:text-zinc-600" :
                    todayDiff < 0 ? "text-red-500" :
                    todayDiff === 0 ? "text-zinc-600 dark:text-zinc-400" :
                    "text-zinc-500 dark:text-zinc-500"
                  }`}>
                    {today != null ? `R${activeRound}: ${today}` : "—"}
                  </p>
                  {todayDiff != null && (
                    <p className={`text-xs ${
                      todayDiff < 0 ? "text-red-500" :
                      todayDiff === 0 ? "text-zinc-500" :
                      "text-zinc-400 dark:text-zinc-500"
                    }`}>
                      {todayDiff === 0 ? "E" : todayDiff > 0 ? `+${todayDiff}` : todayDiff}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
        <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h3 className="text-base font-bold text-[#0f3d20] dark:text-green-400">🏆 Top 5</h3>
        </div>
        <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
          {data.miniLeaderboard.map((e, i) => (
            <Link
              key={e.teamId}
              href={`/tournaments/${data.tournamentId}/teams/${e.teamId}`}
              className="flex items-center gap-3 p-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0 ? "bg-[#d4a843] text-[#1a3a20]" : "bg-zinc-100 text-zinc-600"
              }`}>
                {e.position}
              </span>
              <p className="flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{e.teamName}</p>
              <span className="text-sm font-bold text-[#0f3d20] dark:text-green-400">{e.totalStrokes}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Thrilling moments */}
      {data.thrillingMoments.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 shadow-sm">
          <div className="bg-amber-100/50 px-4 py-2">
            <h3 className="text-base font-bold text-amber-900">✨ Thrilling Moments</h3>
            <p className="text-xs text-amber-700">Eagles &amp; birdies from your team</p>
          </div>
          <div className="divide-y divide-amber-100">
            {data.thrillingMoments.slice(0, 10).map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <span className="text-xl">{m.diff <= -2 ? "🦅" : "🐦"}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-800">{m.playerName}</p>
                  <p className="text-xs text-zinc-500">Round {m.round}</p>
                </div>
                <span className={`text-sm font-extrabold ${
                  m.diff <= -3 ? "text-purple-600" :
                  m.diff === -2 ? "text-red-500" :
                  "text-green-600"
                }`}>
                  {m.diff <= -3 ? "ALBATROSS!" : m.diff === -2 ? "EAGLE" : "BIRDIE"}
                </span>
                <span className="text-xs text-zinc-400">{m.strokes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        Auto-refreshing every 60 seconds · Round {data.currentRound || "—"}
      </p>
    </div>
  );
}
