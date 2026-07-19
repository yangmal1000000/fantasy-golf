"use client";

/**
 * LeagueChat — Real-time-ish chat for league pages.
 * Polls every 5 seconds for new messages.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  body: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

interface LeagueChatProps {
  leagueId: string;
  leagueName: string;
  currentUserId: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function avatarLetter(name: string): string {
  return (name ?? "?").trim()[0]?.toUpperCase() ?? "?";
}

export default function LeagueChat({ leagueId, leagueName, currentUserId }: LeagueChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async (): Promise<ChatMessage[]> => {
    try {
      const res = await fetch(`/api/league-messages?leagueId=${encodeURIComponent(leagueId)}`);
      if (res.ok) {
        const data = await res.json();
        return data.messages ?? [];
      }
    } catch {
      // ignore
    }
    return [];
  }, [leagueId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const msgs = await fetchMessages();
      if (active) setMessages(msgs);
    };
    load();
    const t = setInterval(load, 5000);
    return () => { active = false; clearInterval(t); };
  }, [fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!currentUserId) {
      setError("Please sign in to chat.");
      return;
    }

    setSending(true);
    setError(null);
    const prev = text;
    setText("");

    try {
      const res = await fetch("/api/league-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, text: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to send");
        setText(prev); // restore
      } else {
        const data = await res.json();
        // Prepend/append via fetch for consistency
        setMessages((prev2) => [...prev2, data.message]);
      }
    } catch {
      setError("Network error");
      setText(prev);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const messageCount = messages.length;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-b border-zinc-100 px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="text-base font-bold text-[#0f3d20]">League Chat</h2>
          {messageCount > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
              {messageCount}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="max-h-80 min-h-[120px] space-y-3 overflow-y-auto bg-zinc-50/50 p-4"
          >
            {messages.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-3xl">💬</p>
                <p className="mt-2 text-sm text-zinc-500">
                  No messages yet. Start the conversation in {leagueName}!
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.userId === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                  >
                    {m.userAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.userAvatar}
                        alt={m.userName}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a6b3c] text-xs font-bold text-white">
                        {avatarLetter(m.userName)}
                      </div>
                    )}
                    <div className={`min-w-0 max-w-[75%] ${isMe ? "items-end text-right" : ""}`}>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="font-semibold text-zinc-600">{isMe ? "You" : m.userName}</span>
                        <span>{timeAgo(m.createdAt)}</span>
                      </div>
                      <div
                        className={`mt-0.5 inline-block rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "bg-[#1a6b3c] text-white"
                            : "bg-white text-zinc-800 border border-zinc-200"
                        }`}
                      >
                        {m.body}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={send} className="flex gap-2 border-t border-zinc-100 p-3">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder={currentUserId ? "Type a message…" : "Sign in to chat"}
              disabled={!currentUserId || sending}
              className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-[#1a6b3c] focus:ring-2 focus:ring-[#1a6b3c]/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending || !currentUserId}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a6b3c] text-white transition hover:bg-[#0f3d20] disabled:opacity-40"
              aria-label="Send"
            >
              {sending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
                </svg>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
