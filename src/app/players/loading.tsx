export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-3 py-8 sm:px-4">
      <div className="mb-5">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/50" />
      </div>
      <div className="mb-5 h-10 w-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}
