import { HALL_SHELL } from "@/components/ui";
import { NewsWidget } from "@/components/NewsWidget";

/**
 * The Citizen's Hall only — the Herald board lives here, not in the shared
 * portal layout, so it never shows up on the admin or newsletter pages.
 *
 * The empty right-hand column is deliberate: it mirrors the Herald's width so
 * the middle column lands on the TRUE centre of the screen. Without it,
 * mx-auto only centres within the space left over beside the sidebar, which
 * drags the content off-centre.
 *
 * Hidden below lg — the dashboard renders the Herald inline on phones instead
 * (cache() dedupes, so it's still one query).
 */
export default function HallLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${HALL_SHELL} flex flex-1`}>
      <aside className="hidden shrink-0 px-5 py-8 lg:block lg:w-[20rem] xl:w-[24rem] 2xl:w-[28rem]">
        <div className="sticky top-8">
          <NewsWidget className="h-[calc(100dvh-8rem)]" />
        </div>
      </aside>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <div
        aria-hidden
        className="hidden shrink-0 lg:block lg:w-[20rem] xl:w-[24rem] 2xl:w-[28rem]"
      />
    </div>
  );
}
