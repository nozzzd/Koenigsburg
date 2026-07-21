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
import {
  getInventoryLedger,
  type InventorySearchResult,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory",
  description:
    "Search Königsburg's QMSync-tracked stores by item name or Minecraft ID.",
};

const syncSteps = [
  {
    number: "01",
    title: "The mod records",
    text: "QMSync watches storage an approved citizen opens in-game.",
  },
  {
    number: "02",
    title: "The ledger receives",
    text: "New container snapshots replace older counts at the same coordinates.",
  },
  {
    number: "03",
    title: "The nation searches",
    text: "Items resolve to their dimension, container, and exact coordinates.",
  },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "No snapshot yet";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function readableId(value: string): string {
  const path = value.split(":").at(-1) ?? value;
  return path
    .split(/[_/]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function dimensionName(value: string): string {
  if (value === "overworld" || value === "minecraft:overworld") return "Overworld";
  if (value === "nether" || value === "minecraft:the_nether") return "Nether";
  if (value === "end" || value === "minecraft:the_end") return "The End";
  return readableId(value);
}

function ResultRow({ result }: { result: InventorySearchResult }) {
  const container = result.container_name || readableId(result.container_type);

  return (
    <li>
      <Panel className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-base font-bold tracking-wide text-slate-100">
              {result.display_name}
            </h3>
            <span className="font-display text-lg font-bold text-gold-300">
              ×{formatCount(result.quantity)}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">
            {result.item_id}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-gold-500" />
              {container}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gold-500" />
              {dimensionName(result.dimension)} · {result.block_x}, {result.block_y},{" "}
              {result.block_z}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-600 sm:text-right">
          Counted
          <br className="hidden sm:block" /> {formatDate(result.observed_at)}
        </p>
      </Panel>
    </li>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "")
    .trim()
    .slice(0, 80);
  const ledger = await getInventoryLedger(query);
  const { stats } = ledger;
  const hasSnapshots = stats.containers > 0;
  const live =
    ledger.ready && ledger.receiverConfigured && stats.memoryBanks > 0;

  const ledgerStats = [
    {
      icon: Boxes,
      label: "Stored items",
      detail: "Across every recorded stack",
      value: stats.storedItems,
    },
    {
      icon: PackageSearch,
      label: "Unique items",
      detail: "Searchable by name or ID",
      value: stats.uniqueItems,
    },
    {
      icon: MapPin,
      label: "Containers",
      detail: "With dimension and coordinates",
      value: stats.containers,
    },
    {
      icon: Database,
      label: "Memory banks",
      detail: "Synced by approved citizens",
      value: stats.memoryBanks,
    },
  ];

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
              Inventory of the nation
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base leading-7 text-slate-400 sm:text-lg">
              One search across Königsburg&apos;s recorded chests, barrels, and stores —
              with the exact place each item was last seen.
            </p>
          </div>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    live
                      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                      : ledger.ready && ledger.receiverConfigured
                        ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
                        : "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.4)]"
                  }`}
                />
                <span className="font-display text-xs font-bold tracking-[0.2em] text-slate-300">
                  QMSYNC
                </span>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                  live
                    ? "border-emerald-500/20 bg-emerald-400/5 text-emerald-300"
                    : ledger.ready && ledger.receiverConfigured
                      ? "border-amber-500/20 bg-amber-400/5 text-amber-300"
                      : "border-red-500/20 bg-red-400/5 text-red-300"
                }`}
              >
                {live
                  ? "Linked"
                  : !ledger.ready
                    ? "Database setup"
                    : ledger.receiverConfigured
                      ? "Ready for sync"
                      : "Receiver config"}
              </span>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Protocol</span>
                <span className="font-mono text-slate-300">QMSync v1</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Nation</span>
                <span className="text-right text-slate-300">{ledger.realmName}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Last count</span>
                <span className="text-right text-slate-300">
                  {formatDate(stats.lastSnapshotAt)}
                </span>
              </div>
            </div>
          </Panel>
        </section>

        <GoldDivider />

        <section className="stagger grid gap-4 py-8 sm:grid-cols-2 xl:grid-cols-4">
          {ledgerStats.map(({ icon: Icon, label, detail, value }) => (
            <Panel key={label} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                  <Icon className="h-5 w-5 text-gold-400" strokeWidth={1.5} />
                </div>
                <span className="font-display text-2xl font-bold text-slate-200">
                  {ledger.ready ? formatCount(value) : "—"}
                </span>
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
              <form action="/inventory" method="get">
                <label
                  htmlFor="inventory-search"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  Search the stores
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-600"
                      aria-hidden
                    />
                    <input
                      id="inventory-search"
                      name="q"
                      type="search"
                      maxLength={80}
                      defaultValue={query}
                      disabled={!ledger.ready || !hasSnapshots}
                      placeholder="Search by item name or minecraft:item_id"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 py-3 pr-4 pl-10 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!ledger.ready || !hasSnapshots}
                    className="btn-gold pressable inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-display text-sm font-bold tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" />
                    Search
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {!ledger.ready
                    ? "Run the inventory SQL migration to connect this page."
                    : hasSnapshots
                      ? "Search by the in-game name or full namespaced item ID."
                      : !ledger.receiverConfigured
                        ? "Add QMSYNC_SERVER_ID, then redeploy."
                        : "Search unlocks after the first approved QMSync snapshot."}
                </p>
              </form>
            </div>

            {!ledger.ready ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/20">
                  <CloudOff className="h-9 w-9 text-red-400/70" strokeWidth={1.25} />
                </div>
                <p className="mt-6 font-display text-sm font-bold tracking-[0.22em] text-slate-300">
                  THE LEDGER NEEDS ITS DATABASE
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                  Run <span className="font-mono text-slate-400">supabase/011_inventory.sql</span>{" "}
                  in the Supabase SQL Editor, then redeploy with the QMSync environment
                  variables.
                </p>
              </div>
            ) : !hasSnapshots ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80">
                  <Database className="h-9 w-9 text-slate-600" strokeWidth={1.25} />
                </div>
                <p className="mt-6 font-display text-sm font-bold tracking-[0.22em] text-slate-300">
                  THE LEDGER AWAITS ITS FIRST COUNT
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                  {ledger.receiverConfigured
                    ? "The receiver is ready. The first QMSync snapshot from an active citizen will make these stores searchable."
                    : "The database is ready. Add QMSYNC_SERVER_ID in Vercel, then redeploy."}
                </p>
              </div>
            ) : ledger.results.length === 0 ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center">
                <PackageSearch className="h-10 w-10 text-slate-600" strokeWidth={1.25} />
                <p className="mt-5 font-display text-sm font-bold tracking-[0.18em] text-slate-300">
                  NO MATCHES IN THE STORES
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Try a shorter name or the full Minecraft item ID.
                </p>
                <Link
                  href="/inventory"
                  className="mt-4 text-sm font-semibold text-gold-400 hover:text-gold-300"
                >
                  Clear search
                </Link>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    {query ? `${ledger.results.length} search matches` : "Recently counted"}
                  </h2>
                  {query && (
                    <Link
                      href="/inventory"
                      className="text-xs font-semibold text-gold-400 hover:text-gold-300"
                    >
                      Clear search
                    </Link>
                  )}
                </div>
                <ul className="space-y-3">
                  {ledger.results.map((result) => (
                    <ResultRow
                      key={`${result.container_id}:${result.item_id}:${result.display_name}`}
                      result={result}
                    />
                  ))}
                </ul>
                {ledger.results.length === 100 && (
                  <p className="mt-4 text-center text-xs text-slate-600">
                    Showing the first 100 locations. Add more detail to narrow the search.
                  </p>
                )}
              </div>
            )}
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
                Only the configured receiver and active player UUIDs are accepted.
                Private containers and Ender Chests are discarded and never stored.
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
