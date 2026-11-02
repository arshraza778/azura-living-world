# Azura Phase 3 — implementation and QA status

## Implemented
- Added three original monster kinds to the existing monster registry: Goblin Scout, Forest Boar, and Ancient Treant. Existing Moss Slime and Thicket Wolf remain in place.
- Added distinct canvas-drawn silhouettes for goblins, charging-style boars, and treants; existing hurt flashes, health bars, respawns, pursuit/aggro and collision-aware movement continue to use the existing engine.
- Added monster-specific drops (Goblin Scout Token, Forest Boar Tusk, Ancient Heartwood Core) plus a chance of an apple or healing potion.
- Loot appears as a floating ground pickup in the scene where the monster was defeated. E collects nearby drops into the existing inventory; collected items are persisted by the existing local save system.
- Mouse click or F attacks. Space performs a stamina-costing dodge with a short invulnerability window. WASD/arrows, Shift sprint and E interaction remain supported.
- Added an item-collection Guild mission for three Goblin Scout Tokens, reduced the beginner slime mission to three kills, and the wolf mission to two kills. Existing mission readiness and reward/turn-in systems are reused.
- Added a short defeat overlay and reincarnation in Eldergrove. Level, XP and inventory are retained; 10% of gold is lost, health is restored to half, stamina is restored, and hunger is raised to at least 40.
- No multiplayer, trading, PvP or rarity-system changes were added.

## Validation performed
- Inspected and edited the existing source; no rebuild or architecture replacement.
- TypeScript compiler check on the modified game modules: no reported source errors beyond the environment's missing `react` package/type declarations.
- Attempted `npm install --ignore-scripts --no-audit --no-fund`, but dependency installation timed out in this environment.

## Not verified here
- Production Vite build, Vitest suite, browser console, and the complete interactive gameplay loop could not be run because dependencies were not available. The downloaded project should be tested locally with `npm install`, `npm run test`, and `npm run build` before deployment.
