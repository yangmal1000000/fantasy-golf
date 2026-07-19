export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/50" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}
