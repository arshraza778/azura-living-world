# Azura Phases 6–9 — Implementation and verification

Source baseline: `Azura_Phase5_1_UPDATED(1).zip` (Phase 5.1). Existing framework, save key, game engine, dependencies, and world data were retained.

## Working Rules — source of truth

### Definition of done

| Phase | Definition of done | Verification evidence |
|---|---|---|
| 6 — Housing & Village Life | Player has a persistent home; can enter it, use a bed, store/retrieve items, and rename the home. Existing village NPC and inn interactions remain in place. | Runtime checks exercise the actual TypeScript state functions, generated home scene triggers, and localStorage serialization. Browser-level door/canvas test still recommended. |
| 7 — Trading & Marketplace | Player can list, inspect, buy, and cancel listings. Items are escrowed; buying updates buyer inventory/gold and seller proceeds. Online listings are shared and persisted server-side. | Local social-state runtime checks plus two-client WebSocket test of listing, purchase, and seller/buyer balances. |
| 8 — Guilds & Social Gameplay | Player can create/join/leave a guild, inspect roster, post messages, and retain guild data. Online guild membership and messages are shared and persisted. | Local social-state runtime checks plus two-client WebSocket guild creation, join, message, and JSON persistence test. |
| 9 — Multiplayer & Shared Persistent World | Two authenticated clients can connect to one service, see each other in the same scene, receive server-validated movement, chat, invite/accept parties, and use shared persistent market/guild state. Player positions/accounts persist on the server. | Node integration test launches the real service and tests two accounts, WebSocket presence, movement rejection/correction, scene transitions, chat, party invites, market settlement, guilds, and persisted data. |

### Carried constraints

- Stack: React 19, TypeScript, TanStack Start, Vite, custom canvas engine; retain the existing package/dependency set and Bun lockfile.
- Existing code to preserve: Phases 1–5.1, `azura.save.v1`, all game scenes, character progression, combat, inventory, equipment, crafting, fishing, farming, NPCs, missions, maps, and world generation.
- Zero budget: no paid services, APIs, or database; Phase 9 service uses Node.js built-ins only and JSON files for local/LAN testing.
- Offline: single-player remains local and works without the multiplayer service. Offline marketplace/guild activity is browser-local and does not cross devices.
- Language: the supplied project is English-only and contains no localization framework or second-language resources. Preserve English; do not invent translations.
- Naming/file structure: retain `src/game/{core,data,engine,network,render,state,world}`, `src/components/game`, and existing naming conventions. Add focused modules only.
- Style: small targeted changes; no broad rewrites, new paid dependencies, or replacement app.
- Multiplayer boundary: the Node service is separate from the current Cloudflare Worker deployment target. Public hosting requires a Node 22 host and HTTPS/WSS reverse proxy/configuration.

## Phase 6 — Housing & Village Life

**PLAN**
- `src/game/core/types.ts`: add the home scene and home-storage interaction action.
- `src/game/data/places.ts`: make the existing Eldergrove cottage the player's starter home.
- `src/game/world/interiors.ts`, `src/game/world/scenes.ts`: add a connected home interior, storage point, and bed interaction.
- `src/game/state/store.ts`: add backward-compatible housing save data.
- `src/game/state/social.ts`: implement storage, retrieval, and home renaming.
- `src/game/engine/engine.ts`: connect the home chest interaction to the existing panel system.
- `src/components/game/Game.tsx`: add the home panel.
- `src/test/social.test.ts`: add housing regression tests.

**BUILD**
- Added a starter-owned Eldergrove cottage using the existing building/scene transition system.
- Added persistent home name and item storage.
- Added storage/retrieval actions; equipped items cannot be moved into storage.
- Added a bed/rest interaction using the existing recovery system.
- Existing local save migration supplies safe defaults for old Phase 5.1 saves.

**VERIFY**
- Transpiled changed TypeScript/TSX files with the installed TypeScript compiler API: syntax checks passed.
- Executed the actual transpiled game state/world modules in a Node harness: home scene and overworld entrance load, storage and retrieval update inventory, equipped gear is rejected, rename persists, bed and storage triggers exist, and housing state survives a `azura.save.v1` save/reload round-trip.
- Full browser build was not available in this environment because project npm dependencies are not installed and the registry install timed out; offline install confirmed the package cache is incomplete.

**FIX**
- Prevented equipped items from being stored, which would otherwise leave an equipped slot pointing at an item no longer in the backpack.

**WORKING RULES DIFF**
- Add: home storage must reject currently equipped gear; home ownership, name, and storage remain part of the existing versioned local save.

**CHECKPOINT**
- Done: starter cottage, home scene, bed, rename, and storage actions implemented.
- Changed: game types, place data, scene builders, engine interaction, save schema, social state, Character/Game UI, housing tests.
- Next: Phase 7 marketplace; preserve home state and existing inventory semantics.

