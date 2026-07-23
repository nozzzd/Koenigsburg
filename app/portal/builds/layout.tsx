/** Citizen build views: plain centred column, matching the admin planner. */
export default function BuildsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="page-in mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      {children}
    </main>
  );
}
