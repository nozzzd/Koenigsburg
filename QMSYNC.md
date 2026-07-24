# QMSync inventory integration

Koenigsburg implements the QMSync protocol v1 contract from
[KarolexDev/QMSync](https://github.com/KarolexDev/QMSync).

The mod must be given the website base URL:

```text
https://koenigsburg.vercel.app
```

Do not append an API path. QMSync sends requests to these paths itself:

```text
POST /api/handshake
POST /api/sync
```

`POST /api/inventory/sync` is retained as a compatibility alias for the sync
endpoint.

## One-time setup

1. Run `supabase/011_inventory.sql`, then `supabase/012_qmsync_v1.sql`, in
   the Supabase SQL Editor after the other schema files. Both are idempotent.
2. Set `QMSYNC_SERVER_ID` in Vercel to the exact ID shown by `/qmsync status`
   while connected to the Minecraft server. This is normally similar to
   `multiplayer/play_example_com`, not a display name.
3. Optionally set `QMSYNC_SERVER_NAME` to the friendly realm name shown on the
   inventory page, then redeploy.
3a. Set `QMSYNC_API_KEY` in Vercel to the SAME value configured as the mod's
   `QMSYNC_API_KEY`. When present, the receiver rejects any handshake/sync that
   does not carry it (401). The `serverId` is public and guessable, so this key
   is the real authentication; leave it unset only during initial rollout.
   The key may be sent as `Authorization: Bearer <key>`, an `x-api-key` header,
   or an `apiKey` field in the JSON body - the receiver accepts any of them.
4. Make sure the connecting player's portal record is `active` and its
   `minecraft_ign` exactly matches the in-game name.
5. In Minecraft, run:

```text
/qmsync connect https://koenigsburg.vercel.app
```

On the first approved handshake, the website links the Mojang UUID to the
active portal record with the same IGN. Later requests authorize by UUID, so
changing an IGN does not create another player.

Authentication: set `QMSYNC_API_KEY` (see step 3a) to the shared key your mod
build sends. Never put Supabase credentials or any other website secret in the
client mod - the QMSync API key is the only secret it should hold.

## Handshake contract

QMSync sends:

```json
{
  "protocolVersion": 1,
  "playerUuid": "8667ba71-b85a-4004-af54-457a9734eed7",
  "playerName": "ExamplePlayer",
  "serverId": "multiplayer/play_example_com",
  "serverName": "Multiplayer: Koenigsburg"
}
```

An approved identity receives exactly:

```json
{ "status": "SYNCED" }
```

A wrong server, inactive player, unknown player, or mismatched UUID receives
HTTP 200 with:

```json
{ "status": "ACCESS_DENIED" }
```

Unsupported protocol versions and malformed payloads use HTTP 400. Missing
configuration or database functions use HTTP 5xx, which QMSync reports as a
connection failure.

## Snapshot contract

`POST /api/sync` repeats the identity fields and adds `data`, the complete
serialized QMSync memory bank:

```json
{
  "protocolVersion": 1,
  "playerUuid": "8667ba71-b85a-4004-af54-457a9734eed7",
  "playerName": "ExamplePlayer",
  "serverId": "multiplayer/play_example_com",
  "serverName": "Multiplayer: Koenigsburg",
  "data": {
    "minecraft:overworld": {
      "memories": {
        "125,64,-310": {
          "items": [
            { "id": "minecraft:cobblestone", "count": 64 }
          ],
          "container": "minecraft:chest",
          "realTimestamp": "2026-07-21T18:29:48Z"
        }
      },
      "overrides": {}
    }
  }
}
```

Each successful request atomically replaces that player's previous full
snapshot. Unknown Minecraft item-component fields are tolerated; item IDs,
counts, memory keys, and block positions are validated before storage. The
receiver accepts bodies up to 4 MiB, 5,000 containers, and 100,000 item-stack
slots.
