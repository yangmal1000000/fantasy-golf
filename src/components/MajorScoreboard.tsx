/**
 * Major Championship Skeuomorphic Scoreboards
 * 
 * Replicates the look of physical leaderboards at each major:
 * - Masters: White face, Augusta green frame, red under-par numbers
 * - PGA Championship: Navy face, gold accents, white text
 * - US Open: Pale mint-green face, dark green frame, navy/red headers
 * - The Open: Yellow face, navy frame, serif banner
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import { roundScoreClass } from "@/lib/score-colors";

export interface ScoreboardPlayer {
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

type MajorKey = "masters" | "pga-championship" | "us-open" | "the-open";

export default function MajorScoreboard({
  players,
  par,
  major,
}: {
  players: ScoreboardPlayer[];
  par: number;
  major: MajorKey;
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
    <>
      {major === "masters" && <MastersBoard players={visible} par={par} />}
      {major === "pga-championship" && <PgaBoard players={visible} par={par} />}
      {major === "us-open" && <UsOpenBoard players={visible} par={par} />}
      {major === "the-open" && <OpenBoard players={visible} par={par} />}

      {players.length > 20 && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowFull((v) => !v)}
            className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2 text-sm font-semibold text-[#0a3d2a] dark:text-green-400 transition hover:border-zinc-400"
          >
            {showFull ? "Show Top 20" : `Show Full Field (${players.length})`}
          </button>
        </div>
      )}
    </>
  );
}

/* ============================================================
 * MASTERS — White face, green frame, red under-par, "LEADERS"
 * ============================================================ */
