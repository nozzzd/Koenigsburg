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
    scope: "identify",
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
