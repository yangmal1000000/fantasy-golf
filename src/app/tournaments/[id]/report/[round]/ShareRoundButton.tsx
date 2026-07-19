"use client";

import { useState } from "react";

interface ShareRoundButtonProps {
  tournamentId: string;
  text: string;
}

export default function ShareRoundButton({ tournamentId, text }: ShareRoundButtonProps) {
  const [copied, setCopied] = useState(false);

  async function shareToChat() {
    // Find all leagues for the user via fetch, then ask which league to post to.
    // For simplicity, we copy to clipboard + link to tournaments list.
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Round Report",
          text,
          url: window.location.href,
        });
        return;
      } catch {
        /* cancelled */
      }
    }
    await shareToChat();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={nativeShare}
        className="flex items-center gap-2 rounded-full bg-[#1a6b3c] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#0f3d20]"
      >
        <span>📤</span>
        Share Report
      </button>
      <button
        onClick={shareToChat}
        className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
      >
        <span>📋</span>
        {copied ? "Copied!" : "Copy Text"}
      </button>
    </div>
  );
}
