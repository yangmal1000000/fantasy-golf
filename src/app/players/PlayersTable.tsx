"use client";

/**
 * PlayersTable — Client-side sortable, filterable rankings table.
 * Receives pre-computed player data from the server component.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";
import TierBadge from "@/components/TierBadge";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/ui";

export interface FormResult {
  /** Display label e.g. "W", "T5", "MC", "23" */
  label: string;
  /** Hex color for the dot */
  color: string;
}

export interface PlayerRowData {
  id: string;
  name: string;
  country: string | null;
  dataGolfRank: number | null;
  tier: string | null;
  tournamentCount: number;
  selectionRate: number; // 0–100
  avgScore: number | null;
  bestFinish: number | null;
  form: FormResult[]; // last 5 events, most recent first
}

interface PlayersTableProps {
  players: PlayerRowData[];
  countries: string[];
}

type SortColumn =
  | "rank"
  | "name"
  | "tier"
  | "tournaments"
  | "selectionRate"
  | "avgScore"
  | "bestFinish";

/** Default sort direction when a column is first clicked */
const DEFAULT_DIR: Record<SortColumn, "asc" | "desc"> = {
  rank: "asc",
  name: "asc",
  tier: "asc",
  tournaments: "desc",
  selectionRate: "desc",
  avgScore: "asc",
  bestFinish: "asc",
};

const TIER_CHIPS = [
  { value: "all", label: "All" },
  { value: "T1_10", label: "T1" },
  { value: "T11_20", label: "T2" },
  { value: "T21_30", label: "T3" },
  { value: "T31_50", label: "T4" },
  { value: "T51_PLUS", label: "T5" },
];

/** COUNTRY_NAMES is a small lookup for nicer display */
const COUNTRY_NAMES: Record<string, string> = {
  USA: "United States",
  ENG: "England",
  SCO: "Scotland",
  WAL: "Wales",
  NIR: "Northern Ireland",
  IRE: "Ireland",
  ESP: "Spain",
  AUS: "Australia",
  RSA: "South Africa",
  JPN: "Japan",
  KOR: "South Korea",
  CAN: "Canada",
  ARG: "Argentina",
  SWE: "Sweden",
  NOR: "Norway",
  FIN: "Finland",
  DEN: "Denmark",
  FRA: "France",
  GER: "Germany",
  ITA: "Italy",
  NED: "Netherlands",
  BEL: "Belgium",
  AUT: "Austria",
  SUI: "Switzerland",
  CZE: "Czech Republic",
  POL: "Poland",
};

