import { redirect } from "next/navigation";
import Link from "next/link";
import { Hammer, Home, LogOut, Shield } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { logout } from "@/actions/auth";
import { SHELL, WordMark, navButtonClass } from "@/components/ui";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { CitizenshipWatcher } from "@/components/CitizenshipWatcher";

/**
 * Route safeguard for everything under /portal:
 *   no session           → /login
 *   status == 'pending'  → /pending
 *   lost @Citizen role   → shared session check demotes, → /pending?revoked=1
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
  if (player.status === "pending") {
    redirect(player.citizenshipRevoked ? "/pending?revoked=1" : "/pending");
  }

  return (
    <>
      <CitizenshipWatcher />
      {/* The bar's border and fill live on the inner element, so the rule stops
          at the frame instead of running the full width of the monitor. */}
      <header className={`${SHELL} px-4 sm:px-6`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 py-4 sm:gap-4">
          <WordMark href="/portal" />
          <nav className="flex items-center gap-2">
            <Link href="/portal/builds" className={navButtonClass}>
              <Hammer className="h-4 w-4" />
              <span className="hidden sm:inline">Builds</span>
            </Link>
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
