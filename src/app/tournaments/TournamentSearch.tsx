"use client";

/**
 * TournamentSearch — debounced client-side search that updates URL params.
 * Preserves existing tour/cat/year/status filters.
 */

import { useEffect, useState, useRef } from "react";

interface TournamentSearchProps {
  defaultValue: string;
  baseUrl: string;
  baseParams: Record<string, string>;
}

export default function TournamentSearch({
  defaultValue,
  baseUrl,
  baseParams,
}: TournamentSearchProps) {
  const [value, setValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushSearch(val: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v && v !== "all" && v !== "men") params.set(k, v);
    }
    if (val.trim()) params.set("q", val.trim());
    const qs = params.toString();
    const url = `${baseUrl}${qs ? `?${qs}` : ""}`;
    window.location.href = url;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushSearch(val), 400);
  }

  return (
    <div className="mt-3 relative">
      <input
        type="text"
        placeholder="Search tournaments or courses…"
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 pl-9 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#0a3d2a] focus:ring-2 focus:ring-[#0a3d2a]/20 focus:outline-none transition"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
        />
      </svg>
      {value && (
        <button
          onClick={() => {
            setValue("");
            pushSearch("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
