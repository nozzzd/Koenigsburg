import { createHash, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_CONTAINERS = 200;
const MAX_ITEMS = 8_000;
const MAX_COORD = 30_000_000;
const MAX_Y = 4_096;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const CONCURRENCY = 8;
const ID_PATTERN = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
const DIMENSION_PATTERN = /^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/;
const SOURCE_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const IGN_PATTERN = /^[A-Za-z0-9_]{1,16}$/;

type JsonObject = Record<string, unknown>;

type NormalizedItem = {
  item_id: string;
  display_name: string;
  quantity: number;
};

type NormalizedContainer = {
  dimension: string;
  blockX: number;
  blockY: number;
  blockZ: number;
  containerType: string;
  containerName: string | null;
  observedAt: string;
  items: NormalizedItem[];
};

type NormalizedPayload = {
  serverId: string;
  playerUuid: string;
  playerIgn: string;
  sourceKey: string;
  sourceLabel: string | null;
  protocolVersion: number;
  containers: NormalizedContainer[];
  skippedPrivate: number;
};

type SyncPlayer = {
  id: string;
  minecraft_ign: string;
  minecraft_uuid: string | null;
  status: "pending" | "active";
};

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const withoutControls = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  const text = withoutControls
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, max) : null;
}

function normalizeUuid(value: unknown): string | null {
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

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function timestamp(value: unknown, fallbackMs: number, now: number): string | null {
  let parsed = fallbackMs;
  if (value !== undefined && value !== null) {
    if (typeof value === "number" && Number.isFinite(value)) {
      parsed = value < 10_000_000_000 ? value * 1_000 : value;
    } else if (typeof value === "string") {
      parsed = Date.parse(value);
    } else {
      return null;
    }
  }

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(Math.min(parsed, now + MAX_CLOCK_SKEW_MS)).toISOString();
}

function displayName(itemId: string): string {
  const path = itemId.split(":").at(-1) ?? itemId;
  return path
    .split(/[_/]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 120);
}

function normalizeDimension(value: unknown): string | null {
  const raw = cleanText(value, 100)?.toLowerCase();
  if (!raw || !DIMENSION_PATTERN.test(raw)) return null;
  if (raw === "minecraft:overworld") return "overworld";
  if (raw === "minecraft:the_nether") return "nether";
  if (raw === "minecraft:the_end") return "end";
  return raw;
}

function normalizePayload(
  raw: unknown,
  configuredServerId: string
):
  | { ok: true; value: NormalizedPayload }
  | { ok: false; error: string } {
  const payload = object(raw);
  if (!payload) return { ok: false, error: "The request body must be a JSON object." };

  const protocolVersion = integer(payload.protocolVersion ?? payload.protocol);
  if (protocolVersion !== 1) {
    return { ok: false, error: "Unsupported protocol version. QMSync v1 is required." };
  }

  const serverId = cleanText(payload.serverId, 80);
  if (!serverId || serverId !== configuredServerId) {
    return { ok: false, error: "This receiver is not configured for that server." };
  }

  const player = object(payload.player);
  const playerUuid = normalizeUuid(player?.uuid);
  const playerIgn = cleanText(player?.ign, 16);
  if (!playerUuid || !playerIgn || !IGN_PATTERN.test(playerIgn)) {
    return { ok: false, error: "player.uuid or player.ign is invalid." };
  }

  const source = object(payload.source);
  const sourceKey = cleanText(source?.id, 120) ?? "default";
  if (!SOURCE_PATTERN.test(sourceKey)) {
    return {
      ok: false,
      error: "source.id may only contain letters, numbers, dot, underscore, colon, or dash.",
    };
  }
  const sourceLabel = cleanText(source?.label, 80);

  const rawContainers = payload.containers;
  if (!Array.isArray(rawContainers)) {
    return { ok: false, error: "containers must be an array." };
  }
  if (rawContainers.length > MAX_CONTAINERS) {
    return {
      ok: false,
      error: `A sync can contain at most ${MAX_CONTAINERS} containers; send another batch.`,
    };
  }

  const now = Date.now();
  const defaultObservedAt = timestamp(payload.capturedAt, now, now);
  if (!defaultObservedAt) {
    return { ok: false, error: "capturedAt is invalid." };
  }

  let totalItems = 0;
  let skippedPrivate = 0;
  const byLocation = new Map<string, NormalizedContainer>();

  for (let index = 0; index < rawContainers.length; index++) {
    const container = object(rawContainers[index]);
    if (!container) {
      return { ok: false, error: `containers[${index}] must be an object.` };
    }

    const containerType = cleanText(container.type, 160)?.toLowerCase();
    if (!containerType || !ID_PATTERN.test(containerType)) {
      return { ok: false, error: `containers[${index}].type is invalid.` };
    }

    if (container.private === true || containerType.endsWith(":ender_chest")) {
      skippedPrivate++;
      continue;
    }

    const position = object(container.position) ?? container;
    const blockX = integer(position.x);
    const blockY = integer(position.y);
    const blockZ = integer(position.z);
    if (
      blockX === null ||
      blockY === null ||
      blockZ === null ||
      Math.abs(blockX) > MAX_COORD ||
      Math.abs(blockZ) > MAX_COORD ||
      Math.abs(blockY) > MAX_Y
    ) {
      return { ok: false, error: `containers[${index}].position is invalid.` };
    }

    const dimension = normalizeDimension(container.dimension);
    if (!dimension) {
      return { ok: false, error: `containers[${index}].dimension is invalid.` };
    }

    const observedAt =
      timestamp(container.capturedAt, Date.parse(defaultObservedAt), now) ?? null;
    if (!observedAt) {
      return { ok: false, error: `containers[${index}].capturedAt is invalid.` };
    }

    if (!Array.isArray(container.items)) {
      return { ok: false, error: `containers[${index}].items must be an array.` };
    }
    totalItems += container.items.length;
    if (totalItems > MAX_ITEMS) {
      return {
        ok: false,
        error: `A sync can contain at most ${MAX_ITEMS} item rows; send another batch.`,
      };
    }

    const combined = new Map<string, NormalizedItem>();
    for (let itemIndex = 0; itemIndex < container.items.length; itemIndex++) {
      const item = object(container.items[itemIndex]);
      const itemId = cleanText(item?.id, 160)?.toLowerCase();
      const quantity = integer(item?.count);
      if (
        !itemId ||
        !ID_PATTERN.test(itemId) ||
        quantity === null ||
        quantity <= 0 ||
        quantity > 2_147_483_647
      ) {
        return {
          ok: false,
          error: `containers[${index}].items[${itemIndex}] is invalid.`,
        };
      }
      const name = cleanText(item?.name, 120) ?? displayName(itemId);
      const key = `${itemId}\u0000${name}`;
      const previous = combined.get(key);
      combined.set(key, {
        item_id: itemId,
        display_name: name,
        quantity: Math.min(
          Number.MAX_SAFE_INTEGER,
          (previous?.quantity ?? 0) + quantity
        ),
      });
    }

    const normalized: NormalizedContainer = {
      dimension,
      blockX,
      blockY,
      blockZ,
      containerType,
      containerName: cleanText(container.name, 120),
      observedAt,
      items: [...combined.values()],
    };
    const location = `${dimension}:${blockX}:${blockY}:${blockZ}`;
    const previous = byLocation.get(location);
    if (!previous || Date.parse(previous.observedAt) <= Date.parse(observedAt)) {
      byLocation.set(location, normalized);
    }
  }

  return {
    ok: true,
    value: {
      serverId,
      playerUuid,
      playerIgn,
      sourceKey,
      sourceLabel,
      protocolVersion,
      containers: [...byLocation.values()],
      skippedPrivate,
    },
  };
}

function authorized(request: Request, expected: string): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const supplied = bearer || request.headers.get("x-qmsync-key")?.trim();
  if (!supplied) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

async function resolvePlayer(
  playerUuid: string,
  playerIgn: string
): Promise<
  | { ok: true; player: SyncPlayer }
  | { ok: false; status: number; error: string }
> {
  const supabase = getSupabase();
  const byUuid = await supabase
    .from("players")
    .select("id,minecraft_ign,minecraft_uuid,status")
    .eq("minecraft_uuid", playerUuid)
    .maybeSingle<SyncPlayer>();

  if (byUuid.error) {
    console.error("QMSync player UUID lookup failed:", byUuid.error);
    return {
      ok: false,
      status: 503,
      error: "Inventory storage is not ready. Run supabase/011_inventory.sql.",
    };
  }
  if (byUuid.data) {
    return byUuid.data.status === "active"
      ? { ok: true, player: byUuid.data }
      : { ok: false, status: 403, error: "That player is not approved to sync." };
  }

  const byIgn = await supabase
    .from("players")
    .select("id,minecraft_ign,minecraft_uuid,status")
    .ilike("minecraft_ign", playerIgn)
    .eq("status", "active")
    .maybeSingle<SyncPlayer>();

  if (byIgn.error) {
    console.error("QMSync player IGN lookup failed:", byIgn.error);
    return { ok: false, status: 503, error: "Could not verify the player." };
  }
  if (!byIgn.data) {
    return {
      ok: false,
      status: 403,
      error: "The Minecraft player must be active in the portal before syncing.",
    };
  }
  if (byIgn.data.minecraft_uuid && byIgn.data.minecraft_uuid !== playerUuid) {
    return {
      ok: false,
      status: 403,
      error: "That IGN is already linked to a different Minecraft UUID.",
    };
  }

  const linked = await supabase
    .from("players")
    .update({ minecraft_uuid: playerUuid })
    .eq("id", byIgn.data.id)
    .is("minecraft_uuid", null)
    .select("id,minecraft_ign,minecraft_uuid,status")
    .maybeSingle<SyncPlayer>();

  if (linked.error) {
    console.error("QMSync player UUID link failed:", linked.error);
    return {
      ok: false,
      status: 409,
      error: "Could not link that Minecraft UUID. Ask an admin to check the player record.",
    };
  }
  if (linked.data) return { ok: true, player: linked.data };

  const raced = await supabase
    .from("players")
    .select("id,minecraft_ign,minecraft_uuid,status")
    .eq("id", byIgn.data.id)
    .eq("minecraft_uuid", playerUuid)
    .maybeSingle<SyncPlayer>();
  if (raced.data?.status === "active") return { ok: true, player: raced.data };

  return {
    ok: false,
    status: 409,
    error: "The player identity changed during this sync. Please try again.",
  };
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.QMSYNC_API_KEY?.trim();
  const configuredServerId = process.env.QMSYNC_SERVER_ID?.trim();
  if (!apiKey || !configuredServerId) {
    return json(
      {
        ok: false,
        error: "QMSync is not configured on this deployment.",
      },
      503
    );
  }
  if (!authorized(request, apiKey)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Sync payload is too large." }, 413);
  }

  let rawPayload: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return json({ ok: false, error: "Sync payload is too large." }, 413);
    }
    rawPayload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "The request body is not valid JSON." }, 400);
  }

  const normalized = normalizePayload(rawPayload, configuredServerId);
  if (!normalized.ok) return json({ ok: false, error: normalized.error }, 400);
  const snapshot = normalized.value;

  const resolved = await resolvePlayer(snapshot.playerUuid, snapshot.playerIgn);
  if (!resolved.ok) {
    return json({ ok: false, error: resolved.error }, resolved.status);
  }

  const supabase = getSupabase();
  const sourceResponse = await supabase
    .from("inventory_sources")
    .upsert(
      {
        server_id: snapshot.serverId,
        player_id: resolved.player.id,
        player_uuid: snapshot.playerUuid,
        player_ign: resolved.player.minecraft_ign,
        source_key: snapshot.sourceKey,
        source_label: snapshot.sourceLabel,
        protocol_version: snapshot.protocolVersion,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "server_id,player_id,source_key" }
    )
    .select("id")
    .single<{ id: string }>();

  if (sourceResponse.error || !sourceResponse.data) {
    console.error("QMSync source upsert failed:", sourceResponse.error);
    return json(
      {
        ok: false,
        error: "Inventory storage is not ready. Run supabase/011_inventory.sql.",
      },
      503
    );
  }
  const sourceId = sourceResponse.data.id;

  let saved = 0;
  let stale = 0;
  let failed = 0;

  for (let offset = 0; offset < snapshot.containers.length; offset += CONCURRENCY) {
    const batch = snapshot.containers.slice(offset, offset + CONCURRENCY);
    const results = await Promise.all(
      batch.map((container) =>
        supabase.rpc("replace_inventory_container", {
          p_server_id: snapshot.serverId,
          p_source_id: sourceId,
          p_dimension: container.dimension,
          p_block_x: container.blockX,
          p_block_y: container.blockY,
          p_block_z: container.blockZ,
          p_container_type: container.containerType,
          p_container_name: container.containerName,
          p_observed_at: container.observedAt,
          p_items: container.items,
        })
      )
    );

    for (const result of results) {
      if (result.error) {
        failed++;
        console.error("QMSync container replace failed:", result.error);
      } else if (result.data === true) {
        saved++;
      } else {
        stale++;
      }
    }
  }

  if (saved > 0) revalidatePath("/inventory");

  if (failed > 0) {
    return json(
      {
        ok: false,
        saved,
        stale,
        failed,
        skippedPrivate: snapshot.skippedPrivate,
        error: "Some containers could not be stored; retry this batch.",
      },
      500
    );
  }

  return json({
    ok: true,
    saved,
    stale,
    skippedPrivate: snapshot.skippedPrivate,
  });
}
