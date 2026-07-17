import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pin } from "lucide-react";
import { getSupabase, type NewsPost } from "@/lib/supabase";
import { GoldDivider } from "@/components/ui";

async function getPost(id: string): Promise<NewsPost | null> {
  const { data, error } = await getSupabase()
    .from("news")
    .select("*")
    .eq("id", id)
    .maybeSingle<NewsPost>();
  if (error) {
    console.error("Failed to load dispatch:", error);
    return null;
  }
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  return { title: post?.title ?? "Dispatch" };
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/portal/news"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All dispatches
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold text-gold-300">
              <Pin className="h-3 w-3" />
              Important
            </span>
          )}
          <span className="text-xs text-slate-600">
            {new Date(post.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-wide text-slate-100">
          {post.title}
        </h1>
        {post.author && (
          <p className="mt-2 text-sm text-slate-500">Signed, {post.author}</p>
        )}
      </div>

      <GoldDivider />

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="w-full rounded-xl border border-slate-800 object-cover"
        />
      )}

      {post.summary && (
        <p className="text-lg leading-relaxed text-slate-300">{post.summary}</p>
      )}

      {/* Plain text — rendered as text (React escapes it), newlines preserved. */}
      <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-400">
        {post.body}
      </div>
    </article>
  );
}
