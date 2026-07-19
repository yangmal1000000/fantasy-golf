import Link from "next/link";
import { GolfFlagIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <GolfFlagIcon className="h-20 w-20 text-[#0a3d2a] dark:text-green-400" />
      <h1 className="mt-4 text-3xl font-bold text-[#0a3d2a] dark:text-green-400">
        Lost in the rough
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        We couldn&rsquo;t find that page. It might have been moved, deleted, or never
        existed.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-[#0a3d2a] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a5c3e]"
      >
        Back to home
      </Link>
    </div>
  );
}
