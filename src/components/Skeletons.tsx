/**
 * Skeletons — Loading placeholder components.
 * Gray pulsing shapes with shimmer animation.
 */

export function TournamentCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
      <div className="skeleton-shimmer h-32 w-full" />
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-5 w-20 rounded-full" />
          <div className="skeleton-shimmer h-3 w-12 rounded" />
        </div>
        <div className="skeleton-shimmer h-6 w-3/4 rounded" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded" />
        <div className="flex justify-between pt-2">
          <div className="skeleton-shimmer h-8 w-24 rounded-xl" />
          <div className="skeleton-shimmer h-8 w-12 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
      {/* Header */}
      <div className="flex gap-4 bg-[#0a3d2a] px-4 py-3">
        <div className="skeleton-shimmer h-4 w-12 rounded" style={{ background: "rgba(255,255,255,0.15)" }} />
        <div className="skeleton-shimmer h-4 flex-1 rounded" style={{ background: "rgba(255,255,255,0.15)" }} />
        <div className="skeleton-shimmer h-4 w-16 rounded" style={{ background: "rgba(255,255,255,0.15)" }} />
      </div>
      {/* Rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="skeleton-shimmer h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-4 w-1/3 rounded" />
              <div className="skeleton-shimmer h-3 w-1/4 rounded" />
            </div>
            <div className="skeleton-shimmer h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header skeleton */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-7 w-48 rounded" />
            <div className="skeleton-shimmer h-4 w-32 rounded" />
          </div>
          <div className="skeleton-shimmer h-12 w-12 rounded-full" />
        </div>
        <div className="mt-4 flex gap-6 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="skeleton-shimmer h-8 w-20 rounded" />
          <div className="skeleton-shimmer h-8 w-20 rounded" />
          <div className="skeleton-shimmer h-8 w-20 rounded" />
        </div>
      </div>
      {/* Player skeletons */}
      <div className="mt-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <div className="skeleton-shimmer h-4 w-32 rounded" />
                <div className="skeleton-shimmer h-3 w-20 rounded-full" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton-shimmer h-14 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TournamentListSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="skeleton-shimmer h-8 w-48 rounded mb-2" />
        <div className="skeleton-shimmer h-4 w-64 rounded" />
      </div>
      <div className="grid gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <TournamentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
