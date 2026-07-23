import { redirect } from "next/navigation";
import { getSessionPlayer } from "@/lib/session";
import { HALL_SHELL } from "@/components/ui";
import { NewsWidget } from "@/components/NewsWidget";
import { TasksWidget } from "@/components/TasksWidget";

/**
 * The Citizen's Hall only - the two boards live here, not in the shared portal
 * layout, so they never show up on the admin or newsletter pages.
 *
 * The Herald (left) and the Ledger (right) are equal-width columns, which is
 * also what keeps the middle on the TRUE centre of the screen: mx-auto alone
 * would only centre within the space left beside a single sidebar.
 *
 * Both are hidden below lg - the dashboard renders them inline on phones
 * instead (cache() dedupes, so it's still one query each).
 */
export default async function HallLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  const columnClass = "hidden shrink-0 py-8 lg:block lg:w-[20rem] xl:w-[24rem] 2xl:w-[28rem]";

  return (
    <div className={`${HALL_SHELL} flex flex-1`}>
      <aside className={`${columnClass} pl-5 pr-5`}>
        <div className="page-in sticky top-8">
          <NewsWidget className="h-[calc(100dvh-8rem)]" />
        </div>
      </aside>

      <main className="page-in mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <aside className={`${columnClass} pl-5 pr-5`}>
        <div className="page-in sticky top-8">
          <TasksWidget
            playerId={player.id}
            isAdmin={player.role === "admin"}
            className="h-[calc(100dvh-8rem)]"
          />
        </div>
      </aside>
    </div>
  );
}
