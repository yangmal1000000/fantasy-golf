"use client";

/**
 * Blog admin editor — create, edit, delete blog posts from the admin dashboard.
 */

import { useState, useEffect, useCallback } from "react";

interface Post {
  id: string;
  title: string;
  slug: string;
  author: string;
  excerpt: string | null;
  tags: string[];
  publishedAt: string | null;
  body?: string;
}

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Post | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/blog?limit=50");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function startNew() {
    setEditing({ id: "", title: "", slug: "", author: "", excerpt: null, tags: [], publishedAt: null });
    setTitle("");
    setBody("");
    setExcerpt("");
    setTags("");
    setPublishedAt("");
    setMsg(null);
  }

  async function loadPostForEditing(post: Post) {
    try {
      const res = await fetch(`/api/blog?slug=${encodeURIComponent(post.slug)}`);
      if (res.ok) {
        const data = await res.json();
        const p = data.post;
        setEditing(p);
        setTitle(p.title);
        setBody(p.body ?? "");
        setExcerpt(p.excerpt ?? "");
        setTags((p.tags ?? []).join(", "));
        setPublishedAt(p.publishedAt ? p.publishedAt.slice(0, 10) : "");
        setMsg(null);
      }
    } catch {
      setMsg("Failed to load post");
    }
  }

  async function save() {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing?.id || undefined,
          title: title.trim(),
          body: body.trim(),
          excerpt: excerpt.trim() || undefined,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          publishedAt: publishedAt || undefined,
        }),
      });
      if (res.ok) {
        setMsg("✅ Post saved successfully");
        setEditing(null);
        await fetchPosts();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(`❌ ${j.error ?? "Failed to save"}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(slug: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/blog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        setMsg("✅ Post deleted");
        await fetchPosts();
      } else {
        setMsg("❌ Failed to delete");
      }
    } catch {
      setMsg("❌ Network error");
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 rounded bg-zinc-200" />
          <div className="h-32 rounded-xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">📰 Blog Editor</h1>
          <p className="mt-1 text-sm text-zinc-500">Create and manage blog posts</p>
        </div>
        <button
          onClick={startNew}
          className="rounded-xl bg-[#0a3d2a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0a3d2a]"
        >
          ➕ New Post
        </button>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
          {msg}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 font-semibold text-zinc-900">
            {editing.id ? "Edit Post" : "New Post"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#0a3d2a]"
                placeholder="Post title…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Excerpt (optional)</label>
              <input
                type="text"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#0a3d2a]"
                placeholder="Short summary…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#0a3d2a]"
                placeholder="preview, strategy, picks"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Publish Date</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#0a3d2a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-600">Body (Markdown)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none focus:border-[#0a3d2a]"
                placeholder="# Heading&#10;&#10;Write your post in Markdown…"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving || !title.trim() || !body.trim()}
                className="rounded-lg bg-[#0a3d2a] px-5 py-2 text-sm font-bold text-white transition enabled:hover:bg-[#0a3d2a] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Post"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post list */}
      {!editing && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">
              All Posts ({posts.length})
            </h2>
          </div>
          {posts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-zinc-400">No posts yet. Click &ldquo;New Post&rdquo; to create one.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{post.title}</p>
                    <p className="text-xs text-zinc-500">
                      /{post.slug} · {post.author} ·{" "}
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("en-GB")
                        : "Draft"}
                      {(post.tags ?? []).length > 0 && ` · ${post.tags.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => loadPostForEditing(post)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePost(post.slug)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
