# Azura Phase 5 — Implementation & Validation

## Implemented on the Phase 4 project

- Added deterministic resource nodes to the existing overworld: hardwood in Verdant Wilds, stone, Thornveil iron/copper deposits, herbs, mushrooms and rare herbs. Nodes have interaction prompts, tool gates, a short gathering delay and timed respawn.
- Added shared-inventory resource items and gathering tools (axe, pickaxe, gathering knife, fishing rod and watering can). Existing Phase 4 saves receive a one-time Phase 5 starter-tool/seed migration.
- Added a recipe registry and a crafting panel. Recipes show ingredients, current/required counts, result and crafting time; crafting consumes materials after a timed action and writes results to the existing inventory. Recipe discovery is persisted; Ironbark Sword recipe unlocks on Hollowroot discovery.
- Added Brann the blacksmith and Sylvi the alchemist as interactive Eldergrove NPCs. Their dialogue opens the shared crafting interface.
- Added fishing with a cast/wait/bite/reel sequence, requiring the fishing rod and proximity to water in the overworld. Fish go into the existing inventory.
- Added six persistent farm plots, seed planting, watering and time-based crop growth/harvest. Crop progress uses timestamps so it continues across refreshes.
- Added cooked fish and food/potion recipes that connect to the existing consumable/hunger system.
- Added K (crafting) and V (farm) shortcuts and HUD entry points.

## Validation

- The modified TypeScript/TSX files passed TypeScript `transpileModule` syntax diagnostics.
- Full `tsc`, Vitest, Vite production build and browser gameplay testing could not be completed: dependencies are not installed, and `npm install --ignore-scripts --no-audit --no-fund` timed out in this environment. No claim is made that the full interactive loop has been browser-tested.
- ZIP archive integrity was checked after packaging.

## Local verification

```bash
npm install
npm test
npm run build
npm run dev
```

Then test gathering in Verdant/Thornveil, craft at Brann/Sylvi, fish beside overworld water, plant/water/harvest in the farm, consume food, and refresh to verify persistence.

## Scope

This remains a local single-player prototype. No server persistence, multiplayer economy or global item ownership was added.
