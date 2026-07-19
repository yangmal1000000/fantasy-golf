"use client";

/**
 * Referrals page — share invite link, track friends, view vouchers.
 */

import { useState, useEffect, useCallback } from "react";
import SignInPrompt from "@/components/SignInPrompt";

interface Referral {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}
interface Voucher {
  id: string;
  code: string;
  discountPercent: number;
  used: boolean;
  source: string;
  createdAt: string;
}
interface Data {
  referralCode: string;
  referralLink: string;
  stats: {
    invited: number;
    completed: number;
    vouchersEarned: number;
    vouchersUsed: number;
  };
  referrals: Referral[];
  vouchers: Voucher[];
}

export default function ReferralsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetch_ = useCallback(async (): Promise<Data | null> => {
    try {
      const res = await fetch("/api/referrals");
      if (res.ok) return await res.json();
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const d = await fetch_();
      if (!active) return;
      if (d) setData(d);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [fetch_]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referredEmail: email.trim() }),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg(`Invitation sent to ${email.trim()}`);
        setEmail("");
        const d = await fetch_();
        if (d) setData(d);
      } else {
        setMsg(`❌ ${j.error ?? "Failed to invite"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareVia(platform: "whatsapp" | "email" | "twitter") {
    if (!data) return;
    const text = "Join my Fantasy Golf league!";
    const link = data.referralLink;
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + link)}`,
      email: `mailto:?subject=${encodeURIComponent("Fantasy Golf invite")}&body=${encodeURIComponent(text + "\n\n" + link)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
    };
    window.open(urls[platform], "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-20 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-40 rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">Refer a Friend</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Invite friends — you&apos;ll both get a <strong>50% off voucher</strong> when they enter their first paid team.
          </p>
        </div>
        <SignInPrompt
          title="Sign in to get your invite link"
          message="Earn 50% off vouchers for every friend who enters a paid team. Share your link via WhatsApp, email, or Twitter."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-[#0f3d20] dark:text-green-400">Refer a Friend</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Invite friends — you&apos;ll both get a <strong>50% off voucher</strong> when they enter their first paid team.
      </p>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Invited", value: data.stats.invited, icon: "mail" },
          { label: "Completed", value: data.stats.completed, icon: "check" },
          { label: "Vouchers", value: data.stats.vouchersEarned, icon: "ticket" },
          { label: "Used", value: data.stats.vouchersUsed, icon: "money" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-3 text-center shadow-sm dark:bg-zinc-900">
            <p className="text-xl">{s.icon}</p>
            <p className="text-lg font-bold text-[#0f3d20] dark:text-green-400">{s.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Invite link */}
      <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#0f3d20] to-[#1a6b3c] p-5 text-white shadow-lg">
        <h2 className="text-base font-bold">Your Invite Link</h2>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
          <code className="flex-1 truncate font-mono text-sm">{data.referralLink || data.referralCode}</code>
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold transition hover:bg-white/30"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => shareVia("whatsapp")}
            className="flex-1 rounded-xl bg-green-500 py-2 text-sm font-bold text-white transition hover:bg-green-600"
          >
            💬 WhatsApp
          </button>
          <button
            onClick={() => shareVia("email")}
            className="flex-1 rounded-xl bg-blue-500 py-2 text-sm font-bold text-white transition hover:bg-blue-600"
          >
            ✉️ Email
          </button>
          <button
            onClick={() => shareVia("twitter")}
            className="flex-1 rounded-xl bg-black py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
          >
            🐦 Twitter
          </button>
        </div>
      </div>

      {/* Manual invite */}
      <form onSubmit={invite} className="mt-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-[#0f3d20] dark:text-green-400">Send an invite by email</h3>
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1a6b3c] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={!email.trim() || submitting}
            className="rounded-xl bg-[#1a6b3c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
          >
            Invite
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
      </form>

      {/* Vouchers */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h2 className="text-base font-bold text-[#0f3d20] dark:text-green-400">Your Vouchers</h2>
        </div>
        {data.vouchers.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No vouchers yet — invite a friend to earn one!</p>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {data.vouchers.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3">
                <div>
                  <code className="font-mono text-sm font-bold text-[#1a6b3c] dark:text-green-400">{v.code}</code>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {v.discountPercent}% off · {v.source}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  v.used
                    ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                    : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                }`}>
                  {v.used ? "Used" : "Available"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referrals list */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
          <h2 className="text-base font-bold text-[#0f3d20] dark:text-green-400">Referral History</h2>
        </div>
        {data.referrals.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No invitations sent yet.</p>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {data.referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{r.email}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(r.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                }`}>
                  {r.status === "completed" ? "Joined" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