export default function PlayersTable({ players, countries }: PlayersTableProps) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /* ---------- filtering ---------- */
  const filtered = useMemo(() => {
    let result = players;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (tierFilter !== "all") {
      result = result.filter((p) => p.tier === tierFilter);
    }

    if (countryFilter !== "all") {
      result = result.filter((p) => p.country === countryFilter);
    }

    return result;
  }, [players, search, tierFilter, countryFilter]);

  /* ---------- sorting ---------- */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dirMul = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "rank":
          if (a.dataGolfRank != null && b.dataGolfRank != null)
            cmp = a.dataGolfRank - b.dataGolfRank;
          else if (a.dataGolfRank != null) cmp = -1;
          else if (b.dataGolfRank != null) cmp = 1;
          else cmp = a.name.localeCompare(b.name);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "tier":
          cmp =
            TIER_ORDER.indexOf(a.tier ?? "T51_PLUS") -
            TIER_ORDER.indexOf(b.tier ?? "T51_PLUS");
          break;
        case "tournaments":
          cmp = a.tournamentCount - b.tournamentCount;
          break;
        case "selectionRate":
          cmp = a.selectionRate - b.selectionRate;
          break;
        case "avgScore":
          if (a.avgScore != null && b.avgScore != null)
            cmp = a.avgScore - b.avgScore;
          else if (a.avgScore != null) cmp = -1;
          else if (b.avgScore != null) cmp = 1;
          break;
        case "bestFinish":
          if (a.bestFinish != null && b.bestFinish != null)
            cmp = a.bestFinish - b.bestFinish;
          else if (a.bestFinish != null) cmp = -1;
          else if (b.bestFinish != null) cmp = 1;
          break;
      }
      return cmp * dirMul;
    });

    return arr;
  }, [filtered, sortColumn, sortDir]);

  /* ---------- handlers ---------- */
  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir(DEFAULT_DIR[col]);
    }
  }

  function SortArrow({ col }: { col: SortColumn }) {
    if (sortColumn !== col) return <span className="text-zinc-300 dark:text-zinc-600">↕</span>;
    return <span className="text-[#1a6b3c] dark:text-green-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const sortableHeader = (
    col: SortColumn,
    label: string,
    align: "left" | "center" | "right" = "center",
  ) => (
    <button
      onClick={() => handleSort(col)}
      className={`inline-flex items-center gap-1 hover:text-[#1a6b3c] dark:hover:text-green-400 transition ${
        align === "right" ? "justify-end" : align === "left" ? "justify-start" : "justify-center"
      }`}
    >
      {label}
      <SortArrow col={col} />
    </button>
  );

  /* ---------- render ---------- */
  if (players.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 sm:p-12 text-center">
        <p className="text-4xl mb-3">🏌️</p>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          No players in the database yet.
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Players appear here once they&apos;re added to tournaments.
        </p>
      </div>
    );
  }

  // Determine which columns have any data across all filtered rows
  const hasAnySelectionData = players.some((p) => p.selectionRate > 0);
  const hasAnyAvgScore = players.some((p) => p.avgScore != null);
  const hasAnyBestFinish = players.some((p) => p.bestFinish != null);
  const hasAnyForm = players.some((p) => p.form.length > 0);

  return (
    <div>
      {/* ── Search & Filters ── */}
      <div className="mb-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 pl-10 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#1a6b3c] focus:ring-2 focus:ring-[#1a6b3c]/20 focus:outline-none transition"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </div>

        {/* Tier chips + Country dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TIER_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setTierFilter(chip.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  tierFilter === chip.value
                    ? "bg-[#1a6b3c] text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="ml-auto">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:border-[#1a6b3c] focus:outline-none"
            >
              <option value="all">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_NAMES[c] ?? c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {sorted.length} {sorted.length === 1 ? "player" : "players"}
          {!hasAnyAvgScore && !hasAnyBestFinish && !hasAnyForm && (
            <span className="ml-2 text-zinc-300 dark:text-zinc-600">· No scoring data yet — columns will appear once tournaments begin</span>
          )}
        </p>
      </div>

      {/* ── Desktop Table (hidden on mobile) ── */}
      {/* Hide Sel %, Avg, Best, Form columns entirely when none of the players have that data */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <th className="px-3 py-3 text-left font-semibold">{sortableHeader("rank", "Rank", "left")}</th>
                <th className="px-3 py-3 text-left font-semibold">{sortableHeader("name", "Player", "left")}</th>
                <th className="px-3 py-3 text-center font-semibold">Country</th>
                <th className="px-3 py-3 text-center font-semibold">{sortableHeader("tier", "Tier")}</th>
                <th className="px-3 py-3 text-center font-semibold">{sortableHeader("tournaments", "Events")}</th>
                {hasAnySelectionData && (
                  <th className="px-3 py-3 text-center font-semibold">{sortableHeader("selectionRate", "Sel %")}</th>
                )}
                {hasAnyAvgScore && (
                  <th className="px-3 py-3 text-center font-semibold">{sortableHeader("avgScore", "Avg")}</th>
                )}
                {hasAnyBestFinish && (
                  <th className="px-3 py-3 text-center font-semibold">{sortableHeader("bestFinish", "Best")}</th>
                )}
                {hasAnyForm && (
                  <th className="px-3 py-3 text-center font-semibold">Form</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const tierCfg = p.tier ? TIER_CONFIG[p.tier] : null;
                const rankColor = tierCfg?.gradFrom ?? "#6b7280";
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-zinc-100 dark:border-zinc-800 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${
                      i % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-900/30" : ""
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: rankColor }}
                      >
                        {p.dataGolfRank ?? "—"}
                      </span>
                    </td>
                    {/* Player */}
                    <td className="px-3 py-2.5">
                      <Link href={`/players/${p.id}`} className="flex items-center gap-2 group">
                        <PlayerAvatar name={p.name} country={p.country} size="sm" />
                        <span className="font-semibold text-zinc-900 dark:text-white group-hover:text-[#1a6b3c] dark:group-hover:text-green-400 group-hover:underline">
                          {p.name}
                        </span>
                      </Link>
                    </td>
                    {/* Country */}
                    <td className="px-3 py-2.5 text-center">
                      <Flag countryCode={p.country} size="sm" />
                    </td>
                    {/* Tier */}
                    <td className="px-3 py-2.5 text-center">
                      {p.tier ? <TierBadge tier={p.tier} size="sm" /> : <span className="text-zinc-300">—</span>}
                    </td>
                    {/* Tournaments */}
                    <td className="px-3 py-2.5 text-center font-medium text-zinc-700 dark:text-zinc-300">
                      {p.tournamentCount}
                    </td>
                    {/* Selection rate */}
                    {hasAnySelectionData && (
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="h-1.5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1a6b3c] dark:bg-green-500"
                              style={{ width: `${Math.min(100, p.selectionRate)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {p.selectionRate > 0 ? `${p.selectionRate.toFixed(0)}%` : "—"}
                          </span>
                        </div>
                      </td>
                    )}
                    {/* Avg score */}
                    {hasAnyAvgScore && (
                      <td className="px-3 py-2.5 text-center">
                        {p.avgScore != null ? (
                          <span className={`font-bold ${p.avgScore < 72 ? "text-green-600 dark:text-green-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {p.avgScore.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    )}
                    {/* Best finish */}
                    {hasAnyBestFinish && (
                      <td className="px-3 py-2.5 text-center">
                        {p.bestFinish != null ? (
                          <span
                            className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-md px-1.5 text-xs font-bold ${
                              p.bestFinish === 1
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : p.bestFinish <= 5
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                  : p.bestFinish <= 10
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                          >
                            {p.bestFinish === 1 ? "🏆" : p.bestFinish}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    )}
                    {/* Form */}
                    {hasAnyForm && (
                      <td className="px-3 py-2.5">
                        <FormDots form={p.form} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="space-y-2 md:hidden">
        {sorted.map((p) => {
          return (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="block rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 transition active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <PlayerAvatar name={p.name} country={p.country} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-white text-sm truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Flag countryCode={p.country} size="sm" />
                    {p.tier && <TierBadge tier={p.tier} size="sm" />}
                    {p.dataGolfRank && (
                      <span className="text-xs text-zinc-400">#{p.dataGolfRank}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {p.avgScore != null && (
                    <p className="text-lg font-bold text-[#1a6b3c] dark:text-green-400">
                      {p.avgScore.toFixed(1)}
                    </p>
                  )}
                  {p.bestFinish != null && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Best: <span className="font-bold">{p.bestFinish === 1 ? "🏆 Win" : `T${p.bestFinish}`}</span>
                    </p>
                  )}
                </div>
              </div>
              {(p.form.length > 0 || p.selectionRate > 0) && (
                <div className="mt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2">
                  <FormDots form={p.form} />
                  {p.selectionRate > 0 && (
                    <span className="text-xs text-zinc-400">
                      {p.selectionRate.toFixed(0)}% picked · {p.tournamentCount} events
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Empty filter state */}
      {sorted.length === 0 && players.length > 0 && (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-8 text-center mt-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No players match your filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setTierFilter("all");
              setCountryFilter("all");
            }}
            className="mt-2 text-xs font-semibold text-[#1a6b3c] dark:text-green-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

/** Render last-5 form dots */
function FormDots({ form }: { form: FormResult[] }) {
  if (form.length === 0) {
    return <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>;
  }
  return (
    <div className="flex items-center justify-center gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          title={f.label}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ backgroundColor: f.color }}
        >
          {f.label.length <= 2 ? f.label : ""}
        </span>
      ))}
    </div>
  );
}
