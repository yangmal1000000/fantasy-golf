"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[#0a3d2a] text-white shadow-lg safe-area-top">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-2 sm:px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c8a951]">
            <svg className="h-4 w-4 text-[#1a1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0h5m-5 0v5m-7 7h5m0 0v-5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-3" />
            </svg>
          </span>
          <span className="hidden xs:inline sm:inline">Fantasy Golf</span>
        </Link>

        <nav className="hidden items-center gap-0.5 sm:flex">
          <NavLink href="/tournaments" label="Tournaments" active={pathname.startsWith("/tournaments")} />
          <NavLink href="/players" label="Players" active={pathname.startsWith("/players")} />
          <NavLink href="/my-teams" label="My Teams" active={pathname.startsWith("/my-teams")} />
          <NavLink href="/leagues" label="Leagues" active={pathname.startsWith("/leagues")} />
          <NavLink href="/tournaments/the-open-2026/leaderboard" label="Leaderboard" hideOnMd active={pathname.includes("/leaderboard")} />
          <NavLink href="/how-to-play" label="How to Play" hideOnMd active={pathname === "/how-to-play"} />
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBellSlot />
          <ThemeToggleSlot />
          <SignInSlot />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, hideOnMd = false, active = false }: { href: string; label: string; hideOnMd?: boolean; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition relative group ${hideOnMd ? "hidden md:block" : ""} ${active ? "text-white" : "text-white/55 hover:text-white hover:bg-white/10"}`}
    >
      {label}
      <span className={`pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[#c8a951] transition-transform duration-200 ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
    </Link>
  );
}

/** Wrapper slots so Navbar stays a thin client component */
function NotificationBellSlot() {
  return <BellIcon />;
}
function BellIcon() {
  return (
    <button className="rounded-md p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition" aria-label="Notifications">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
    </button>
  );
}
function ThemeToggleSlot() {
  return (
    <button className="rounded-md p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition" aria-label="Toggle theme">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
    </button>
  );
}
function SignInSlot() {
  return (
    <button className="flex whitespace-nowrap items-center gap-1.5 rounded-full bg-[#c8a951] px-3.5 py-1.5 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#d4b76a]">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
      Sign In
    </button>
  );
}
