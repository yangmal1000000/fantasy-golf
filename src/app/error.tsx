"use client";

import { GolferIcon } from "@/components/icons";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <GolferIcon className="h-16 w-16 text-[#0a3d2a] dark:text-green-400" />
      <h1 className="mt-4 text-2xl font-bold text-[#0f3d20] dark:text-white">
        Out of bounds
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Something went wrong on our end. Try again, and if the problem persists
        let us know via the contact page.
      </p>
      <pre className="mt-4 max-w-lg overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {error.message}
      </pre>
      {error.digest && (
        <p className="mt-2 text-xs text-zinc-400">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-[#1a6b3c] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f3d20]"
      >
        Try again
      </button>
    </div>
  );
}
