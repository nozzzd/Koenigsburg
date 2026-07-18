import "server-only";
import { env } from "./env";

const API = "https://discord.com/api/v10";

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
}

export function oauthRedirectUri(): string {
  return `${env("NEXT_PUBLIC_SITE_URL")}/api/auth/discord/callback`;
}

export function oauthAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    response_type: "code",
    redirect_uri: oauthRedirectUri(),
    // identify: read who they are. guilds.join: lets the bot drop them straight
    // into the server on sign-in, so signing up actually means joining Discord.
    scope: "identify guilds.join",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("DISCORD_CLIENT_ID"),
      client_secret: env("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: oauthRedirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Discord /users/@me failed (${res.status})`);
  }
  return (await res.json()) as DiscordUser;
}

/**
 * Add the user to the guild using their OAuth access token (which carries their
 * consent via the guilds.join scope) plus the bot's authority. Returns true if
 * they were just added, false if they were already in the server (204) — both
 * are success. Requires the bot to have the "Create Instant Invite" permission.
 * Throws only on a real failure so callers can log and carry on.
 */
export async function addGuildMember(
  discordUserId: string,
  accessToken: string
): Promise<boolean> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    }
  );
  // 201 = added, 204 = already a member. Anything else is a genuine failure.
  if (res.status === 201) return true;
  if (res.status === 204) return false;
  throw new Error(`Discord guild join failed (${res.status})`);
}

/** Role IDs of the guild member, or null if they aren't in the guild. */
export async function getGuildMemberRoles(discordUserId: string): Promise<string[] | null> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}`,
    {
      headers: { Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}` },
      cache: "no-store",
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Discord guild member lookup failed (${res.status})`);
  }
  const member = (await res.json()) as { roles?: string[] };
  return member.roles ?? [];
}

export async function hasCitizenRole(discordUserId: string): Promise<boolean> {
  const roles = await getGuildMemberRoles(discordUserId);
  return roles?.includes(env("DISCORD_CITIZEN_ROLE_ID")) ?? false;
}

// Portal pages re-check citizenship on every load; cache briefly so a burst of
// navigation doesn't spend a Discord API call per request.
const roleCheckCache = new Map<string, { citizen: boolean; at: number }>();
const ROLE_CACHE_TTL_MS = 60_000;

export async function hasCitizenRoleCached(discordUserId: string): Promise<boolean> {
  const hit = roleCheckCache.get(discordUserId);
  if (hit && Date.now() - hit.at < ROLE_CACHE_TTL_MS) return hit.citizen;
  const citizen = await hasCitizenRole(discordUserId);
  roleCheckCache.set(discordUserId, { citizen, at: Date.now() });
  return citizen;
}

/**
 * Assigns @Citizen via the bot. Requires Manage Roles and the bot's role
 * to sit above @Citizen in the guild's role hierarchy.
 */
export async function assignCitizenRole(discordUserId: string): Promise<void> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}/roles/${env(
      "DISCORD_CITIZEN_ROLE_ID"
    )}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "X-Audit-Log-Reason": "Koenigsburg portal: application approved",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Discord role assignment failed (${res.status})`);
  }
}

// Whether /verify is installed. Cached so the admin page doesn't hit Discord
// on every load — it's a one-time setup step that then never changes.
let commandCache: { registered: boolean; at: number } | null = null;
const COMMAND_CACHE_TTL_MS = 5 * 60_000;

export function clearCommandCache() {
  commandCache = null;
}

export async function isVerifyCommandRegistered(): Promise<boolean> {
  if (commandCache && Date.now() - commandCache.at < COMMAND_CACHE_TTL_MS) {
    return commandCache.registered;
  }
  const res = await fetch(
    `${API}/applications/${env("DISCORD_CLIENT_ID")}/guilds/${env(
      "DISCORD_GUILD_ID"
    )}/commands`,
    {
      headers: { Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}` },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Command lookup failed (${res.status})`);
  const commands = (await res.json()) as { name: string }[];
  const registered = commands.some((c) => c.name === "verify");
  commandCache = { registered, at: Date.now() };
  return registered;
}

/** Converts a #rrggbb hex string to the integer Discord expects (0 = none). */
function hexToInt(hex?: string | null): number {
  if (!hex) return 0;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? parseInt(m[1], 16) : 0;
}

/** Creates a guild role for a team; returns its id. */
export async function createGuildRole(name: string, color?: string | null): Promise<string> {
  const res = await fetch(`${API}/guilds/${env("DISCORD_GUILD_ID")}/roles`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": "Koenigsburg portal: team created",
    },
    body: JSON.stringify({ name, color: hexToInt(color), mentionable: true }),
  });
  if (!res.ok) {
    throw new Error(`Discord role creation failed (${res.status})`);
  }
  const role = (await res.json()) as { id: string };
  return role.id;
}

