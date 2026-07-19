import { notFound } from "next/navigation";
import Link from "next/link";
import { ensureSchema } from "@/lib/db-ensure";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  body: string;
  author: string;
  excerpt: string | null;
  tags: string[];
  publishedAt: Date | null;
}

async function getPost(slug: string): Promise<BlogPost | null> {
  await ensureSchema();
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, title, slug, body, author, excerpt, "publishedAt", tags
       FROM "BlogPost"
      WHERE slug = $1 AND "publishedAt" IS NOT NULL
      LIMIT 1`,
    slug,
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    body: r.body,
    author: r.author,
    excerpt: r.excerpt,
    tags: r.tags ?? [],
    publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
  };
}

/** Very small markdown-ish renderer — headings, bold, lists, paragraphs. */
function renderMarkdown(body: string): React.ReactNode {
  const lines = body.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let key = 0;

  function flushList() {
    if (list.length > 0) {
      out.push(
        <ul key={`ul-${key++}`} className="my-2 ml-5 list-disc space-y-1 text-sm text-zinc-700">
          {list}
        </ul>,
      );
      list = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      out.push(
        <h4 key={key++} className="mt-4 text-sm font-bold text-[#0f3d20]">
          {line.slice(4)}
        </h4>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      out.push(
        <h3 key={key++} className="mt-5 text-lg font-bold text-[#0f3d20]">
          {line.slice(3)}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      out.push(
        <h2 key={key++} className="mt-6 text-xl font-extrabold text-[#0f3d20]">
          {line.slice(2)}
        </h2>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      list.push(<li key={`li-${key++}`}>{inline(line.replace(/^[-*]\s+/, ""))}</li>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      list.push(<li key={`li-${key++}`}>{inline(line.replace(/^\d+\.\s+/, ""))}</li>);
      continue;
    }
    flushList();
    out.push(
      <p key={key++} className="my-2 text-sm leading-relaxed text-zinc-700">
        {inline(line)}
      </p>,
    );
  }
  flushList();
  return out;
}

function inline(text: string): React.ReactNode {
  // **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold text-zinc-900">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4 text-xs">
        <Link href="/blog" className="text-zinc-500 hover:text-[#1a6b3c]">
          ← Blog
        </Link>
      </div>

      <article>
        {/* Title */}
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0f3d20] dark:text-green-400">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>by {post.author}</span>
          <span>·</span>
          <span>
            {post.publishedAt?.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-3 flex gap-1">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[#1a6b3c]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1a6b3c]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="mt-6">
          {renderMarkdown(post.body)}
        </div>
      </article>

      <div className="mt-8 border-t border-zinc-100 pt-4 text-center dark:border-zinc-800">
        <Link href="/blog" className="text-sm font-semibold text-[#1a6b3c] hover:underline">
          ← More articles
        </Link>
      </div>
    </div>
  );
}
