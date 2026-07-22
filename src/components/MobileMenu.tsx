"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { TargetIcon } from "@/components/icons";

const MENU_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/my-teams", label: "My Teams" },
  { href: "/players", label: "Players" },
  { href: "/stats", label: "Stats" },
  { href: "/leagues", label: "Leagues" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/how-to-play", label: "How to Play" },
];

export default function MobileMenu() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [targetPreviewAccess, setTargetPreviewAccess] = useState<{
    userId: string;
    allowed: boolean;
  } | null>(null);
  const authenticatedUserId = user?.id;
  const targetPreviewAllowed = Boolean(
    targetPreviewAccess &&
      targetPreviewAccess.userId === authenticatedUserId &&
      targetPreviewAccess.allowed,
  );

  useEffect(() => {
    if (!authenticatedUserId) {
      return;
    }

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

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white sm:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-site-menu"
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={close}
            aria-label="Close menu"
          />
          <div
            id="mobile-site-menu"
            className="absolute left-0 right-0 top-full z-50 border-t border-white/10 bg-[#0a3d2a] shadow-xl sm:hidden"
          >
            <nav className="mx-auto max-w-6xl px-3 py-2" aria-label="Mobile navigation">
              {targetPreviewAllowed && (
                <Link
                  href="/target"
                  onClick={close}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    pathname.startsWith("/target")
                      ? "bg-white/10 text-white"
                      : "text-[#e6cf87] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TargetIcon className="h-4 w-4" /> Target Challenge
                  </span>
                  {pathname.startsWith("/target") && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c8a951]" />
                  )}
                </Link>
              )}

              {MENU_LINKS.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#c8a951]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
