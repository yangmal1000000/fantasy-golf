"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ADMIN_ROLE_LABELS,
  hasAdminCapability,
  type AdminCapability,
  type AdminRoleName,
} from "@/lib/admin-roles";

const NAV_ITEMS: Array<{
  label: string;
  href: string;
  icon: string;
  required: AdminCapability;
}> = [
  {
    label: "Operations",
    href: "/admin",
    icon: "📊",
    required: "VIEW_DASHBOARD",
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: "👤",
    required: "VIEW_CUSTOMERS",
  },
  {
    label: "Rocket Control",
    href: "/rocket-control",
    icon: "🚀",
    required: "OPERATE_TOURNAMENT",
  },
  {
    label: "Target Control",
    href: "/target-control",
    icon: "🎯",
    required: "MANAGE_ADMINS",
  },
];

export default function AdminSidebar({ role }: { role: AdminRoleName }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="press-feedback fixed left-3 top-16 z-40 rounded-xl border border-white/15 bg-[#0f3d20] px-3 py-2 text-xs font-black text-white shadow-lg lg:hidden"
        aria-label="Open admin navigation"
      >
        Admin menu
      </button>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-[#0f3d20] text-white transition-transform lg:z-40 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4a843] text-sm">
            ⛳
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">Fantasy Golf</p>
            <p className="text-xs leading-tight text-white/65">
              Operations
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.filter((item) =>
            hasAdminCapability(role, item.required),
          ).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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

          <div className="mt-4 border-t border-white/10 px-3 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
              {ADMIN_ROLE_LABELS[role]}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Legacy revenue, settings and tournament mutation tools are
              quarantined during the Rocket test.
            </p>
          </div>
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <span>←</span> Back to Site
          </Link>
        </div>
      </aside>
    </>
  );
}
