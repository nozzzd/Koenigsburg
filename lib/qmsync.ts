import "server-only";

import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { ensureActiveCitizenship } from "@/lib/citizenship";
import { checkRateLimit, ipFromHeaders } from "@/lib/ratelimit";

// Per-source flood guard for the ingestion endpoints. A real game server syncs
// a handful of times a minute; this leaves generous headroom while capping a
// flood of heavy snapshot writes (each fires the replace_inventory_snapshot
// RPC). Best-effort - see lib/ratelimit.ts.
const QMSYNC_RATE_LIMIT = 120;
const QMSYNC_RATE_WINDOW_MS = 60_000;

const PROTOCOL_VERSION = 1;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_MEMORY_KEYS = 200;
const MAX_CONTAINERS = 5_000;
const MAX_ITEMS = 100_000;
const MAX_COORD = 30_000_000;
const MAX_Y = 4_096;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const IGN_PATTERN = /^[A-Za-z0-9_]{1,16}$/;
const ID_PATTERN = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
const MEMORY_KEY_PATTERN = /^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/;
const POSITION_PATTERN = /^(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)$/;

type JsonObject = Record<string, unknown>;

type Identity = {
  protocolVersion: number;
  playerUuid: string;
  playerName: string;
  serverId: string;
  serverName: string;
};

type SyncPlayer = {
  id: string;
  minecraft_ign: string;
  minecraft_uuid: string | null;
  discord_id: string | null;
  status: "pending" | "active";
  role: "guest" | "citizen" | "admin";
};

type PlayerResolution =
  | { ok: true; player: SyncPlayer }
  | { ok: false; denied: boolean; error?: string };

type NormalizedItem = {
  item_id: string;
  display_name: string;
  quantity: number;
};

type NormalizedContainer = {
  dimension: string;
  block_x: number;
  block_y: number;
  block_z: number;
  container_type: string;
  container_name: string | null;
  observed_at: string;
  items: NormalizedItem[];
};

type Failure = { ok: false; response: Response };

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function qmsyncStatus(status: "SYNCED" | "ACCESS_DENIED"): Response {
  return json({ status });
}

/** Length-guarded constant-time compare for the shared server id. NOTE: the
 *  server id is a low-entropy, guessable value (see QMSYNC_SERVER_ID in
 *  .env.example) - this only removes the timing side-channel; it is NOT a
 *  substitute for a real secret token on this endpoint (tracked separately). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Pulls the QMSync API key out of a request, tolerant of however the mod sends
 * it: `Authorization: Bearer <key>` (or a bare Authorization value), a
 * dedicated header, or an `apiKey`/`api_key` field in the JSON body. This keeps
 * the receiver working whichever transport the mod build uses.
 */
function extractApiKey(request: Request, payload: JsonObject): string {
  const auth = request.headers.get("authorization")?.trim();
  if (auth) {
    const bearer = /^Bearer\s+(.+)$/i.exec(auth);
    return (bearer ? bearer[1] : auth).trim();
  }
  const header = (name: string) => request.headers.get(name)?.trim() ?? "";
  const fromHeader =
    header("x-api-key") ||
    header("x-qmsync-api-key") ||
    header("x-qmsync-key") ||
    header("qmsync-api-key");
  if (fromHeader) return fromHeader;
  const body = payload.apiKey ?? payload.api_key ?? payload.apikey;
  return typeof body === "string" ? body.trim() : "";
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
  return cleaned && cleaned.length <= max ? cleaned : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function uuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

function defaultItemName(itemId: string): string {
  const path = itemId.split(":").at(-1) ?? itemId;
  return path
    .split(/[_/]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 120);
}

function componentText(value: unknown, depth = 0): string | null {
  if (depth > 8) return null;
  if (typeof value === "string") return text(value, 120);
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => componentText(entry, depth + 1))
      .filter((entry): entry is string => Boolean(entry))
      .join("");
    return joined ? joined.slice(0, 120) : null;
  }

  const component = object(value);
  if (!component) return null;
  const own =
    text(component.text, 120) ??
    text(component.fallback, 120) ??
    text(component.translate, 120) ??
    "";
  const extra = componentText(component.extra, depth + 1) ?? "";
  const joined = own + extra;
  return joined ? joined.slice(0, 120) : null;
}

