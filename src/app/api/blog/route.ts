import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, genId } from "@/lib/db-ensure";

export const dynamic = "force-dynamic";

interface BlogPostDetailRow {
  id: string;
  title: string;
  slug: string;
  body: string;
  author: string;
  excerpt: string | null;
  publishedAt: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface BlogPostListRow {
  id: string;
  title: string;
  slug: string;
  author: string;
  excerpt: string | null;
  publishedAt: Date | null;
  tags: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// GET — list published posts or single post by slug
export async function GET(req: NextRequest) {
  await ensureSchema();

  const slug = req.nextUrl.searchParams.get("slug");

  if (slug) {
    const rows: BlogPostDetailRow[] = await prisma.$queryRawUnsafe(
      `SELECT id, title, slug, body, author, excerpt, "publishedAt", tags, "createdAt", "updatedAt"
         FROM "BlogPost"
        WHERE slug = $1
        LIMIT 1`,
      slug,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const r = rows[0];
    return NextResponse.json({
      post: {
        id: r.id,
        title: r.title,
        slug: r.slug,
        body: r.body,
        author: r.author,
        excerpt: r.excerpt,
        tags: r.tags ?? [],
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      },
    });
  }

  const tag = req.nextUrl.searchParams.get("tag");
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 20));

  let rows: BlogPostListRow[];
  if (tag) {
    rows = await prisma.$queryRawUnsafe(
      `SELECT id, title, slug, author, excerpt, "publishedAt", tags
         FROM "BlogPost"
        WHERE "publishedAt" IS NOT NULL
          AND $1 = ANY(tags)
        ORDER BY "publishedAt" DESC
        LIMIT $2`,
      tag,
      limit,
    );
  } else {
    rows = await prisma.$queryRawUnsafe(
      `SELECT id, title, slug, author, excerpt, "publishedAt", tags
         FROM "BlogPost"
        WHERE "publishedAt" IS NOT NULL
        ORDER BY "publishedAt" DESC
        LIMIT $1`,
      limit,
    );
  }

  return NextResponse.json({
    posts: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      author: r.author,
      excerpt: r.excerpt,
      tags: r.tags ?? [],
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    })),
  });
}

// POST — create or update a blog post (admin only)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    await ensureSchema();

    const body = await req.json();
    const { title, body: postBody, excerpt, tags, publishedAt, id } = body as {
      title?: string;
      body?: string;
      excerpt?: string;
      tags?: string[];
      publishedAt?: string;
      id?: string;
    };

    if (!title || typeof postBody !== "string") {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    const slug = slugify(title);
    const id_ = id ?? genId();
    const pubDate = publishedAt ? new Date(publishedAt) : new Date();
    const tagsArr = Array.isArray(tags) ? tags.slice(0, 10) : [];

    await prisma.$executeRawUnsafe(
      `INSERT INTO "BlogPost" (id, title, slug, body, author, excerpt, "publishedAt", tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         excerpt = EXCLUDED.excerpt,
         "publishedAt" = EXCLUDED."publishedAt",
         tags = EXCLUDED.tags,
         "updatedAt" = CURRENT_TIMESTAMP`,
      id_,
      title,
      slug,
      postBody,
      user.name ?? "Fantasy Golf Team",
      excerpt ?? postBody.slice(0, 160),
      pubDate,
      tagsArr,
    );

    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error("blog POST error:", err);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}

// DELETE — delete a blog post (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { slug } = body as { slug?: string };
    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "BlogPost" WHERE slug = $1`, slug);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("blog DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
