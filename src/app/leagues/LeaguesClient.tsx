"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface LeagueMember {
  id: string;
  name: string;
  joinedAt: string;
}

interface League {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  createdAt: string;
  memberCount: number;
  members: LeagueMember[];
}

export default function LeaguesClient({
  leagues,
  signedIn = false,
}: {
  leagues: League[];
  signedIn?: boolean;
}) {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!signedIn && !user) {
      signInWithGoogle();
      return;
    }
    if (!newName.trim()) {
      setError("League name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leagues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create league");
      }
      const data = await res.json();
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      router.push(`/leagues/${data.leagueId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin() {
    setError(null);
    if (!signedIn && !user) {
      signInWithGoogle();
      return;
    }
    if (!joinCode.trim()) {
      setError("Invite code is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join league");
      }
      const data = await res.json();
      setJoinCode("");
      setShowJoin(false);
      router.push(`/leagues/${data.leagueId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function copyInvite(code: string, leagueId: string) {
    navigator.clipboard?.writeText(code);
    setCopiedId(leagueId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div>
      {/* Action buttons — stack on mobile */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <button
          onClick={() => { setShowCreate(!showCreate); setShowJoin(false); setError(null); }}
          className="rounded-xl bg-[#0a3d2a] py-3 text-sm font-bold text-white shadow transition hover:bg-[#0a3d2a] touch-target"
        >
          Create League
        </button>
        <button
          onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setError(null); }}
          className="rounded-xl border-2 border-[#0a3d2a] py-3 text-sm font-bold text-[#0a3d2a] transition hover:bg-[#0a3d2a]/5 touch-target dark:text-green-400 dark:border-green-600"
        >
          Join with Code
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-2xl border-2 border-[#0a3d2a]/20 bg-white p-4 shadow-sm dark:bg-zinc-900 sm:p-5">
          <h2 className="mb-4 text-lg font-bold text-[#0a3d2a] dark:text-green-400">Create New League</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">League Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sunday Fourball"
                maxLength={50}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-base outline-none focus:border-[#0a3d2a] focus:ring-2 focus:ring-[#0a3d2a]/20 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Description (optional)</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="The bragging rights league for the lads..."
                maxLength={200}
                rows={2}
                className="w-full resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-base outline-none focus:border-[#0a3d2a] focus:ring-2 focus:ring-[#0a3d2a]/20 dark:text-white"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="w-full rounded-xl bg-[#c8a951] py-3 text-sm font-bold text-[#1a1a1a] shadow transition enabled:hover:bg-[#d4b76a] disabled:opacity-50 touch-target"
            >
              {submitting ? "Creating..." : "Create League"}
            </button>
          </div>
        </div>
      )}

      {/* Join form */}
      {showJoin && (
        <div className="mb-6 rounded-2xl border-2 border-[#0a3d2a]/20 bg-white p-4 shadow-sm dark:bg-zinc-900 sm:p-5">
          <h2 className="mb-4 text-lg font-bold text-[#0a3d2a] dark:text-green-400">Join a League</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Invite Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Paste invite code here..."
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-base outline-none focus:border-[#0a3d2a] focus:ring-2 focus:ring-[#0a3d2a]/20 dark:text-white"
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={submitting}
              className="w-full rounded-xl bg-[#0a3d2a] py-3 text-sm font-bold text-white shadow transition enabled:hover:bg-[#0a3d2a] disabled:opacity-50 touch-target"
            >
              {submitting ? "Joining..." : "Join League →"}
            </button>
          </div>
        </div>
      )}

      {/* Leagues list */}
      {leagues.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900 sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0a3d2a]/10 text-3xl">
            
          </div>
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">No leagues yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create a league or join one with an invite code to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-lg dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">{league.name}</h2>
                  {league.description && (
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{league.description}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    👥 {league.memberCount} {league.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400">Invite Code</p>
                  <button
                    onClick={() => copyInvite(league.inviteCode, league.id)}
                    className="mt-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 font-mono text-xs font-bold text-[#0a3d2a] transition hover:bg-zinc-100 dark:hover:bg-zinc-700 touch-target"
                    title="Click to copy"
                  >
                    {copiedId === league.id ? "✓ Copied!" : league.inviteCode.slice(0, 8) + "..."}
                  </button>
                </div>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 p-3 sm:p-4">
                <Link
                  href={`/leagues/${league.id}`}
                  className="block w-full rounded-xl bg-[#0a3d2a] py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#0a3d2a] touch-target"
                >
                  View League →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
