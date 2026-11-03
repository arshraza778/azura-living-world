# Azura multiplayer prototype service

Phase 9 adds a separate, dependency-free Node.js 22 service. The existing TanStack Start application remains the game client; the service provides accounts, presence, player movement validation, area chat, parties, shared marketplace settlement, and shared guild data.

## Local development

Terminal 1 (project root):

```sh
npm install
npm run multiplayer
```

The service listens on `http://localhost:8787`. It creates `data/accounts.json` and `data/world.json` on first use. Keep the `data/` directory private and back it up; it contains password hashes, player economy state, guilds, and world presence.

Terminal 2:

```sh
npm run dev
```

Open the game, choose **Multiplayer**, register an account, and sign in. A second browser profile or another computer can register a second account and connect to the same service.

To host the service on another machine, set the client environment variable before building/running the frontend:

```sh
VITE_AZURA_SERVER_URL=http://YOUR_SERVER_LAN_IP:8787 npm run dev
```

For a public deployment, use a Node 22 host and put the service behind HTTPS/WSS termination (for example, a reverse proxy). Set `AZURA_PORT` and `AZURA_DATA_DIR` as appropriate. The current Lovable Cloudflare Worker target does not itself run this standalone Node WebSocket service; the service must be hosted separately. No paid API or database is required for local/LAN testing.

## Prototype boundaries and security

- Usernames are 3–20 letters, numbers, or underscores; passwords are 8–128 characters and stored as scrypt hashes.
- WebSocket sessions are in-memory and expire after 30 days; after a server restart, players sign in again. Accounts and world data are persisted to JSON files using atomic file replacement.
- The server validates scene transitions, movement speed, item IDs/ownership, market prices, gold balances, guild membership, chat length, and party size. While connected, the existing game save mirrors inventory/gold/equipment snapshots to the service so normal gathering, crafting, loot, and quest rewards can enter the shared marketplace.
- The first connection seeds a server-side inventory and gold snapshot from the existing local character. The server then owns multiplayer market inventory/gold transactions. Character level, attributes/mastery, equipment progression, combat state, monster health/loot, quest progression, and housing still use the existing local save and are not yet server-authoritative. Connected economy snapshots are accepted from the client as a prototype bridge, so a modified client can cheat; replace this with server-side reward/grant actions before public testing.
- This is a LAN/closed-alpha multiplayer foundation, not production MMO security. Before public release, add TLS, rate limiting, account recovery, moderation/reporting, server-authoritative combat and progression, database backups, operational monitoring, and abuse testing. Do not expose the JSON data directory publicly.
