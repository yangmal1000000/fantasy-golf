"use client";

/**
 * ShareCard — Generates a downloadable team share card via canvas.
 * Shows team name, 5 players with tier badges, tournament name + dates,
 * prize pool, and position. Uses Web Share API on mobile, falls back to download.
 *
 * Variants:
 *   - default: "Share your team" CTA after team submission
 *   - victory: "Share your victory" after winning
 */

import { useRef } from "react";
import TierBadge from "./TierBadge";
import { formatGBP, formatDateRange } from "@/lib/ui";

interface SharePlayer {
  playerName: string;
  tier: string;
  country?: string | null;
}

interface ShareCardProps {
  teamName: string;
  tournamentName: string;
  tournamentDates?: { start: Date | string; end: Date | string };
  players: SharePlayer[];
  totalStrokes?: number;
  position?: number;
  prizePool?: number; // pence
  variant?: "default" | "victory";
}

const TIER_COLORS: Record<string, string> = {
  T1_10: "#b45309",
  T11_20: "#1e3a5f",
  T21_30: "#166534",
  T31_50: "#7c3aed",
  T51_PLUS: "#4b5563",
};

const TIER_SHORT: Record<string, string> = {
  T1_10: "T1",
  T11_20: "T2",
  T21_30: "T3",
  T31_50: "T4",
  T51_PLUS: "T5",
};

export default function ShareCard({
  teamName,
  tournamentName,
  tournamentDates,
  players,
  totalStrokes,
  position,
  prizePool,
  variant = "default",
}: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 600;
    const H = variant === "victory" ? 600 : 540;
    canvas.width = W;
    canvas.height = H;

    // Background — golf gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0f3d20");
    bgGrad.addColorStop(0.5, "#1a6b3c");
    bgGrad.addColorStop(1, "#0f3d20");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative golf ball circles
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.arc(500, 80, 120, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(80, 420, 100, 0, 2 * Math.PI);
    ctx.fill();

    // Gold accent bar
    ctx.fillStyle = "#d4a843";
    ctx.fillRect(0, 0, W, 6);

    // Victory banner
    if (variant === "victory" && position === 1) {
      ctx.fillStyle = "#d4a843";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏆 CHAMPION 🏆", W / 2, 40);
    } else {
      ctx.fillStyle = "#d4a843";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⛳ FANTASY GOLF", W / 2, 35);
    }

    // Tournament name
    let y = variant === "victory" ? 65 : 55;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(tournamentName, W / 2, y);

    // Dates
    if (tournamentDates) {
      y += 18;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px system-ui, sans-serif";
      try {
        const dates = formatDateRange(
          new Date(tournamentDates.start),
          new Date(tournamentDates.end),
        );
        ctx.fillText(dates, W / 2, y);
      } catch {
        /* ignore */
      }
    }

    // Team name
    y += 30;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText(teamName, W / 2, y);

    // Position/score/prize badge
    y += 25;
    const badges: string[] = [];
    if (position) badges.push(`Position: ${position}`);
    if (totalStrokes) badges.push(`Total: ${totalStrokes}`);
    if (prizePool && prizePool > 0) {
      badges.push(`Playing for ${formatGBP(prizePool)}`);
    }
    if (badges.length > 0) {
      ctx.fillStyle = "#d4a843";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(badges.join("  ·  "), W / 2, y);
    }

    // Divider
    ctx.strokeStyle = "rgba(212, 168, 67, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, y + 18);
    ctx.lineTo(W - 60, y + 18);
    ctx.stroke();

    // Players
    ctx.textAlign = "left";
    const startY = y + 48;
    const rowH = 56;

    players.forEach((player, i) => {
      const py = startY + i * rowH;
      const tier = player.tier;
      const color = TIER_COLORS[tier] ?? "#4b5563";
      const short = TIER_SHORT[tier] ?? "T?";

      // Tier badge circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(50, py + 20, 18, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tier text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(short, 50, py + 24);
      ctx.textAlign = "left";

      // Player name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText(player.playerName, 85, py + 18);

      // Country
      if (player.country) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText(player.country, 85, py + 35);
      }
    });

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Fantasy Golf · Play with friends · Win big ⛳", W / 2, H - 20);

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return;

    const file = new File([blob], `team-${teamName.replace(/\s+/g, "-")}.png`, {
      type: "image/png",
    });

    // Try Web Share API (mobile)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title:
            variant === "victory"
              ? `I won ${tournamentName}! 🏆`
              : `My Fantasy Golf Team: ${teamName}`,
          text:
            variant === "victory"
              ? `I just won ${tournamentName} on Fantasy Golf! 🏆`
              : `Check out my team for ${tournamentName}!`,
          files: [file],
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to download
      }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isVictory = variant === "victory" && position === 1;

  return (
    <div>
      {/* Preview card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f3d20] to-[#1a6b3c] p-5 text-white shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#d4a843]">
              {isVictory ? "🏆 CHAMPION" : "⛳ Fantasy Golf"}
            </p>
            <p className="text-xs text-white/60">
              {tournamentName}
              {tournamentDates && (
                <> · {formatDateRange(new Date(tournamentDates.start), new Date(tournamentDates.end))}</>
              )}
            </p>
          </div>
          <div className="flex gap-1">
            {players.map((p, i) => (
              <TierBadge key={i} tier={p.tier} size="sm" />
            ))}
          </div>
        </div>
        <h3 className="text-xl font-bold">{teamName}</h3>
        <p className="mt-1 text-sm text-[#d4a843]">
          {position ? `Position: ${position}` : ""}
          {position && totalStrokes ? " · " : ""}
          {totalStrokes ? `Total: ${totalStrokes}` : ""}
          {prizePool ? ` · Prize Pool: ${formatGBP(prizePool)}` : ""}
        </p>
      </div>

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Share button */}
      <button
        onClick={handleShare}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition ${
          isVictory
            ? "bg-gradient-to-r from-[#d4a843] to-amber-600 hover:opacity-90"
            : "bg-[#1a6b3c] hover:bg-[#0f3d20] dark:bg-green-800 dark:hover:bg-green-900"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        {isVictory ? "Share Your Victory" : "Share Team Card"}
      </button>
    </div>
  );
}
