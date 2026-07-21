# QMSync inventory integration

The website receives QMSync v1 snapshots at:

```text
POST /api/inventory/sync
Authorization: Bearer <QMSYNC_API_KEY>
Content-Type: application/json
```

The receiver is intended for a trusted Minecraft server plugin or private
bridge. Do not bundle `QMSYNC_API_KEY` into a publicly distributed client mod;
forward client observations through the trusted server/bridge instead.

## One-time setup

1. Run `supabase/011_inventory.sql` in the Supabase SQL Editor after the
   existing schema and migrations.
2. Set `QMSYNC_SERVER_ID`, `QMSYNC_SERVER_NAME`, and `QMSYNC_API_KEY`
   locally and in Vercel.
3. Redeploy, then point the QMSync bridge at
   `https://YOUR-DOMAIN/api/inventory/sync`.

The player must already have `status = active` in the portal. On their first
authenticated sync, the receiver links the submitted Mojang UUID to the active
player with the same IGN. Later syncs use the UUID, so an IGN change does not
create another player.

## QMSync v1 payload

```json
{
  "protocolVersion": 1,
  "serverId": "koenigsburg",
  "capturedAt": "2026-07-21T18:30:00.000Z",
  "player": {
    "uuid": "8667ba71-b85a-4004-af54-457a9734eed7",
    "ign": "ExamplePlayer"
  },
  "source": {
    "id": "primary-pc",
    "label": "ExamplePlayer's memory bank"
  },
  "containers": [
    {
      "dimension": "minecraft:overworld",
      "position": { "x": 125, "y": 64, "z": -310 },
      "type": "minecraft:chest",
      "name": "Stone warehouse",
      "capturedAt": "2026-07-21T18:29:48.000Z",
      "private": false,
      "items": [
        {
          "id": "minecraft:cobblestone",
          "name": "Cobblestone",
          "count": 1728
        },
        {
          "id": "minecraft:oak_log",
          "name": "Oak Log",
          "count": 64
        }
      ]
    }
  ]
}
```

`capturedAt` may be an ISO timestamp or Unix milliseconds. A container may
omit its own timestamp and inherit the payload timestamp. Counts with the same
item ID and display name are combined before storage.

The receiver accepts at most 200 containers and 8,000 item rows in one request.
Larger snapshots should be sent in batches. Each container is merged by server,
dimension, and block coordinates. A snapshot only replaces the stored contents
when its capture time is newer, so retries and stale memory banks are safe.

Set `private: true` for any container that must not enter the ledger. Ender
Chests are always discarded even if the flag is missing. Empty `items` clears
a previously counted container when the empty observation is newer.

## Responses

A successful request returns:

```json
{
  "ok": true,
  "saved": 1,
  "stale": 0,
  "skippedPrivate": 0
}
```

`stale` counts containers ignored because Supabase already has a newer or
equal observation. A partial database failure returns HTTP 500 with `saved`,
`stale`, and `failed`; retrying the same batch is safe. Authentication and
validation failures use HTTP 4xx, while missing environment variables or the
inventory migration use HTTP 503.
