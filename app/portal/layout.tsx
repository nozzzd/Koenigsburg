import { redirect } from "next/navigation";
import Link from "next/link";
import { Home, LogOut, Shield } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { hasCitizenRoleCached } from "@/lib/discord";
import { logout } from "@/actions/auth";
import { SHELL, WordMark, navButtonClass } from "@/components/ui";
import { SettingsDrawer } from "@/components/SettingsDrawer";

/**
 * Route safeguard for everything under /portal:
 *   no session           → /login
 *   status == 'pending'  → /pending
 *   lost @Citizen role   → demoted, → /pending?revoked=1
 *   status == 'active'   → render
 *
 * Only the guard and the header live here. Each section supplies its own body
 * layout, because the Citizen's Hall has the Herald sidebar and nothing else
 * does.
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
      {/* The bar's border and fill live on the inner element, so the rule stops
          at the frame instead of running the full width of the monitor. */}
      <header className={`${SHELL} px-4 sm:px-6`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 py-4 sm:gap-4">
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
      {children}
    </>
  );
}
