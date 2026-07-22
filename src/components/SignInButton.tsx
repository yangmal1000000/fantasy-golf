"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { GolferIcon, TargetIcon, TrophyIcon } from "@/components/icons";

export default function SignInButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetPreviewAccess, setTargetPreviewAccess] = useState<{
    userId: string;
    allowed: boolean;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const authenticatedUserId = user?.id;
  const targetPreviewAllowed = Boolean(
    targetPreviewAccess &&
      targetPreviewAccess.userId === authenticatedUserId &&
      targetPreviewAccess.allowed,
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!authenticatedUserId) return;

    const controller = new AbortController();
    const checkedUserId = authenticatedUserId;

    async function checkTargetPreviewAccess() {
      try {
        const response = await fetch("/api/target-preview/access", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          setTargetPreviewAccess({ userId: checkedUserId, allowed: false });
          return;
        }

        const result = (await response.json()) as { allowed?: boolean };
        setTargetPreviewAccess({
          userId: checkedUserId,
          allowed: result.allowed === true,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setTargetPreviewAccess({ userId: checkedUserId, allowed: false });
        }
      }
    }

    void checkTargetPreviewAccess();
    return () => controller.abort();
  }, [authenticatedUserId]);

  // Loading skeleton — prevents hydration flash
  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-full bg-white/20" />;
  }

  // Signed out — show Google sign-in button
  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex whitespace-nowrap items-center gap-2 rounded-full bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#1a1a1a] shadow transition hover:bg-[#d4b76a] touch-target"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign In
      </button>
    );
  }

  // Signed in — show avatar + dropdown
  const name = user.user_metadata?.full_name ?? user.email ?? "User";
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const initial = (name as string)?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm font-medium text-white transition hover:bg-white/20"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c8a951] text-xs font-bold text-[#1a1a1a]">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[80px] truncate sm:inline">{name}</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {name}
            </p>
            <p className="truncate text-xs text-zinc-400">{user.email}</p>
          </div>
          <Link
            href="/my-teams"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <GolferIcon className="h-4 w-4" /> My Teams
          </Link>
          <Link
            href="/leagues"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <TrophyIcon className="h-4 w-4" /> Leagues
          </Link>
          {targetPreviewAllowed && (
            <Link
              href="/target"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:hidden"
            >
              <TargetIcon className="h-4 w-4" /> Target Challenge
            </Link>
          )}
          <button
            onClick={() => {
              signOut();
              setMenuOpen(false);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