function MastersBoard({ players, par }: { players: ScoreboardPlayer[]; par: number }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-xl" style={{ backgroundColor: "#003820" }}>
      {/* Frame */}
      <div className="p-2">
        {/* Face */}
        <div className="overflow-hidden" style={{ backgroundColor: "#f5f3ed" }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 px-4 py-2" style={{ borderColor: "#003820" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#003820" }}>
              Leaders
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#666" }}>
              Par {par}
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center border-b px-3 py-1 text-[10px] font-bold uppercase" style={{ borderColor: "#ddd", color: "#999" }}>
            <span className="w-7 text-center">Pos</span>
            <span className="flex-1 pl-2">Player</span>
            <span className="w-9 text-center">R1</span>
            <span className="w-9 text-center">R2</span>
            <span className="w-9 text-center">R3</span>
            <span className="w-9 text-center">R4</span>
            <span className="w-12 text-right">Total</span>
            <span className="w-10 text-right">To Par</span>
          </div>

          {/* Rows */}
          <div>
            {players.map((p, i) => {
              const isWinner = p.position === 1;
              return (
                <div
                  key={p.playerId}
                  className="flex items-center px-3 py-1.5 text-sm transition"
                  style={{
                    backgroundColor: isWinner ? "#fff8dc" : i % 2 === 0 ? "#f5f3ed" : "#edeae3",
                    borderBottom: "1px solid #e0ddd6",
                  }}
                >
                  <span className="w-7 text-center font-mono text-xs font-bold" style={{ color: isWinner ? "#003820" : "#999" }}>
                    {p.position}
                  </span>
                  <Link href={`/players/${p.playerId}`} className="flex flex-1 items-center gap-1.5 pl-2">
                    <Flag countryCode={p.country} size="sm" />
                    <span className="font-mono text-[13px] font-bold uppercase tracking-tight" style={{ color: "#1a1a1a" }}>
                      {p.playerName}
                    </span>
                  </Link>
                  {p.rounds.map((r, idx) => (
                    <span key={idx} className="w-9 text-center font-mono text-[13px] font-semibold tabular">
                      {r === null ? (
                        <span style={{ color: "#ccc" }}>—</span>
                      ) : (
                        <span style={{ color: r < par ? "#c41e3a" : r === par ? "#333" : "#666" }}>
                          {r}
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="w-12 text-right font-mono text-sm font-bold tabular" style={{ color: "#1a1a1a" }}>
                    {!p.madeCut && p.roundsPlayed < 2 ? "WD" : p.total}
                  </span>
                  <span className="w-10 text-right font-mono text-sm font-bold tabular">
                    {!p.madeCut && p.roundsPlayed < 3 ? (
                      <span style={{ color: "#c41e3a" }}>CUT</span>
                    ) : p.toPar < 0 ? (
                      <span style={{ color: "#c41e3a" }}>{p.toPar}</span>
                    ) : p.toPar === 0 ? (
                      <span style={{ color: "#666" }}>E</span>
                    ) : (
                      <span style={{ color: "#333" }}>+{p.toPar}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * PGA CHAMPIONSHIP — Navy face, gold accents, white text
 * ============================================================ */
function PgaBoard({ players, par }: { players: ScoreboardPlayer[]; par: number }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-xl" style={{ backgroundColor: "#0d1f3c" }}>
      <div className="p-1.5">
        {/* Face */}
        <div className="overflow-hidden" style={{ backgroundColor: "#1a2a4a" }}>
          {/* Header banner */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: "#0d1f3c" }}>
            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#d4a843" }}>
              PGA Championship
            </span>
            <span className="text-[10px] font-semibold uppercase" style={{ color: "#5b7ab5" }}>
              Par {par}
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center border-b px-3 py-1 text-[10px] font-bold uppercase" style={{ borderColor: "#2a3a5a", color: "#5b7ab5" }}>
            <span className="w-7 text-center">Pos</span>
            <span className="flex-1 pl-2">Player</span>
            <span className="w-9 text-center">R1</span>
            <span className="w-9 text-center">R2</span>
            <span className="w-9 text-center">R3</span>
            <span className="w-9 text-center">R4</span>
            <span className="w-12 text-right">Total</span>
            <span className="w-10 text-right">To Par</span>
          </div>

          {/* Rows */}
          <div>
            {players.map((p, i) => {
              const isWinner = p.position === 1;
              return (
                <div
                  key={p.playerId}
                  className="flex items-center px-3 py-1.5 text-sm transition"
                  style={{
                    backgroundColor: isWinner ? "#2a3a6a" : i % 2 === 0 ? "#1a2a4a" : "#16223e",
                    borderBottom: "1px solid #2a3a5a",
                  }}
                >
                  <span className="w-7 text-center font-mono text-xs font-bold" style={{ color: isWinner ? "#d4a843" : "#5b7ab5" }}>
                    {p.position}
                  </span>
                  <Link href={`/players/${p.playerId}`} className="flex flex-1 items-center gap-1.5 pl-2">
                    <Flag countryCode={p.country} size="sm" />
                    <span className="font-mono text-[13px] font-bold uppercase tracking-tight text-white">
                      {p.playerName}
                    </span>
                  </Link>
                  {p.rounds.map((r, idx) => (
                    <span key={idx} className="w-9 text-center font-mono text-[13px] font-semibold tabular">
                      {r === null ? (
                        <span style={{ color: "#3a4a6a" }}>—</span>
                      ) : (
                        <span style={{ color: r < par ? "#ff6b6b" : r === par ? "#ccc" : "#888" }}>
                          {r}
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="w-12 text-right font-mono text-sm font-bold tabular text-white">
                    {!p.madeCut && p.roundsPlayed < 2 ? "WD" : p.total}
                  </span>
                  <span className="w-10 text-right font-mono text-sm font-bold tabular">
                    {!p.madeCut && p.roundsPlayed < 3 ? (
                      <span style={{ color: "#ff6b6b" }}>CUT</span>
                    ) : p.toPar < 0 ? (
                      <span style={{ color: "#ff6b6b" }}>{p.toPar}</span>
                    ) : p.toPar === 0 ? (
                      <span style={{ color: "#888" }}>E</span>
                    ) : (
                      <span style={{ color: "#ccc" }}>+{p.toPar}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * US OPEN — Pale mint face, dark green frame, navy/red header
 * ============================================================ */
function UsOpenBoard({ players, par }: { players: ScoreboardPlayer[]; par: number }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-xl" style={{ backgroundColor: "#1a3520" }}>
      <div className="p-2">
        {/* Face */}
        <div className="overflow-hidden" style={{ backgroundColor: "#e8f0e4" }}>
          {/* Header banner */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: "#1a3520" }}>
            <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: "#ffffff" }}>
              <span style={{ color: "#3a6db8" }}>U.S. </span>
              <span style={{ color: "#c44" }}>Open</span>
            </span>
            <span className="text-[10px] font-semibold uppercase" style={{ color: "#8a9a85" }}>
              Par {par}
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center border-b px-3 py-1 text-[10px] font-bold uppercase" style={{ borderColor: "#b8c8b4", color: "#5a7a55" }}>
            <span className="w-7 text-center">Pos</span>
            <span className="flex-1 pl-2">Player</span>
            <span className="w-9 text-center">R1</span>
            <span className="w-9 text-center">R2</span>
            <span className="w-9 text-center">R3</span>
            <span className="w-9 text-center">R4</span>
            <span className="w-12 text-right">Total</span>
            <span className="w-10 text-right">To Par</span>
          </div>

          {/* Rows */}
          <div>
            {players.map((p, i) => {
              const isWinner = p.position === 1;
              return (
                <div
                  key={p.playerId}
                  className="flex items-center px-3 py-1.5 text-sm transition"
                  style={{
                    backgroundColor: isWinner ? "#d0e8c8" : i % 2 === 0 ? "#e8f0e4" : "#dde8d8",
                    borderBottom: "1px solid #c0d0bc",
                  }}
                >
                  <span className="w-7 text-center font-mono text-xs font-bold" style={{ color: isWinner ? "#1a3520" : "#8a9a85" }}>
                    {p.position}
                  </span>
                  <Link href={`/players/${p.playerId}`} className="flex flex-1 items-center gap-1.5 pl-2">
                    <Flag countryCode={p.country} size="sm" />
                    <span className="font-mono text-[13px] font-bold uppercase tracking-tight" style={{ color: "#1a2540" }}>
                      {p.playerName}
                    </span>
                  </Link>
                  {p.rounds.map((r, idx) => (
                    <span key={idx} className="w-9 text-center font-mono text-[13px] font-semibold tabular">
                      {r === null ? (
                        <span style={{ color: "#b8c8b4" }}>—</span>
                      ) : (
                        <span style={{ color: r < par ? "#c41e3a" : r === par ? "#333" : "#666" }}>
                          {r}
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="w-12 text-right font-mono text-sm font-bold tabular" style={{ color: "#1a2540" }}>
                    {!p.madeCut && p.roundsPlayed < 2 ? "WD" : p.total}
                  </span>
                  <span className="w-10 text-right font-mono text-sm font-bold tabular">
                    {!p.madeCut && p.roundsPlayed < 3 ? (
                      <span style={{ color: "#c41e3a" }}>CUT</span>
                    ) : p.toPar < 0 ? (
                      <span style={{ color: "#c41e3a" }}>{p.toPar}</span>
                    ) : p.toPar === 0 ? (
                      <span style={{ color: "#666" }}>E</span>
                    ) : (
                      <span style={{ color: "#333" }}>+{p.toPar}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * THE OPEN — Yellow face, navy frame, "THE OPEN" serif banner
 * ============================================================ */
function OpenBoard({ players, par }: { players: ScoreboardPlayer[]; par: number }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-xl" style={{ backgroundColor: "#1a2a4a" }}>
      <div className="p-2">
        {/* Face */}
        <div className="overflow-hidden" style={{ backgroundColor: "#f5c842" }}>
          {/* Header banner */}
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#1a2a4a" }}>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold tracking-wide" style={{ color: "#f5c842" }}>
                The Open
              </span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#7a8ab5" }}>
              Par {par}
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center border-b px-3 py-1 text-[10px] font-bold uppercase" style={{ borderColor: "#d4a820", color: "#6a5a10" }}>
            <span className="w-7 text-center">Pos</span>
            <span className="flex-1 pl-2">Player</span>
            <span className="w-9 text-center">R1</span>
            <span className="w-9 text-center">R2</span>
            <span className="w-9 text-center">R3</span>
            <span className="w-9 text-center">R4</span>
            <span className="w-12 text-right">Total</span>
            <span className="w-10 text-right">To Par</span>
          </div>

          {/* Rows */}
          <div>
            {players.map((p, i) => {
              const isWinner = p.position === 1;
              return (
                <div
                  key={p.playerId}
                  className="flex items-center px-3 py-1.5 text-sm transition"
                  style={{
                    backgroundColor: isWinner ? "#fff0a0" : i % 2 === 0 ? "#f5c842" : "#e8bc38",
                    borderBottom: "1px solid #d4a820",
                  }}
                >
                  <span className="w-7 text-center font-mono text-xs font-bold" style={{ color: isWinner ? "#1a2a4a" : "#8a7a10" }}>
                    {p.position}
                  </span>
                  <Link href={`/players/${p.playerId}`} className="flex flex-1 items-center gap-1.5 pl-2">
                    <Flag countryCode={p.country} size="sm" />
                    <span className="font-mono text-[13px] font-bold uppercase tracking-tight" style={{ color: "#1a1a1a" }}>
                      {p.playerName}
                    </span>
                  </Link>
                  {p.rounds.map((r, idx) => (
                    <span key={idx} className="w-9 text-center font-mono text-[13px] font-semibold tabular">
                      {r === null ? (
                        <span style={{ color: "#b8a020" }}>—</span>
                      ) : (
                        <span style={{ color: r < par ? "#c41e3a" : r === par ? "#333" : "#666" }}>
                          {r}
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="w-12 text-right font-mono text-sm font-bold tabular" style={{ color: "#1a1a1a" }}>
                    {!p.madeCut && p.roundsPlayed < 2 ? "WD" : p.total}
                  </span>
                  <span className="w-10 text-right font-mono text-sm font-bold tabular">
                    {!p.madeCut && p.roundsPlayed < 3 ? (
                      <span style={{ color: "#c41e3a" }}>CUT</span>
                    ) : p.toPar < 0 ? (
                      <span style={{ color: "#c41e3a" }}>{p.toPar}</span>
                    ) : p.toPar === 0 ? (
                      <span style={{ color: "#666" }}>E</span>
                    ) : (
                      <span style={{ color: "#333" }}>+{p.toPar}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
