import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  CloudOff,
  Database,
  MapPin,
  PackageSearch,
  Search,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  GoldDivider,
  Panel,
  WordMark,
  outlineButtonClass,
} from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Inventory",
  description:
    "The quartermaster's ledger for searching Königsburg's QMSync-tracked stores.",
};

const ledgerStats = [
  { icon: Boxes, label: "Stored items", detail: "Across every recorded stack" },
  { icon: PackageSearch, label: "Unique items", detail: "Searchable by name or ID" },
  { icon: MapPin, label: "Containers", detail: "With dimension and coordinates" },
  { icon: Database, label: "Memory banks", detail: "Uploaded by approved citizens" },
];

const syncSteps = [
  {
    number: "01",
    title: "The mod records",
    text: "QMSync watches the storage a citizen has opened in-game.",
  },
  {
    number: "02",
    title: "The ledger receives",
    text: "Changed snapshots arrive from approved players and replace stale counts.",
  },
  {
    number: "03",
    title: "The realm searches",
    text: "Items resolve to their dimension, container, and exact coordinates.",
  },
];

export default function InventoryPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <WordMark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Link href="/login" className={outlineButtonClass}>
            Enter
          </Link>
        </nav>
      </header>

      <main className="page-in mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-16 sm:px-6">
        <section className="grid gap-8 pt-10 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:pt-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-400/5 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.24em] text-gold-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Quartermaster&apos;s ledger
            </div>
            <h1 className="mt-5 max-w-4xl bg-gradient-to-b from-slate-50 via-slate-200 to-slate-500 bg-clip-text font-display text-4xl font-bold tracking-[0.06em] text-transparent sm:text-6xl sm:tracking-[0.1em]">
              Inventory of the realm
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base leading-7 text-slate-400 sm:text-lg">
              One search across Königsburg&apos;s recorded chests, barrels, and stores —
              with the exact place each item was last seen.
            </p>
          </div>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]" />
                <span className="font-display text-xs font-bold tracking-[0.2em] text-slate-300">
                  QMSYNC
                </span>
              </div>
              <span className="rounded-full border border-amber-500/20 bg-amber-400/5 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300">
                Awaiting link
              </span>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Protocol</span>
                <span className="font-mono text-slate-300">QMSync v1</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Realm</span>
                <span className="text-right text-slate-300">Not configured</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Last count</span>
                <span className="text-right text-slate-300">No snapshot yet</span>
              </div>
            </div>
          </Panel>
        </section>

        <GoldDivider />

        <section className="stagger grid gap-4 py-8 sm:grid-cols-2 xl:grid-cols-4">
          {ledgerStats.map(({ icon: Icon, label, detail }) => (
            <Panel key={label} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                  <Icon className="h-5 w-5 text-gold-400" strokeWidth={1.5} />
                </div>
                <span className="font-display text-2xl font-bold text-slate-600">—</span>
              </div>
              <p className="mt-5 font-display text-sm font-bold tracking-wider text-slate-200">
                {label}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
            </Panel>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel className="min-h-[30rem] overflow-hidden">
            <div className="border-b border-slate-800 p-4 sm:p-5">
              <label
                htmlFor="inventory-search"
                className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
              >
                Search the stores
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-600"
                  aria-hidden
                />
                <input
                  id="inventory-search"
                  type="search"
                  disabled
                  placeholder="Search by item name or minecraft:item_id"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/70 py-3 pr-4 pl-10 text-sm text-slate-400 placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-80"
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Search unlocks automatically after the first approved snapshot.
              </p>
            </div>

            <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gold-400/10 blur-2xl" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80">
                  <CloudOff className="h-9 w-9 text-slate-600" strokeWidth={1.25} />
                </div>
              </div>
              <p className="mt-6 font-display text-sm font-bold tracking-[0.22em] text-slate-300">
                THE LEDGER AWAITS ITS FIRST COUNT
              </p>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                The inventory view is ready. Once the QMSync receiver is connected,
                approved snapshots will appear here without changing this route.
              </p>
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel className="p-5">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-gold-400" />
                <h2 className="font-display text-xs font-bold tracking-[0.24em] text-gold-400">
                  HOW IT WORKS
                </h2>
              </div>
              <ol className="mt-5 space-y-5">
                {syncSteps.map((step) => (
                  <li key={step.number} className="grid grid-cols-[2rem_1fr] gap-3">
                    <span className="font-mono text-xs font-bold text-gold-500">
                      {step.number}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{step.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel className="border-gold-500/20 bg-gold-400/[0.03] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">
                Privacy by design
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Only approved player UUIDs and the configured Königsburg server will
                be accepted. Container names and Ender Chest contents can stay private.
              </p>
            </Panel>
          </div>
        </section>
      </main>

      <footer className="pb-8 text-center text-xs tracking-widest text-slate-600">
        KÖNIGSBURG · EST. MMXXVI
      </footer>
    </>
  );
}
