"use client";

import { useState } from "react";

export default function CustomerPiiReveal({
  customerId,
  maskedEmail,
  canReveal,
}: {
  customerId: string;
  maskedEmail: string;
  canReveal: boolean;
}) {
  const [email, setEmail] = useState(maskedEmail);
  const [status, setStatus] = useState<"idle" | "loading" | "revealed" | "error">(
    "idle",
  );

  async function reveal() {
    if (!canReveal || status === "loading" || status === "revealed") return;
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(customerId)}/pii`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Customer record inspection" }),
        },
      );
      if (!response.ok) throw new Error("Reveal denied");
      const payload = (await response.json()) as { email?: string };
      if (!payload.email) throw new Error("Email unavailable");
      setEmail(payload.email);
      setStatus("revealed");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <p className="break-all text-sm text-zinc-500">{email}</p>
      {canReveal && status !== "revealed" && (
        <button
          type="button"
          onClick={reveal}
          disabled={status === "loading"}
          className="press-feedback rounded-lg border border-zinc-300 px-2 py-1 text-[10px] font-black text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {status === "loading" ? "Revealing…" : "Reveal email"}
        </button>
      )}
      {status === "revealed" && (
        <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">
          Revealed · audited
        </span>
      )}
      {status === "error" && (
        <span className="text-[10px] font-black text-red-600">
          Reveal denied
        </span>
      )}
    </div>
  );
}
