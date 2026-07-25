"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    requestAnimationFrame(() => openButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key !== "Tab" || !mobilePanelRef.current) return;
      const focusable = Array.from(
        mobilePanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [closeMobile, mobileOpen]);

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="press-feedback fixed left-3 top-3 z-40 min-h-11 rounded-xl border border-white/15 bg-[#0f3d20] px-4 py-2 text-sm font-black text-white shadow-lg lg:hidden"
        aria-label="Open admin navigation"
        aria-expanded={mobileOpen}
        aria-controls="mobile-admin-navigation"
      >
        Admin menu
      </button>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#0f3d20] text-white lg:flex">
        <SidebarContent
          role={role}
          pathname={pathname}
          onNavigate={() => undefined}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-hidden="true"
            onClick={closeMobile}
            className="absolute inset-0 bg-black/55"
            tabIndex={-1}
          />
          <aside
            ref={mobilePanelRef}
            id="mobile-admin-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-[#0f3d20] text-white shadow-2xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMobile}
              className="press-feedback absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xl"
              aria-label="Close admin navigation"
            >
              ×
            </button>
            <SidebarContent
              role={role}
              pathname={pathname}
              onNavigate={closeMobile}
            />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarContent({
  role,
  pathname,
  onNavigate,
}: {
  role: AdminRoleName;
  pathname: string;
  onNavigate: () => void;
}) {
  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <>
      <div className="flex min-h-16 items-center gap-2 border-b border-white/10 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4a843] text-sm text-[#0f3d20]">
          ⛳
        </span>
        <div>
          <p className="text-sm font-bold leading-tight">Fantasy Golf</p>
          <p className="text-xs leading-tight text-white/70">Operations</p>
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
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}

        <div className="mt-4 border-t border-white/10 px-3 pt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60">
            {ADMIN_ROLE_LABELS[role]}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/70">
            Legacy revenue, settings and tournament mutation tools are
            unavailable during the Rocket test.
          </p>
        </div>
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden="true">←</span> Back to Site
        </Link>
      </div>
    </>
  );
}
