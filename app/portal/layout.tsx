import { redirect } from "next/navigation";
import Link from "next/link";
import { Home, LogOut, Shield } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { hasCitizenRoleCached } from "@/lib/discord";
import { logout } from "@/actions/auth";
import { WordMark, navButtonClass } from "@/components/ui";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { NewsWidget } from "@/components/NewsWidget";

/**
 * Shared width for the header and the body, so the nav buttons line up with
 * the content instead of hugging the far edge of a wide monitor.
 */
const SHELL = "mx-auto w-full max-w-[88rem]";

/**
 * Route safeguard for everything under /portal:
 *   no session           → /login
 *   status == 'pending'  → /pending
 *   lost @Citizen role   → demoted, → /pending?revoked=1
 *   status == 'active'   → render
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");
  if (player.status === "pending") redirect("/pending");

  // Citizenship follows Discord: leaving the server or losing @Citizen revokes
  // portal access. Admins are exempt (the owner may not hold @Citizen at all),
  // and manual signups have no discord_id to check.
  if (player.discord_id && player.role !== "admin") {
    let stillCitizen = true; // fail OPEN — a Discord outage must not lock everyone out
    try {
      stillCitizen = await hasCitizenRoleCached(player.discord_id);
    } catch (err) {
      console.error("Citizen re-check failed; allowing access:", err);
    }
    if (!stillCitizen) {
      await getSupabase()
        .from("players")
        .update({ status: "pending", role: "guest" })
        .eq("id", player.id);
      redirect("/pending?revoked=1");
    }
  }

  return (
    <>
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className={`${SHELL} flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-8`}>
          <WordMark href="/portal" />
          <nav className="flex items-center gap-2">
            {player.role === "admin" && (
              <Link
                href="/portal/admin"
                className={`${navButtonClass} border-gold-500/40 text-gold-400`}
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <Link href="/" className={navButtonClass}>
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Main page</span>
            </Link>
            <SettingsDrawer
              code={player.verification_code}
              ign={player.minecraft_ign}
            />
            <form action={logout}>
              <button type="submit" className={navButtonClass}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      {/*
        App shell. The empty right-hand column is deliberate: it mirrors the
        Herald's width so the middle column lands on the true centre of the
        screen. Without it, `mx-auto` only centres within the space left over
        beside the sidebar, which drags the content off-centre.
        Hidden on phones — the dashboard renders the Herald inline there
        instead (cache() dedupes, so it's still one query).
      */}
      <div className={`${SHELL} flex flex-1`}>
        <aside className="hidden shrink-0 py-8 pl-4 pr-2 lg:block lg:w-[20rem] xl:w-[22rem]">
          <div className="sticky top-8">
            <NewsWidget className="h-[calc(100dvh-8rem)]" />
          </div>
        </aside>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <div
          aria-hidden
          className="hidden shrink-0 lg:block lg:w-[20rem] xl:w-[22rem]"
        />
      </div>
    </>
  );
}