function itemName(item: JsonObject, itemId: string): string {
  const components = object(item.components);
  return (
    componentText(
      components?.["minecraft:custom_name"] ??
        components?.["minecraft:item_name"]
    ) ?? defaultItemName(itemId)
  );
}

function dimension(value: string): string | null {
  const normalized = text(value.toLowerCase(), 100);
  if (!normalized || !MEMORY_KEY_PATTERN.test(normalized)) return null;
  if (normalized === "minecraft:overworld") return "overworld";
  if (normalized === "minecraft:the_nether") return "nether";
  if (normalized === "minecraft:the_end") return "end";
  return normalized;
}

function coordinates(value: string): [number, number, number] | null {
  const match = POSITION_PATTERN.exec(value);
  if (!match) return null;
  const result: [number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  if (
    result.some((number) => !Number.isSafeInteger(number)) ||
    Math.abs(result[0]) > MAX_COORD ||
    Math.abs(result[2]) > MAX_COORD ||
    Math.abs(result[1]) > MAX_Y
  ) {
    return null;
  }
  return result;
}

function observedAt(value: unknown, receivedAt: number): string {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  const timestamp =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, receivedAt + MAX_CLOCK_SKEW_MS)
      : receivedAt;
  return new Date(timestamp).toISOString();
}

async function readPayload(
  request: Request
): Promise<{ ok: true; payload: JsonObject } | Failure> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: json({ error: "QMSync payload is too large." }, 413),
    };
  }

  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return {
        ok: false,
        response: json({ error: "QMSync payload is too large." }, 413),
      };
    }
    const payload = object(JSON.parse(body));
    return payload
      ? { ok: true, payload }
      : {
          ok: false,
          response: json({ error: "The body must be a JSON object." }, 400),
        };
  } catch {
    return {
      ok: false,
      response: json({ error: "The body is not valid JSON." }, 400),
    };
  }
}

async function parseRequest(
  request: Request
): Promise<
  { ok: true; payload: JsonObject; identity: Identity } | Failure
> {
  const expectedServerId = process.env.QMSYNC_SERVER_ID?.trim();
  if (!expectedServerId) {
    return {
      ok: false,
      response: json({ error: "QMSync is not configured." }, 503),
    };
  }

  const parsed = await readPayload(request);
  if (!parsed.ok) return parsed;
  const payload = parsed.payload;

  // Real authentication for the ingestion endpoints. The serverId is a
  // guessable public value, so the actual gate is the shared QMSYNC_API_KEY the
  // mod is configured with. Enforced only when the env var is set, so setting
  // it (once the mod sends the key) is a clean cut-over that never breaks an
  // unconfigured deployment.
  const expectedApiKey = (
    process.env.QMSYNC_API_KEY ?? process.env.QMSYNC_TOKEN
  )?.trim();
  if (expectedApiKey) {
    const provided = extractApiKey(request, payload);
    if (!provided || !safeEqual(provided, expectedApiKey)) {
      return { ok: false, response: json({ error: "Unauthorized." }, 401) };
    }
  }
  const protocolVersion = integer(payload.protocolVersion);
  if (protocolVersion !== PROTOCOL_VERSION) {
    return {
      ok: false,
      response: json({ error: "Unsupported QMSync protocol version." }, 400),
    };
  }

  const playerUuid = uuid(payload.playerUuid);
  const playerName = text(payload.playerName, 16);
  const serverId = text(payload.serverId, 80);
  const serverName = text(payload.serverName, 120);
  if (
    !playerUuid ||
    !playerName ||
    !IGN_PATTERN.test(playerName) ||
    !serverId ||
    !serverName
  ) {
    return {
      ok: false,
      response: json({ error: "QMSync identity fields are invalid." }, 400),
    };
  }
  if (!safeEqual(serverId, expectedServerId)) {
    return { ok: false, response: qmsyncStatus("ACCESS_DENIED") };
  }

  return {
    ok: true,
    payload,
    identity: {
      protocolVersion,
      playerUuid,
      playerName,
      serverId,
      serverName,
    },
  };
}

async function authorizePlayer(player: SyncPlayer): Promise<PlayerResolution> {
  return (await ensureActiveCitizenship(player))
    ? { ok: true, player }
    : { ok: false, denied: true };
}