## Phase 7 — Player Trading & Marketplace

**PLAN**
- `src/game/state/store.ts`: persist marketplace listings and maintain backward-compatible defaults.
- `src/game/state/social.ts`: implement listing escrow, buying, and cancellation for offline/local mode.
- `src/components/game/Game.tsx`: add marketplace UI and merchant access.
- `server/multiplayer.mjs`, `src/game/network/multiplayer.ts`: implement shared listings and server-side transaction settlement for connected clients.
- `tests/multiplayer.test.mjs`, `src/test/social.test.ts`: cover transaction paths.

**BUILD**
- Added vendor listings and player-created listings.
- Listing removes the item from inventory; cancellation returns remaining quantity; self-purchase is rejected.
- Offline market state is saved in the browser.
- Online market state is shared by the multiplayer service. Server validates listing ownership/quantity/price, deducts buyer gold, adds the item to buyer inventory, credits the seller, updates remaining listing quantity, and persists the transaction.
- Connected character inventory/gold/equipment snapshots are mirrored from the current game save so items earned through existing gameplay can enter the market. This is a prototype trust boundary, not anti-cheat protection.

**VERIFY**
- Runtime harness passed local listing escrow, self-purchase rejection, cancellation, vendor purchase, and save persistence.
- Real two-client service test passed player listing, purchase by a second account, buyer inventory/gold update, seller proceeds, and persisted server economy/listing quantity.
- TypeScript/TSX syntax transpilation and a targeted strict TypeScript check of all `src/game` modules plus the changed game UI passed using temporary ambient stubs for the unavailable external React/Vite/Vitest packages. Full project typecheck/build remains unavailable for the dependency-cache reason above.

**FIX**
- Server validates item IDs and prevents listing equipped gear. Client saves mirror the current inventory/gold snapshot while connected so crafting, gathering, loot, and quest rewards can be traded.

**WORKING RULES DIFF**
- Add: connected market transactions must be settled against the server's persisted account economy; offline listings remain explicitly local. Client economy snapshots are accepted only as a prototype bridge and must be replaced by server-side grants before public release.

**CHECKPOINT**
- Done: local and shared marketplace listing/buy/cancel flows implemented.
- Changed: save schema, social actions, marketplace UI, network protocol, Node service, multiplayer tests.
- Next: Phase 8 guild membership and social systems.

## Phase 8 — Guilds & Social Gameplay

**PLAN**
- `src/game/state/store.ts`: persist local guild membership/roster/messages for offline mode.
- `src/game/state/social.ts`: implement local create/join/leave/message actions.
- `src/components/game/Game.tsx`: add guild hall panel and roster/notice board.
- `server/multiplayer.mjs`, `src/game/network/multiplayer.ts`: implement shared guild state for online accounts.
- `tests/multiplayer.test.mjs`, `src/test/social.test.ts`: verify membership and messages.

**BUILD**
- Offline: player can found a guild for 100 gold, join one of the authored frontier guilds, leave, inspect members, and post a notice.
- Online: server supports guild creation, join, leave, leader transfer when a leader leaves, guild roster, and persisted guild messages.
- One guild membership per player; guilds have a 30-member cap and messages are capped to the latest 50.

**VERIFY**
- Runtime harness passed local create/join/leave/message behavior and save persistence.
- Two-client server integration test passed guild creation, second-player join, shared roster, shared message, and persisted membership/message data.
- TypeScript/TSX syntax transpilation and targeted strict typecheck of the affected game modules/UI passed using temporary ambient stubs. Full app build/typecheck not run because dependencies could not be installed in the execution environment.

**FIX**
- Guild leave promotes an existing member if the leader leaves; an empty guild is removed. Online guild actions use server state rather than pretending local browser data is shared.

**WORKING RULES DIFF**
- Add: online guild membership/messages are server-owned; offline guild state is browser-local and is not silently merged into an online guild.

**CHECKPOINT**
- Done: offline and shared guild create/join/leave/roster/message flows implemented.
- Changed: local guild save/actions, guild UI, network message protocol, server persistence, tests.
- Next: Phase 9 authenticated multiplayer and shared world.

## Phase 9 — Multiplayer & Shared Persistent World

**PLAN**
- `server/multiplayer.mjs`: add a dependency-free Node 22 HTTP/WebSocket service, accounts, persisted player positions, presence, movement validation, chat, parties, market and guild synchronization.
- `src/game/network/multiplayer.ts`: add authentication, WebSocket client, presence/chat/party/market/guild state and local character synchronization.
- `src/game/engine/engine.ts`: publish player position, render remote players, and apply server position corrections/transitions.
- `src/components/game/Game.tsx`: add sign-in/register and multiplayer UI.
- `package.json`, `MULTIPLAYER.md`, `README.md`, `.env.example`, `.gitignore`: add run/configuration instructions and ignore private local data.
- `tests/multiplayer.test.mjs`: real integration test with two accounts and two WebSocket clients.

