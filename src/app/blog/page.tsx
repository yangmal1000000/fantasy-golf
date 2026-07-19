import Link from "next/link";

export const dynamic = "force-dynamic";

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
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/blog`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts ?? [];
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f3d20]">📰 The Clubhouse Blog</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pre-tournament previews, strategy guides, and golf insights.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
          <p className="text-4xl">📝</p>
          <p className="mt-3 text-sm text-zinc-500">No articles yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md"
            >
              {/* Color header */}
              <div className="h-32 bg-gradient-to-br from-[#0f3d20] to-[#1a6b3c] p-4">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex gap-1">
                    {(post.tags ?? []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="text-2xl">⛳</span>
                </div>
              </div>

              <div className="p-4">
                <h2 className="text-base font-bold text-[#0f3d20] group-hover:underline">
                  {post.title}
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  by {post.author} ·{" "}
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Draft"}
                </p>
                <p className="mt-2 text-sm text-zinc-600 line-clamp-2">
                  {post.excerpt ?? ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
