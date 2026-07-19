"use client";

import { useState } from "react";

export default function AdminGate() {
  const [loading, setLoading] = useState(false);

  function handleAccess() {
    setLoading(true);
    // Redirect to the auth route which sets a cookie and redirects back
    window.location.href = "/api/admin/auth";
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-zinc-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0f3d20] text-3xl">
          🔒
        </div>
        <h1 className="mt-4 text-xl font-bold text-zinc-800">
          Admin Access Required
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          This area is restricted to tournament administrators. Click below to
          authenticate.
        </p>
        <button
          onClick={handleAccess}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#1a6b3c] py-2.5 text-sm font-bold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
        >
          {loading ? "Authenticating…" : "Enter Admin Panel"}
        </button>
      </div>
    </div>
  );
}