**BUILD**
- Added account registration/login using Node `scrypt` password hashes and random session tokens.
- Added WebSocket presence and other-player rendering in the existing canvas scene.
- Server validates scene transition allowlists and movement speed; invalid movement is corrected by the server.
- Added same-area chat, party creation, invitations, acceptance, leave, and a five-member party cap.
- Shared market transactions and guild state/messages use server persistence.
- Player positions, appearance, account hashes, inventory/gold snapshots, market listings, and guilds persist in JSON files using atomic file replacement.
- Added `npm run multiplayer`; `npm run test:all` runs the existing Vitest suite plus the standalone multiplayer integration test.; no runtime dependencies were added.

**VERIFY**
- `node --check server/multiplayer.mjs`: passed.
- `node --check tests/multiplayer.test.mjs`: passed.
- `node --test tests/multiplayer.test.mjs`: **1 integration test passed**. It launches the real service and checks registration, duplicate registration rejection, bad-password rejection, two authenticated clients, presence, valid movement, rejected teleport/correction, allowed scene transition spawn, chat, party invite/accept, shared listing, buyer/seller settlement, guild create/join/message, and persisted account/world JSON.
- TypeScript compiler API transpilation: all changed TypeScript/TSX files passed syntax transpilation. Targeted strict TypeScript checking of all game modules and the changed game UI also passed with temporary ambient stubs for unavailable external packages.
- Full browser rendering/build and strict TypeScript typecheck remain unverified because dependencies were absent; `npm install` timed out and `npm install --offline` failed with `ENOTCACHED`.

**FIX**
- Fixed WebSocket test listener ordering (presence can arrive while the second client is completing its welcome handshake).
- Fixed character sync handler initialization ordering.
- Added position correction for invalid movement and fixed spawn positions for allowed scene transitions.
- Fixed stale socket close callbacks from overwriting a newer connection state.

**WORKING RULES DIFF**
- Add: the multiplayer service is a separate Node 22 process; the current Cloudflare Worker target does not host it. Local single-player remains usable offline. Public deployment requires TLS/WSS, rate limiting, monitoring, backups, and a production database/security review.
- Add: current Phase 9 shares player presence/positions, chat, parties, marketplace, and guilds; monster AI/health/loot, combat resolution, character level/attributes/quests, and housing are not yet server-authoritative or synchronized across clients.

**CHECKPOINT**
- Done: authenticated shared-world social/economy prototype implemented and Node integration-tested.
- Changed: new Node multiplayer service/client, engine integration, login UI, run docs, package script, and tests.
- Next: install project dependencies and run full `npm test`, strict typecheck, production build, then expand server authority to combat, monsters, character progression, and housing before public alpha.

## Final checklist

| Phase | Implementation | Verification | Result |
|---|---|---|---|
| 6 — Housing & Village Life | Implemented | Actual state/world runtime harness + TS syntax transpilation | PASS (browser smoke test pending) |
| 7 — Trading & Marketplace | Implemented offline and server-shared modes | Local runtime harness + two-client transaction test | PASS (browser smoke test pending) |
| 8 — Guilds & Social Gameplay | Implemented offline and server-shared modes | Local runtime harness + two-client guild test | PASS (browser smoke test pending) |
| 9 — Multiplayer & Shared Persistent World | Implemented Node 22 prototype service/client | Real two-client Node integration test | PASS (full browser build pending) |

## Known limitations / next steps

1. The multiplayer service must be run separately with Node 22: `npm run multiplayer`; `npm run test:all` runs the existing Vitest suite plus the standalone multiplayer integration test.. The existing Cloudflare Worker deployment does not host this service.
2. For two devices on a LAN, set `VITE_AZURA_SERVER_URL` to the host machine's LAN address before running/building the frontend.
3. Sessions are held in memory and users sign in again after a server restart. Account hashes and world/economy/guild data persist in JSON files.
4. Connected clients mirror their local inventory/gold/equipment snapshots to the server. This is convenient for the prototype but is not cheat-resistant; all item grants, rewards, and economy changes must move to server-side actions before public testing.
5. Monster positions/health, combat, boss phases, drops, player level/XP/attributes/mastery, quests, housing and world events are still client-local. Players can see and chat with one another, but are not yet fighting the same server-owned monsters.
6. JSON-file persistence is suitable for local/LAN proof-of-concept only. Production needs a transactional database, backups, session revocation, account recovery, rate limits, origin allowlists, moderation/reporting, observability, and load/security testing.
7. The project remains English-only because the supplied baseline has no localization resources. Offline single-player remains available; shared online features require the Node service.
8. Full `npm test`, `tsc --noEmit`, and `npm run build` could not be executed in this environment because project dependencies were not installed; npm registry installation timed out and offline cache was incomplete. TypeScript/TSX syntax transpilation and the standalone multiplayer integration test passed.
