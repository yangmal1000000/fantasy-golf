"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();

  const links = [
    { href: "/tournaments", label: "Tournaments", active: pathname.startsWith("/tournaments") },
    { href: "/players", label: "Players", active: pathname.startsWith("/players") },
    { href: "/my-teams", label: "My Teams", active: pathname.startsWith("/my-teams") },
    { href: "/leagues", label: "Leagues", active: pathname.startsWith("/leagues") },
    { href: "/tournaments/the-open-2026/leaderboard", label: "Leaderboard", hideOnMd: true, active: pathname.includes("/leaderboard") },
    { href: "/how-to-play", label: "How to Play", hideOnMd: true, active: pathname === "/how-to-play" },
  ];

  return (
    <nav className="hidden items-center gap-0.5 sm:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition relative group ${l.hideOnMd ? "hidden md:block" : ""} ${l.active ? "text-white" : "text-white/55 hover:text-white hover:bg-white/10"}`}
        >
          {l.label}
          <span className={`pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[#c8a951] transition-transform duration-200 ${l.active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
        </Link>
      ))}
    </nav>
  );
}
