import Link from "next/link";
import { ArrowRight, Newspaper, Pin } from "lucide-react";
import { getSupabase, type NewsPost } from "@/lib/supabase";
import { Panel } from "@/components/ui";

/** Missing table (unmigrated) shouldn't break the dashboard — show empty. */
async function getLatest(): Promise<NewsPost[]> {
  const { data, error } = await getSupabase()
    .from("news")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4)
    .returns<NewsPost[]>();
  if (error) {
    console.error("Failed to load news for the dashboard:", error);
    return [];
  }
  return data ?? [];
}

export async function NewsWidget() {
  const posts = await getLatest();

  return (
    <Panel className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.3em] text-gold-400">
          <Newspaper className="h-4 w-4" />
          THE HERALD
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="mt-4 flex-1 text-sm text-slate-500">
          No news from the realm just yet.
        </p>
      ) : (
        <ul className="mt-4 flex-1 space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/portal/news/${post.id}`}
                className="group block rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 transition hover:border-gold-500/40"
              >
                <div className="flex items-start gap-2">
                  {post.pinned && (
                    <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-200 transition group-hover:text-gold-300">
                      {post.title}
                    </p>
                    {post.summary && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {post.summary}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      {new Date(post.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/portal/news"
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-gold-500/40 hover:text-gold-300"
      >
        Read the newsletter
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Panel>
  );
}
