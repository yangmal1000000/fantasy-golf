"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isSiteNavItemActive,
  SITE_NAV_LINKS,
} from "@/lib/site-navigation";

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav
      className="hidden items-center gap-0.5 xl:flex"
      aria-label="Primary navigation"
    >
      {SITE_NAV_LINKS.map((link) => {
        const active = isSiteNavItemActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`group relative whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium transition 2xl:px-3 2xl:text-sm ${
              active
                ? "text-white"
                : "text-white/55 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
            <span
              className={`pointer-events-none absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-[#c8a951] transition-transform duration-200 2xl:inset-x-3 ${
                active
                  ? "scale-x-100"
                  : "scale-x-0 group-hover:scale-x-100"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
