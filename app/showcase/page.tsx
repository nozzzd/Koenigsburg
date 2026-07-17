import type { Metadata } from "next";
import Link from "next/link";
import { Hammer, ImageIcon } from "lucide-react";
import { getSupabase, type Project } from "@/lib/supabase";
import {
  Crest,
  GoldDivider,
  Panel,
  WordMark,
  goldButtonClass,
  outlineButtonClass,
} from "@/components/ui";
import { JoinDiscordButton } from "@/components/DiscordButton";
import { ThemeToggleButton } from "@/components/ThemeToggle";

// Served from cache and regenerated on demand when an admin edits a project
// (revalidatePath in actions/projects.ts); this is the safety net in case a
// build-time fetch ever came back empty.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Great Works",
  description:
    "The great works of Königsburg — cathedrals, harbors, and fortifications raised by our citizens. Join the realm and build your own legacy.",
};

/** Managed by admins at /portal/admin/showcase. */
async function getProjects(): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Project[]>();
  if (error) {
    // Table missing (migration not run) or DB hiccup — show an empty gallery
    // rather than taking the whole public page down.
    console.error("Failed to load projects:", error);
    return [];
  }
  return data ?? [];
}

export default async function ShowcasePage() {
  const projects = await getProjects();

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Link href="/login" className={outlineButtonClass}>
            Enter
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 sm:px-6">
        <section className="flex flex-col items-center pt-10 pb-10 text-center sm:pt-12">
          <Crest className="h-14 w-14 sm:h-16 sm:w-16" />
          <p className="mt-5 font-display text-[0.65rem] font-semibold tracking-[0.3em] text-gold-500 sm:mt-6 sm:text-xs sm:tracking-[0.5em]">
            THE GREAT WORKS OF
          </p>
          <h1 className="mt-3 bg-gradient-to-b from-slate-50 via-slate-200 to-slate-400 bg-clip-text font-display text-[1.75rem] font-bold tracking-[0.06em] text-transparent sm:text-5xl sm:tracking-[0.15em] lg:text-6xl">
            KÖNIGSBURG
          </h1>
          <p className="mt-5 max-w-xl text-balance text-slate-400">
            Every stone laid by a citizen of the realm. This is what we build
            together — come raise your own monument within the walls.
          </p>
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        {projects.length === 0 && (
          <section className="w-full py-16">
            <Panel className="flex flex-col items-center gap-3 p-12 text-center">
              <ImageIcon className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
              <p className="font-display text-sm font-bold tracking-widest text-slate-300">
                THE CHRONICLE IS BEING WRITTEN
              </p>
              <p className="max-w-sm text-sm text-slate-500">
                Our great works are being recorded. Join the Discord to see what
                the realm is building right now.
              </p>
            </Panel>
          </section>
        )}

        <section className="stagger grid w-full gap-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Panel key={project.id} className="flex flex-col overflow-hidden">
              <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                {project.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.image_url}
                    alt={project.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800/60 to-slate-950 text-slate-600">
                    <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
                    <span className="text-xs tracking-widest">SCREENSHOT SOON</span>
                  </div>
                )}
                {project.tag && (
                  <span className="absolute left-3 top-3 rounded-full border border-gold-500/40 bg-slate-950/80 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gold-300 backdrop-blur">
                    {project.tag}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
                  {project.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                  {project.description}
                </p>
                {project.builder && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                    <Hammer className="h-3.5 w-3.5 text-gold-500" />
                    Raised by {project.builder}
                  </p>
                )}
              </div>
            </Panel>
          ))}
        </section>

        <GoldDivider className="w-full max-w-3xl" />

        <section className="flex flex-col items-center py-14 text-center">
          <h2 className="font-display text-2xl font-bold tracking-widest text-slate-100">
            Seeking new builders
          </h2>
          <p className="mt-3 max-w-lg text-balance text-slate-400">
            Königsburg grows with every citizen. Join our Discord to meet the
            realm, or petition the council for citizenship and start building today.
          </p>
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <JoinDiscordButton className="w-full" />
            <Link href="/apply" className={`${goldButtonClass} sm:w-auto`}>
              Apply for Citizenship
            </Link>
          </div>
        </section>
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
