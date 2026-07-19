"use client";

/**
 * Contact page — form with mailto fallback and Formspree-ready endpoint.
 * When NEXT_PUBLIC_FORMSPREE_ENDPOINT is set, the form POSTs to Formspree.
 * Otherwise, it constructs a mailto link.
 */

import { useState } from "react";
import Link from "next/link";

const FORMSPREE = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (FORMSPREE) {
        const res = await fetch(FORMSPREE, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name, email, subject, message }),
        });
        if (!res.ok) throw new Error("Failed to send message");
        setSent(true);
      } else {
        // Fallback: construct mailto link
        const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
        const mailto = `mailto:support@fantasygolf.app?subject=${encodeURIComponent(
          subject || "Fantasy Golf enquiry"
        )}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please email us directly at support@fantasygolf.app");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f3d20] dark:text-green-400">📬 Contact Us</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Questions, feedback, or need a hand? We&apos;d love to hear from you.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6 text-center">
          <p className="text-3xl">✅</p>
          <h2 className="mt-2 text-lg font-bold text-green-700">
            {FORMSPREE ? "Message sent!" : "Opening your email app…"}
          </h2>
          <p className="mt-1 text-sm text-green-600">
            {FORMSPREE
              ? "We'll get back to you within 48 hours."
              : "If your email client didn't open, email us at support@fantasygolf.app"}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-[#1a6b3c] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#0f3d20]"
          >
            ← Back Home
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b3c] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b3c] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b3c] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholder="What's this about?"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1a6b3c] dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholder="Tell us how we can help…"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#1a6b3c] py-3 text-sm font-bold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send Message →"}
          </button>

          {!FORMSPREE && (
            <p className="text-center text-xs text-zinc-400">
              📧 Your email app will open with the message pre-filled.
            </p>
          )}
        </form>
      )}

      {/* Direct email fallback */}
      <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-center dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Prefer email? Reach us directly at{" "}
          <a
            href="mailto:support@fantasygolf.app"
            className="font-semibold text-[#1a6b3c] hover:underline"
          >
            support@fantasygolf.app
          </a>
        </p>
      </div>
    </div>
  );
}
