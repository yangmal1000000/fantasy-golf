"use client";

/**
 * Generic error boundary for the daily prediction page.
 */

export default function DailyPredictionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 text-center">
        <p className="text-3xl">🎯</p>
        <h2 className="mt-2 text-lg font-bold text-red-700">Prediction game unavailable</h2>
        <p className="mt-1 text-sm text-red-600">
          {error.message || "Failed to load daily prediction."}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-full bg-purple-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-purple-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