/** Renames / recolours an existing guild role. 404 is fine — role is gone. */
export async function editGuildRole(
  roleId: string,
  fields: { name?: string; color?: string | null }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.color !== undefined) body.color = hexToInt(fields.color);
  if (Object.keys(body).length === 0) return;

  const res = await fetch(`${API}/guilds/${env("DISCORD_GUILD_ID")}/roles/${roleId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": "Koenigsburg portal: team edited",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord role edit failed (${res.status})`);
  }
}

/** Deletes a guild role. 404 is fine — already gone. */
export async function deleteGuildRole(roleId: string): Promise<void> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "X-Audit-Log-Reason": "Koenigsburg portal: team disbanded",
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord role deletion failed (${res.status})`);
  }
}

/** Assigns an arbitrary role to a member (team membership). 404 = not in guild. */
export async function addMemberRole(discordUserId: string, roleId: string): Promise<void> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "X-Audit-Log-Reason": "Koenigsburg portal: joined team",
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord role add failed (${res.status})`);
  }
}

/** Strips an arbitrary role from a member. 404 = already gone. */
export async function removeMemberRole(discordUserId: string, roleId: string): Promise<void> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "X-Audit-Log-Reason": "Koenigsburg portal: left team",
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord role remove failed (${res.status})`);
  }
}

/**
 * Every Discord ID currently in the guild, as a Set — one bulk paginated call
 * instead of one lookup per member. Checking "who left" against this set avoids
 * the rate-limit storm (and the silent fail-open) you get from firing a
 * per-member request for the whole roll at once.
 *
 * Requires the bot's **Server Members Intent** (Developer Portal → Bot →
 * Privileged Gateway Intents → Server Members Intent). Without it Discord
 * returns the bot itself only or 403; the caller must treat a throw as
 * "couldn't determine", never as "everyone left".
 */
export async function listGuildMemberIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let after = "0";
  // Page through in chunks of 1000 until a short page signals the end.
  for (let page = 0; page < 50; page++) {
    const res = await fetch(
      `${API}/guilds/${env("DISCORD_GUILD_ID")}/members?limit=1000&after=${after}`,
      {
        headers: { Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`Discord member list failed (${res.status})`);
    }
    const batch = (await res.json()) as { user?: { id: string } }[];
    for (const m of batch) if (m.user?.id) ids.add(m.user.id);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user!.id;
  }
  return ids;
}

/**
 * DM a user via the bot. Opens (or reuses) a DM channel, then posts. Returns
 * false rather than throwing when the DM can't be sent — most often because the
 * user has DMs closed or shares no server with the bot — so callers can carry
 * on through a batch. A 403/404 is an expected "couldn't reach them", not a bug.
 */
export async function sendDirectMessage(
  discordUserId: string,
  content: string
): Promise<boolean> {
  const auth = `Bot ${env("DISCORD_BOT_TOKEN")}`;
  const channelRes = await fetch(`${API}/users/@me/channels`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!channelRes.ok) {
    console.error(`Could not open DM channel for ${discordUserId} (${channelRes.status})`);
    return false;
  }
  const channel = (await channelRes.json()) as { id: string };

  const msgRes = await fetch(`${API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) {
    console.error(`Could not DM ${discordUserId} (${msgRes.status})`);
    return false;
  }
  return true;
}

/** Strips @Citizen — used when a player renounces their citizenship. */
export async function removeCitizenRole(discordUserId: string): Promise<void> {
  const res = await fetch(
    `${API}/guilds/${env("DISCORD_GUILD_ID")}/members/${discordUserId}/roles/${env(
      "DISCORD_CITIZEN_ROLE_ID"
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "X-Audit-Log-Reason": "Koenigsburg portal: citizenship renounced",
      },
    }
  );
  // 404 = already gone (left the guild); nothing to strip.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord role removal failed (${res.status})`);
  }
}
