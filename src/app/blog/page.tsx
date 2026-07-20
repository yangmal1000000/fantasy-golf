import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewspaperIcon, NoteIcon, GolfFlagIcon } from "@/components/icons";
import { ensureSchema } from "@/lib/db-ensure";

export const revalidate = 3600; // ISR — rebuild every hour

export const metadata: Metadata = {
  title: "Blog — Fantasy Golf",
  description: "Tournament previews, strategy guides, and golf insights from The Clubhouse.",
};

interface PostListItem {
  id: string;
  title: string;
  slug: string;
  author: string;
  excerpt: string | null;
  tags: string[];
  publishedAt: string | null;
}

async function getPosts(): Promise<PostListItem[]> {
  try {
    await ensureSchema();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, title, slug, author, excerpt, tags, "publishedAt"
         FROM "BlogPost"
        WHERE "publishedAt" IS NOT NULL
        ORDER BY "publishedAt" DESC
        LIMIT 20`
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      author: r.author,
      excerpt: r.excerpt,
      tags: r.tags ?? [],
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    }));
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">The Clubhouse</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Pre-tournament previews, strategy guides, and golf insights</p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <NoteIcon className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-semibold text-zinc-600">No articles yet</p>
          <p className="mt-1 text-xs text-zinc-400">Check back soon for tournament previews and strategy guides.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
            >
              <div className="relative h-24 bg-gradient-to-br from-[#0a3d2a] to-[#1a5c3e] p-3">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex flex-wrap gap-1">
                    {(post.tags ?? []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t}</span>
                    ))}
                  </div>
                  <GolfFlagIcon className="h-5 w-5 text-white/40" />
                </div>
              </div>
              <div className="p-3">
                <h2 className="text-sm font-bold text-zinc-900 group-hover:text-[#0a3d2a] dark:text-white dark:group-hover:text-green-400">{post.title}</h2>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {post.author} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                </p>
                <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2">{post.excerpt ?? ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
