/** The newsletter: plain centred column — the Herald sidebar would be redundant. */
export default function NewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      {children}
    </main>
  );
}