async function resolvePlayer(identity: Identity): Promise<PlayerResolution> {
  const supabase = getSupabase();
  const byUuid = await supabase
    .from("players")
    .select("id,minecraft_ign,minecraft_uuid,discord_id,status,role")
    .eq("minecraft_uuid", identity.playerUuid)
    .maybeSingle<SyncPlayer>();

  if (byUuid.error) {
    console.error("QMSync UUID lookup failed:", byUuid.error);
    return {
      ok: false,
      denied: false,
      error: "Player verification is unavailable. Run supabase/011_inventory.sql.",
    };
  }
  if (byUuid.data) {
    return authorizePlayer(byUuid.data);
  }

  const byIgn = await supabase
    .from("players")
    .select("id,minecraft_ign,minecraft_uuid,discord_id,status,role")
    .ilike("minecraft_ign", identity.playerName)
    .eq("status", "active")
    .maybeSingle<SyncPlayer>();

  if (byIgn.error) {
    console.error("QMSync IGN lookup failed:", byIgn.error);
    return {
      ok: false,
      denied: false,
      error: "Player verification is temporarily unavailable.",
    };
  }
  if (
    !byIgn.data ||
    (byIgn.data.minecraft_uuid &&
      byIgn.data.minecraft_uuid !== identity.playerUuid)
  ) {
    return { ok: false, denied: true };
  }
  if (!(await ensureActiveCitizenship(byIgn.data))) {
    return { ok: false, denied: true };
  }
  if (byIgn.data.minecraft_uuid === identity.playerUuid) {
    return { ok: true, player: byIgn.data };
  }

  const linked = await supabase
    .from("players")
    .update({ minecraft_uuid: identity.playerUuid })
    .eq("id", byIgn.data.id)
    .is("minecraft_uuid", null)
    .select("id,minecraft_ign,minecraft_uuid,discord_id,status,role")
    .maybeSingle<SyncPlayer>();

  if (linked.error) {
    console.error("QMSync UUID link failed:", linked.error);
    return {
      ok: false,
      denied: false,
      error: "The player UUID could not be linked.",
    };
  }
  if (linked.data) return { ok: true, player: linked.data };

  const raced = await supabase
    .from("players")
    .select("id,minecraft_ign,minecraft_uuid,discord_id,status,role")
    .eq("id", byIgn.data.id)
    .eq("minecraft_uuid", identity.playerUuid)
    .maybeSingle<SyncPlayer>();
  if (raced.error) {
    console.error("QMSync UUID race lookup failed:", raced.error);
    return {
      ok: false,
      denied: false,
      error: "Player verification is temporarily unavailable.",
    };
  }
  return raced.data
    ? authorizePlayer(raced.data)
    : { ok: false, denied: true };
}

function normalizeSnapshot(
  value: unknown,
  receivedAt: number
):
  | { ok: true; containers: NormalizedContainer[] }
  | { ok: false; error: string } {
  const data = object(value);
  if (!data) return { ok: false, error: "data must be a JSON object." };

  const keys = Object.entries(data);
  if (keys.length > MAX_MEMORY_KEYS) {
    return { ok: false, error: "The snapshot has too many memory keys." };
  }

  const containers: NormalizedContainer[] = [];
  let totalItems = 0;

  for (const [rawDimension, rawKey] of keys) {
    const normalizedDimension = dimension(rawDimension);
    const key = object(rawKey);
    const memories = object(key?.memories);
    if (!normalizedDimension || !key || !memories) {
      return {
        ok: false,
        error: "Memory key " + rawDimension + " is invalid.",
      };
    }
    const overrides = object(key.overrides) ?? {};

    for (const [rawPosition, rawMemory] of Object.entries(memories)) {
      if (containers.length >= MAX_CONTAINERS) {
        return { ok: false, error: "The snapshot has too many containers." };
      }

      const position = coordinates(rawPosition);
      const memory = object(rawMemory);
      if (!position || !memory || !Array.isArray(memory.items)) {
        return {
          ok: false,
          error: "Memory " + rawDimension + "/" + rawPosition + " is invalid.",
        };
      }

      totalItems += memory.items.length;
      if (totalItems > MAX_ITEMS) {
        return { ok: false, error: "The snapshot has too many item stacks." };
      }

      const combined = new Map<string, NormalizedItem>();
      for (const rawItem of memory.items) {
        const item = object(rawItem);
        if (!item) {
          return { ok: false, error: "The snapshot contains an invalid item." };
        }
        if (Object.keys(item).length === 0) continue;

        const itemId = text(item.id, 160)?.toLowerCase();
        const quantity = item.count === undefined ? 1 : integer(item.count);
        if (
          !itemId ||
          !ID_PATTERN.test(itemId) ||
          quantity === null ||
          quantity <= 0 ||
          quantity > 2_147_483_647
        ) {
          return { ok: false, error: "The snapshot contains an invalid item." };
        }

        const displayName = itemName(item, itemId);
        const itemKey = itemId + "\u0000" + displayName;
        const previous = combined.get(itemKey);
        combined.set(itemKey, {
          item_id: itemId,
          display_name: displayName,
          quantity: Math.min(
            Number.MAX_SAFE_INTEGER,
            (previous?.quantity ?? 0) + quantity
          ),
        });
      }

      const override = object(overrides[rawPosition]);
      const rawContainerType = text(memory.container, 160)?.toLowerCase();
      containers.push({
        dimension: normalizedDimension,
        block_x: position[0],
        block_y: position[1],
        block_z: position[2],
        container_type:
          rawContainerType && ID_PATTERN.test(rawContainerType)
            ? rawContainerType
            : "minecraft:container",
        container_name:
          text(override?.customName, 120) ?? componentText(memory.name),
        observed_at: observedAt(memory.realTimestamp, receivedAt),
        items: [...combined.values()],
      });
    }
  }

  return { ok: true, containers };
}

