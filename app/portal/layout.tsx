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
        <div className="flex w-full items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
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
      {/* App shell: the Herald is a full-height board pinned to the left edge,
          outside the centred content column. Hidden on phones — the dashboard
          renders it inline there instead (cache() dedupes the query). */}
      <div className="flex flex-1">
        <aside className="hidden w-[21rem] shrink-0 border-r border-slate-800/80 p-4 lg:block xl:w-[24rem]">
          <div className="sticky top-4">
            <NewsWidget className="h-[calc(100dvh-7rem)]" />
          </div>
        </aside>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    </>
  );
}
