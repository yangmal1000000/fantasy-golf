"use client";

import { useState } from "react";

interface SentMessage {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
}

const TEMPLATES = [
  {
    label: "Entries closing soon",
    subject: "⏰ Entries Closing Soon!",
    body: "Just a reminder that entries for {{tournament}} close soon. Make sure your team is submitted and paid up!",
  },
  {
    label: "Round X scores updated",
    subject: "📊 Scores Updated",
    body: "Round scores have been updated for {{tournament}}. Check the leaderboard to see how your team is doing!",
  },
  {
    label: "Tournament complete",
    subject: "🏆 Tournament Complete!",
    body: "The {{tournament}} is over and final scores are in. Check the leaderboard to see the final standings and payouts!",
  },
];

export default function MessageCenter({
  tournamentId,
  tournamentName,
  messages,
  recipientCount,
}: {
  tournamentId: string;
  tournamentName: string;
  messages: SentMessage[];
  recipientCount: number;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setFeedback("Subject and body are required");
      return;
    }

    setSending(true);
    setFeedback("Sending…");
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback(`✅ Sent to ${data.recipients} entrant${data.recipients !== 1 ? "s" : ""}`);
        setSubject("");
        setBody("");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const data = await res.json();
        setFeedback(`❌ ${data.error ?? "Failed to send"}`);
      }
    } catch {
      setFeedback("❌ Network error");
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(tpl: (typeof TEMPLATES)[number]) {
    setSubject(tpl.subject);
    setBody(tpl.body.replace("{{tournament}}", tournamentName));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Compose */}
      <div className="space-y-4">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <h3 className="mb-4 font-semibold text-zinc-900">Compose Message</h3>
          {feedback && (
            <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
              {feedback}
            </div>
          )}

          {/* Quick templates */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  onClick={() => applyTemplate(tpl)}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-[#1a6b3c] hover:text-white"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Type your message…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Will be sent to{" "}
                <strong>{recipientCount}</strong> entrant
                {recipientCount !== 1 ? "s" : ""}
              </p>
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-[#1a6b3c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
              >
                {sending ? "Sending…" : "📤 Send Message"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h3 className="font-semibold text-zinc-900">Sent Messages</h3>
          <p className="text-xs text-zinc-500">{messages.length} total</p>
        </div>
        {messages.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            No messages sent yet.
          </div>
        ) : (
          <div className="max-h-[600px] divide-y divide-zinc-100 overflow-y-auto">
            {messages.map((m) => (
              <div key={m.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900">{m.subject}</p>
                    <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">
                      {m.body}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {new Date(m.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
