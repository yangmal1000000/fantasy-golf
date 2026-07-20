"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: "📊",
  },
  {
    label: "Tournaments",
    href: "/admin/tournaments",
    icon: "🏆",
  },
  {
    label: "Season",
    href: "/admin/season",
    icon: "📅",
  },
  {
    label: "Revenue",
    href: "/admin/revenue",
    icon: "💰",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: "⚙️",
  },
  {
    label: "Data Feeds",
    href: "/admin/data",
    icon: "📡",
  },
];

const TOURNAMENT_SUBNAV = [
  { label: "Players", key: "players" },
  { label: "Scores", key: "scores" },
  { label: "Teams", key: "teams" },
  { label: "Payouts", key: "payouts" },
  { label: "Messages", key: "messages" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  // Detect tournament context for sub-navigation
  const tournamentMatch = pathname.match(/\/admin\/tournaments\/([^/]+)/);
  const tournamentId = tournamentMatch?.[1];
  const isTournamentContext = !!tournamentId && !pathname.endsWith("/tournaments");

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-[#0f3d20] text-white lg:translate-x-0 -translate-x-full transition-transform">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4a843] text-sm">
          ⛳
        </span>
        <div>
          <p className="font-bold text-sm leading-tight">Fantasy Golf</p>
          <p className="text-xs text-white/65 leading-tight">Admin Panel</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {/* Tournament sub-navigation */}
        {isTournamentContext && (
          <div className="pt-4 mt-4 border-t border-white/10">
            <p className="px-3 mb-1 text-xs font-bold uppercase tracking-wider text-white/55">
              This Tournament
            </p>
            {TOURNAMENT_SUBNAV.map((sub) => {
              const href = `/admin/tournaments/${tournamentId}/${sub.key}`;
              const active = pathname === href;
              return (
                <Link
                  key={sub.key}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-base">•</span>
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
        >
          <span>←</span> Back to Site
        </Link>
      </div>
    </aside>
  );
}
