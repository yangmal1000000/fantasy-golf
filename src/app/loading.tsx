export default function AppLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-6"
      role="status"
      aria-label="Loading page"
    >
      <div className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-[#c8a951]/20">
        <div className="navigation-loading-bar h-full w-1/3 bg-[#c8a951]" />
      </div>
      <div className="mb-6 space-y-2">
        <div className="skeleton-shimmer h-7 w-44 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-64 max-w-full rounded" />
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="skeleton-shimmer h-3 w-36 rounded" />
          <div className="mt-3 skeleton-shimmer h-6 w-4/5 rounded" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="skeleton-shimmer h-11 w-full rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
