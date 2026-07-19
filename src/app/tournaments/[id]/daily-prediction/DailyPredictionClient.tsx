"use client";

/**
 * DailyPredictionClient — interactive UI for the daily prediction mini-game.
 * Polls data from the API. Lets user pick one golfer per round.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TIER_CONFIG } from "@/lib/ui";
import { useAuth } from "@/components/AuthProvider";

interface PredictionPlayer {
  playerId: string;
  name: string;
  country: string | null;
  tier: string;
  withdrew: boolean;
}

interface MyPrediction {
  id: string;
  playerId: string;
  round: number;
  createdAt: string;
}

interface LeaderboardRow {
  position: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  picks: number;
  total: number;
}

interface Data {
  activeRound: number;
  tournament: {
    id: string;
    name: string;
    status: string;
    par: number;
  };
  players: PredictionPlayer[];
  myPredictions: MyPrediction[];
  streak: number;
  leaderboard: LeaderboardRow[];
}

interface Props {
  tournamentId: string;
  currentUserId: string | null;
}

export default function DailyPredictionClient({ tournamentId, currentUserId }: Props) {
  const { signInWithGoogle } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<number | null>(null); // which round we're picking

  const fetchData = useCallback(async (): Promise<Data | null> => {
    try {
      const res = await fetch(`/api/daily-prediction?tournamentId=${encodeURIComponent(tournamentId)}`);
      if (res.ok) return await res.json();
    } catch {
      /* ignore */
    }
    return null;
  }, [tournamentId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const d = await fetchData();
      if (!active) return;
      if (d) setData(d);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { active = false; clearInterval(t); };
  }, [fetchData]);

  async function savePick(playerId: string, round: number) {
    if (!currentUserId) {
      setError("Please sign in to make picks.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, playerId, round }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save pick");
      } else {
        setPickMode(null);
        const d = await fetchData();
        if (d) setData(d);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-2xl bg-zinc-200" />
          <div className="h-48 rounded-2xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-4 text-xs">
          <Link
            href={`/tournaments/${tournamentId}/leaderboard`}
            className="text-zinc-500 hover:text-[#1a6b3c]"
          >
            ← Back
          </Link>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-3xl">
            
          </div>
          {currentUserId ? (
            <>
              <p className="text-lg font-semibold text-zinc-700">Predictions unavailable</p>
              <p className="mt-1 text-sm text-zinc-500">
                This tournament doesn&apos;t have daily predictions open yet. Check back soon!
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-zinc-700">Sign in to play</p>
              <p className="mt-1 text-sm text-zinc-500">
                Daily predictions are a free mini-game — sign in with Google to start picking!
              </p>
              <button
                onClick={() => signInWithGoogle()}
                className="mt-5 inline-block rounded-full bg-purple-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700"
              >
                Sign In with Google →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const { tournament, players, myPredictions, streak, leaderboard } = data;
  const eligiblePlayers = players.filter((p) => !p.withdrew);
  const isComplete = tournament.status === "completed";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-4 text-xs">
        <Link
          href={`/tournaments/${tournamentId}/leaderboard`}
          className="text-zinc-500 hover:text-[#1a6b3c]"
        >
          ← {tournament.name}
        </Link>
      </div>

      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Free Mini-Game</p>
            <h1 className="text-2xl font-bold">Daily Prediction</h1>
            <p className="text-sm text-white/70">{tournament.name}</p>
          </div>
          {streak > 0 && (
            <div className="text-right">
              <p className="text-xs text-white/65">Streak</p>
              <p className="text-3xl font-extrabold text-orange-300">🔥 {streak}</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-white/60">
          Each day, pick one golfer you think will shoot the lowest round. No entry fee.
          Consecutive correct picks build your streak 🔥 — hit 7 for an achievement!
        </p>
      </div>

      {/* Rounds */}
      <div className="mt-6 space-y-3">
        {[1, 2, 3, 4].map((round) => {
          const myPick = myPredictions.find((p) => p.round === round);
          const myPlayer = myPick ? players.find((p) => p.playerId === myPick.playerId) : null;
          const isLocked = data.activeRound > round || isComplete;
          const isPicking = pickMode === round;

          return (
            <div key={round} className="rounded-2xl bg-white shadow-sm overflow-hidden dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <h3 className="font-bold text-[#0f3d20] dark:text-green-400">
                  Round {round}
                  {round === data.activeRound && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
                      Active
                    </span>
                  )}
                  {isLocked && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Locked
                    </span>
                  )}
                </h3>
                {!isLocked && currentUserId && (
                  <button
                    onClick={() => setPickMode(isPicking ? null : round)}
                    className="text-xs font-bold text-[#1a6b3c] hover:underline"
                  >
                    {isPicking ? "Cancel" : myPick ? "Change Pick" : "Pick Golfer →"}
                  </button>
                )}
              </div>

              <div className="p-4">
                {myPlayer ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⛳</span>
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{myPlayer.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {myPlayer.country ?? ""} {TIER_CONFIG[myPlayer.tier]?.short ?? ""}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(myPick!.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {isLocked ? "No pick made for this round." : "No pick yet — choose a golfer!"}
                  </p>
                )}

                {/* Pick grid */}
                {isPicking && !isLocked && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {eligiblePlayers.map((p) => (
                      <button
                        key={p.playerId}
                        disabled={submitting}
                        onClick={() => savePick(p.playerId, round)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:border-[#1a6b3c] hover:bg-green-50 disabled:opacity-50 ${
                          myPick?.playerId === p.playerId
                            ? "border-[#1a6b3c] bg-green-50 dark:border-green-700 dark:bg-green-950"
                            : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                        }`}
                      >
                        <span className="text-lg">{TIER_CONFIG[p.tier]?.icon ?? ""}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {TIER_CONFIG[p.tier]?.short ?? ""} {p.country ?? ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Leaderboard */}
      <div className="mt-8 rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
        <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h2 className="text-base font-bold text-[#0f3d20] dark:text-green-400">Prediction Leaderboard</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Lowest total strokes across picked rounds</p>
        </div>
        {leaderboard.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No picks yet. Be the first!</p>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {leaderboard.slice(0, 20).map((row) => (
              <div
                key={row.userId}
                className={`flex items-center gap-3 p-3 ${
                  row.userId === currentUserId ? "bg-amber-50 dark:bg-amber-950/50" : ""
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  row.position === 1
                    ? "bg-[#d4a843] text-[#1a3a20]"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {row.position}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {row.userName}
                    {row.userId === currentUserId && (
                      <span className="ml-1 text-xs text-[#1a6b3c]">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.picks} picks</p>
                </div>
                <span className="text-sm font-bold text-[#0f3d20] dark:text-green-400">
                  {row.total > 0 ? row.total : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        💡 <strong>Daily Double:</strong> If your main team pick AND your daily prediction both shoot
        under par, you earn bonus bragging rights.
      </div>
    </div>
  );
}
