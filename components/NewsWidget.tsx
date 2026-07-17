import Link from "next/link";
import { ArrowRight, Newspaper, Pin } from "lucide-react";
import { getSupabase, type NewsPost } from "@/lib/supabase";
import { Panel, navButtonClass } from "@/components/ui";

/** Missing table (unmigrated) shouldn't break the dashboard — show empty. */
async function getLatest(): Promise<NewsPost[]> {
  const { data, error } = await getSupabase()
    .from("news")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<NewsPost[]>();
  if (error) {
    console.error("Failed to load news for the dashboard:", error);
    return [];
  }
  return data ?? [];
}

export async function NewsWidget() {
  const posts = await getLatest();
  const [lead, ...rest] = posts;

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-800/80 px-5 py-4">
        <Newspaper className="h-4 w-4 text-gold-400" />
        <p className="font-display text-xs font-bold tracking-[0.3em] text-gold-400">
          THE HERALD
        </p>
      </div>

      {posts.length === 0 ? (
        // Centred, not stranded at the top of a tall empty panel.
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
          <Newspaper className="h-10 w-10 text-slate-700" strokeWidth={1.25} />
          <p className="font-display text-sm font-bold tracking-widest text-slate-400">
            ALL QUIET
          </p>
          <p className="max-w-[15rem] text-sm text-slate-600">
            No dispatches from the realm just yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Lead story gets the room — image, headline, blurb. */}
          <Link href={`/portal/news/${lead.id}`} className="group block">
            {lead.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lead.image_url}
                alt=""
                loading="lazy"
                className="h-36 w-full object-cover"
              />
            )}
            <div className="px-5 py-4">
              {lead.pinned && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-400/10 px-2 py-0.5 text-xs font-semibold text-gold-300">
                  <Pin className="h-3 w-3" />
                  Important
                </span>
              )}
              <p className="font-display text-base font-bold leading-snug tracking-wide text-slate-100 transition group-hover:text-gold-300">
                {lead.title}
              </p>
              {lead.summary && (
                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-slate-400">
                  {lead.summary}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-600">
                {new Date(lead.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </Link>

          {rest.length > 0 && (
            <ul className="divide-y divide-slate-800/80 border-t border-slate-800/80">
              {rest.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/portal/news/${post.id}`}
                    className="group flex items-start gap-2 px-5 py-3 transition hover:bg-slate-800/40"
                  >
                    {post.pinned && (
                      <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-300 transition group-hover:text-gold-300">
                        {post.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {new Date(post.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-slate-800/80 p-4">
        <Link href="/portal/news" className={`${navButtonClass} w-full justify-center`}>
          Read the newsletter
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Panel>
  );
}
