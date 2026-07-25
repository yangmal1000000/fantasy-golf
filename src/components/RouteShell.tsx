"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function RouteShell({
  children,
  header,
  footer,
  mobileNavigation,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  mobileNavigation: ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminRoute) return children;

  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
      {mobileNavigation}
    </>
  );
}
