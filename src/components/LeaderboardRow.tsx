"use client";

/**
 * LeaderboardRow — Animated leaderboard table row.
 * Tracks previous score via useRef and triggers CSS animation on change.
 *
 * Used for both desktop <tr> and mobile card rendering.
 */

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import PositionIndicator from "./PositionIndicator";
import { tierBadgeClass } from "@/lib/ui";

export interface LeaderboardPlayer {
  playerId: string;
  playerName: string;
  tier: string;
  roundScores: (number | null)[];
}

export interface LeaderboardResult {
  teamId: string;
  teamName: string;
  ownerName: string;
  position: number;
  totalStrokes: number;
  vsPar: number;
  players: LeaderboardPlayer[];
}

interface LeaderboardRowProps {
  result: LeaderboardResult;
  tournamentId: string;
  projectedPosition?: number;
  isMobile?: boolean;
  yourTeamId?: string;
}

export default function LeaderboardRow({
  result,
  tournamentId,
  projectedPosition,
  isMobile = false,
  yourTeamId,
}: LeaderboardRowProps) {
  const prevScoreRef = useRef(result.totalStrokes);
  const prevPositionRef = useRef(result.position);
  const [scoreAnim, setScoreAnim] = useState(false);
  const [posAnim, setPosAnim] = useState(false);

  useEffect(() => {
    if (prevScoreRef.current !== result.totalStrokes) {
      setScoreAnim(true);
      const timer = setTimeout(() => setScoreAnim(false), 1500);
      prevScoreRef.current = result.totalStrokes;
      return () => clearTimeout(timer);
    }
  }, [result.totalStrokes]);

  useEffect(() => {
    if (prevPositionRef.current !== result.position && result.position < prevPositionRef.current) {
      setPosAnim(true);
      const timer = setTimeout(() => setPosAnim(false), 1200);
      prevPositionRef.current = result.position;
      return () => clearTimeout(timer);
    }
    prevPositionRef.current = result.position;
  }, [result.position]);

  const vsPar = result.vsPar;
  const parClass =
    vsPar < 0
      ? "text-red-500 font-bold"
      : vsPar === 0
        ? "text-zinc-600 dark:text-zinc-400"
        : "text-zinc-500 dark:text-zinc-500";
  const isYou = yourTeamId === result.teamId;
  const animClass = scoreAnim ? "animate-score-update" : posAnim ? "animate-position-up" : "";

  if (isMobile) {
    return (
      <Link
        href={`/tournaments/${tournamentId}/teams/${result.teamId}`}
        className={`block p-4 transition active:bg-zinc-50 dark:active:bg-zinc-800 ${animClass} ${
          isYou ? "bg-amber-50 dark:bg-amber-950/20" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              result.position === 1
                ? "bg-[#c8a951] text-[#1a1a1a]"
                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {result.position}
          </span>
          {projectedPosition != null && (
            <PositionIndicator
              currentPosition={result.position}
              projectedPosition={projectedPosition}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#0a3d2a] dark:text-green-400">
              {result.teamName}
              {isYou && <span className="ml-1 text-[#c8a951]">(You)</span>}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {result.ownerName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">
              {result.totalStrokes}
            </p>
            <p className={`text-xs ${vsPar < 0 ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
              {vsPar > 0 ? "+" : ""}
              {vsPar === 0 ? "E" : vsPar}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  // Desktop row
  return (
    <tr className={`transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${animClass} ${
      isYou ? "bg-amber-50 dark:bg-amber-950/20" : ""
    }`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              result.position === 1
                ? "bg-[#c8a951] text-[#1a1a1a]"
                : result.position <= 3
                  ? "bg-[#0a3d2a] text-white"
                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {result.position}
          </span>
          {projectedPosition != null && (
            <PositionIndicator
              currentPosition={result.position}
              projectedPosition={projectedPosition}
            />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/tournaments/${tournamentId}/teams/${result.teamId}`}
          className="font-semibold text-[#0a3d2a] hover:underline dark:text-green-400"
        >
          {result.teamName}
          {isYou && <span className="ml-1 text-[#c8a951]">(You)</span>}
        </Link>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{result.ownerName}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-center gap-1">
          {result.players.map((p) => (
            <span
              key={p.playerId}
              title={`${p.playerName} (${p.tier}): ${p.roundScores.filter((s) => s != null).join(", ") || "no scores"}`}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierBadgeClass(
                p.tier
              )}`}
            >
              {p.playerName.split(" ").slice(-1)[0]?.slice(0, 3)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">
        {result.totalStrokes}
      </td>
      <td className={`px-4 py-3 text-right text-sm ${parClass}`}>
        {vsPar > 0 ? "+" : ""}
        {vsPar === 0 ? "E" : vsPar}
      </td>
    </tr>
  );
}
