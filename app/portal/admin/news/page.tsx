import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronDown, Database, Newspaper, Pin, Plus, Trash2 } from "lucide-react";
import { getSupabase, type NewsPost } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { deleteNews } from "@/actions/news";
import { GoldDivider, Panel } from "@/components/ui";
import { NewsForm } from "@/components/forms/NewsForm";

export const metadata: Metadata = { title: "Admin — The Herald" };

const summaryClass =
  "flex cursor-pointer list-none items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-gold-500/50 hover:text-gold-300 [&::-webkit-details-marker]:hidden";

export default async function AdminNewsPage() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "admin") redirect("/portal");

  const { data, error } = await getSupabase()
    .from("news")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<NewsPost[]>();

  // The table won't exist until the migration is run — say so instead of crashing.
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold tracking-widest text-slate-100">
          The Herald
        </h1>
        <Panel className="flex items-start gap-3 border-amber-900/50 p-6">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-amber-300">
              The news table doesn&apos;t exist yet.
            </p>
            <p className="text-slate-400">
              Open the Supabase SQL Editor and run{" "}
              <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-gold-400">
                supabase/004_news.sql
              </code>{" "}
              from the repo, then reload this page.
            </p>
            <p className="text-xs text-slate-600">Details: {error.message}</p>
          </div>
        </Panel>
      </div>
    );
  }

  const posts = data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the Great Hall
        </Link>
        <p className="mt-4 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          WRITE FOR
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          The Herald
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Dispatches appear on every citizen&apos;s dashboard and in{" "}
          <Link href="/portal/news" className="font-semibold text-gold-400 hover:text-gold-300">
            the newsletter
          </Link>
          . Pinned ones float to the top.
        </p>
      </div>

      <GoldDivider />

      <details className="group">
        <summary className={summaryClass}>
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold-400" />
            Write a dispatch
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <Panel className="mt-3 p-5">
          <NewsForm />
        </Panel>
      </details>

      {posts.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Newspaper className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            NO DISPATCHES YET
          </p>
          <p className="text-sm text-slate-500">
            Write the first one above — it appears on every dashboard at once.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id}>
              <Panel className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold text-gold-300">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </span>
                      )}
                      <p className="font-display text-base font-bold tracking-wide text-slate-100">
                        {post.title}
                      </p>
                    </div>
                    {post.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                        {post.summary}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-600">
                      {post.author ? `${post.author} · ` : ""}
                      {new Date(post.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <form action={deleteNews.bind(null, post.id)}>
                    <button
                      type="submit"
                      aria-label={`Delete ${post.title}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-800 hover:bg-red-950/40 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </form>
                </div>

                <details className="group mt-4">
                  <summary className={summaryClass}>
                    <span>Edit</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="pt-4">
                    <NewsForm post={post} />
                  </div>
                </details>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
