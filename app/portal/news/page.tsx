import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Newspaper, Pin } from "lucide-react";
import { getSupabase, type NewsPost } from "@/lib/supabase";
import { GoldDivider, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "The Herald" };

/** Missing table (unmigrated) shouldn't break the portal — show an empty feed. */
async function getNews(): Promise<NewsPost[]> {
  const { data, error } = await getSupabase()
    .from("news")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<NewsPost[]>();
  if (error) {
    console.error("Failed to load news:", error);
    return [];
  }
  return data ?? [];
}

export default async function NewsPage() {
  const posts = await getNews();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-gold-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the Citizen&apos;s Hall
        </Link>
        <p className="mt-4 font-display text-xs font-semibold tracking-[0.4em] text-gold-500">
          DISPATCHES FROM
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-widest text-slate-100">
          The Herald
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          News from the nation, by order of the council.
        </p>
      </div>

      <GoldDivider />

      {posts.length === 0 ? (
        <Panel className="flex flex-col items-center gap-3 p-12 text-center">
          <Newspaper className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-300">
            NO NEWS FROM THE NATION
          </p>
          <p className="text-sm text-slate-500">
            The Herald has nothing to report just yet.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/portal/news/${post.id}`} className="block">
                <Panel className="flex flex-col overflow-hidden transition hover:border-gold-500/50 sm:flex-row">
                  {post.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.image_url}
                      alt=""
                      loading="lazy"
                      className="h-40 w-full shrink-0 object-cover sm:h-auto sm:w-52"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-2">
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
                    <h2 className="mt-2 font-display text-lg font-bold tracking-wide text-slate-100">
                      {post.title}
                    </h2>
                    {post.summary && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                        {post.summary}
                      </p>
                    )}
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400">
                      Read the dispatch
                      <ArrowRight className="h-3.5 w-3.5" />
                    </p>
                  </div>
                </Panel>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
