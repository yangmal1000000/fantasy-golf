"use client";

import { useState } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";

export interface TournamentPlayerScore {
  playerId: string;
  playerName: string;
  country: string | null;
  rounds: (number | null)[];
  total: number;
  toPar: number;
  roundsPlayed: number;
  position: number;
  madeCut: boolean;
}

export default function TournamentLeaderboard({
  players,
  par,
}: {
  players: TournamentPlayerScore[];
  par: number;
}) {
  const [showFull, setShowFull] = useState(false);
  const visible = showFull ? players : players.slice(0, 20);

  if (players.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-12 text-center">
        <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
          No scores available yet
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Scores will appear here once the tournament begins.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🏌️</span>
        <h2 className="text-base font-bold text-[#0a3d2a] dark:text-green-400 sm:text-lg">
          Tournament Leaderboard
        </h2>
        <span className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          PGA Tour Scores
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
        {/* Desktop table */}
        <table className="hidden w-full text-sm sm:table">
          <thead className="bg-[#0a3d2a] text-white">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Pos</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Player</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">R1</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">R2</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">R3</th>
              <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">R4</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">Total</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">To Par</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visible.map((p) => {
              const isWinner = p.position === 1;
              return (
                <tr
                  key={p.playerId}
                  className={`transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    isWinner ? "bg-[#c8a951]/10" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        isWinner
                          ? "bg-[#c8a951] text-[#1a1a1a]"
                          : p.position <= 3
                            ? "bg-[#0a3d2a] text-white"
                            : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {p.position}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/players/${p.playerId}`}
                      className="flex items-center gap-1.5 font-semibold text-[#0a3d2a] hover:underline dark:text-green-400"
                    >
                      <Flag countryCode={p.country} size="sm" />
                      {p.playerName}
                    </Link>
                  </td>
                  {p.rounds.map((r, i) => (
                    <td key={i} className="px-2 py-2.5 text-center tabular text-xs">
                      {r === null ? (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      ) : (
                        <span
                          className={
                            r < par
                              ? "text-green-600 font-semibold"
                              : r > par
                                ? "text-red-500"
                                : "text-zinc-600 dark:text-zinc-400"
                          }
                        >
                          {r}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular text-[#0a3d2a] dark:text-green-400">
                    {!p.madeCut && p.roundsPlayed < 2 ? "WD" : p.total}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular">
                    <span
                      className={
                        p.toPar < 0
                          ? "text-green-600"
                          : p.toPar === 0
                            ? "text-zinc-500"
                            : "text-red-500"
                      }
                    >
                      {p.toPar === 0 ? "E" : `${p.toPar > 0 ? "+" : ""}${p.toPar}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
          {visible.map((p) => {
            const isWinner = p.position === 1;
            return (
              <Link
                key={p.playerId}
                href={`/players/${p.playerId}`}
                className={`flex items-center gap-2 p-3 transition active:bg-zinc-50 dark:active:bg-zinc-800 ${
                  isWinner ? "bg-[#c8a951]/10" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isWinner
                      ? "bg-[#c8a951] text-[#1a1a1a]"
                      : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {p.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#0a3d2a] dark:text-green-400">
                    {p.playerName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Flag countryCode={p.country} size="sm" />
                    <span className="flex gap-1 tabular text-xs">
                      {p.rounds.map((r, i) => (
                        <span
                          key={i}
                          className={
                            r === null
                              ? "text-zinc-300 dark:text-zinc-600"
                              : r < par
                                ? "text-green-600 font-semibold"
                                : r > par
                                  ? "text-red-500"
                                  : "text-zinc-500"
                          }
                        >
                          {r ?? "—"}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">
                    {!p.madeCut && p.roundsPlayed < 2 ? "WD" : p.total}
                  </p>
                  <p
                    className={`text-xs font-semibold ${
                      p.toPar < 0
                        ? "text-green-600"
                        : p.toPar === 0
                          ? "text-zinc-500"
                          : "text-red-500"
                    }`}
                  >
                    {p.toPar === 0 ? "E" : `${p.toPar > 0 ? "+" : ""}${p.toPar}`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Show Full Field toggle */}
      {players.length > 20 && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowFull((v) => !v)}
            className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2 text-sm font-semibold text-[#0a3d2a] dark:text-green-400 transition hover:border-zinc-400 dark:hover:border-zinc-600"
          >
            {showFull ? "Show Top 20" : `Show Full Field (${players.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
