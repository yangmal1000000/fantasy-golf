"use client";

/**
 * Generic error boundary for the power rankings page.
 */

export default function PowerRankingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 text-center">
        <p className="text-3xl">📈</p>
        <h2 className="mt-2 text-lg font-bold text-red-700">Couldn&apos;t load rankings</h2>
        <p className="mt-1 text-sm text-red-600">
          {error.message || "Failed to load power rankings."}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-full bg-[#1a6b3c] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#0f3d20]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