function playerFailure(
  result: { ok: false; denied: boolean; error?: string }
): Response {
  return result.denied
    ? qmsyncStatus("ACCESS_DENIED")
    : json({ error: result.error ?? "Player verification failed." }, 503);
}

async function qmsyncRateLimited(request: Request): Promise<Response | null> {
  const key = `qmsync:${ipFromHeaders(request.headers)}`;
  const limited = await checkRateLimit(key, QMSYNC_RATE_LIMIT, QMSYNC_RATE_WINDOW_MS);
  if (limited.ok) return null;
  return json({ error: "Too many QMSync requests. Slow down." }, 429);
}

export async function handleQMSyncHandshake(
  request: Request
): Promise<Response> {
  const throttled = await qmsyncRateLimited(request);
  if (throttled) return throttled;

  const parsed = await parseRequest(request);
  if (!parsed.ok) return parsed.response;

  const resolved = await resolvePlayer(parsed.identity);
  return resolved.ok ? qmsyncStatus("SYNCED") : playerFailure(resolved);
}

export async function handleQMSyncSync(request: Request): Promise<Response> {
  const receivedAt = Date.now();
  const throttled = await qmsyncRateLimited(request);
  if (throttled) return throttled;

  const parsed = await parseRequest(request);
  if (!parsed.ok) return parsed.response;

  const resolved = await resolvePlayer(parsed.identity);
  if (!resolved.ok) return playerFailure(resolved);

  const snapshot = normalizeSnapshot(parsed.payload.data, receivedAt);
  if (!snapshot.ok) return json({ error: snapshot.error }, 400);

  const supabase = getSupabase();
  const source = await supabase
    .from("inventory_sources")
    .upsert(
      {
        server_id: parsed.identity.serverId,
        player_id: resolved.player.id,
        player_uuid: parsed.identity.playerUuid,
        player_ign: resolved.player.minecraft_ign,
        source_key: "qmsync-v1",
        source_label: parsed.identity.serverName.slice(0, 80),
        protocol_version: parsed.identity.protocolVersion,
        last_sync_at: new Date(receivedAt).toISOString(),
      },
      { onConflict: "server_id,player_id,source_key" }
    )
    .select("id")
    .single<{ id: string }>();

  if (source.error || !source.data) {
    console.error("QMSync source upsert failed:", source.error);
    return json(
      { error: "Inventory storage is unavailable. Run supabase/011_inventory.sql." },
      503
    );
  }

  const replaced = await supabase.rpc("replace_inventory_snapshot", {
    p_server_id: parsed.identity.serverId,
    p_source_id: source.data.id,
    p_containers: snapshot.containers,
  });
  if (replaced.error) {
    console.error("QMSync snapshot replace failed:", replaced.error);
    return json(
      { error: "Snapshot storage is unavailable. Run supabase/012_qmsync_v1.sql." },
      503
    );
  }

  revalidatePath("/inventory");
  return qmsyncStatus("SYNCED");
}

export function qmsyncOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
