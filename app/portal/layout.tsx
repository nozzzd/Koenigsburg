import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { getSessionPlayer } from "@/lib/session";
import { logout } from "@/actions/auth";
import { WordMark } from "@/components/ui";

/**
 * Route safeguard for everything under /portal:
 *   no session          → /login
 *   status == 'pending' → /pending
 *   status == 'active'  → render
 */
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");
  if (player.status === "pending") redirect("/pending");

  return (
    <>
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <WordMark href="/portal" />
          <nav className="flex items-center gap-4">
            {player.role === "admin" && (
              <Link
                href="/portal/admin"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 transition hover:text-gold-300"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
