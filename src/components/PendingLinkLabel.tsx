"use client";

import { useLinkStatus } from "next/link";

export default function PendingLinkLabel({
  idle,
  pending,
}: {
  idle: string;
  pending: string;
}) {
  const { pending: isPending } = useLinkStatus();

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span
        aria-hidden="true"
        className={`h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin ${
          isPending ? "opacity-100" : "opacity-0"
        }`}
      />
      <span aria-live="polite">{isPending ? pending : idle}</span>
    </span>
  );
}
