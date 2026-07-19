import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6-3a3 3 0 11-6 0 3 3 0 016 0zM9 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Player not found</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        This player doesn&apos;t exist or hasn&apos;t been added to a tournament yet.
      </p>
      <Link
        href="/players"
        className="mt-6 rounded-full bg-[#0a3d2a] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a5c3e]"
      >
        ← Back to Player Rankings
      </Link>
    </div>
  );
}
