# Azura Phase 5.1 — implementation and validation

Implemented directly in the supplied Phase 5 project. No replacement app, separate demo, save-key change, or dependency changes.

## Files changed

Modified:
- `src/game/state/store.ts`: growth persistence/migration, atomic level reward bookkeeping, manual allocation actions, derived stats, potion scaling, activity mastery hooks and repeat-watering fix.
- `src/game/engine/engine.ts`: real movement/combat/dodge/sprint/hunger/gathering calculations, kill and discovery mastery, persisted resource regrowth, and gathering timer cleanup.
- `src/components/game/Game.tsx`: Attributes and Masteries sections inside the existing Character screen. The existing Character component is exported for testing; it is not duplicated.
- `src/game/render/draw.ts`: fixed a pre-existing rune renderer referencing undefined `px`/`py` instead of its actual `x`/`y` coordinates, which could crash dungeon rendering.

Added:
- `src/game/state/growth.ts`: typed growth schema, bounded tuning curves, six attribute definitions, seven mastery definitions, migration and tooltip benefit calculations.
- `src/test/growth.test.ts`: 24 progression/gameplay/migration/regression tests.
- `src/test/growth-ui.test.tsx`: real Character component allocation/control test.
- This status report and `phase5_1_validation/` test/build/typecheck/browser evidence.

All other original project files, including existing configuration, dependencies, routing, maps, item/monster data, dungeon/world generation, and prior phase reports, are retained unchanged.

## Implemented features

### Level rewards and allocation
- Exactly 3 unspent points per gained level, including multiple levels from one XP award.
- Persisted rewarded-level watermark; level, XP, point balance and watermark saved together before the level-up notification. Reloading does not re-award points.
- No automatic allocation. Six independent plus controls with available/pending totals, descriptions, current preview benefits and next-point benefits.
- Confirmation commits allocations once; cancel clears pending choices without spending. Overspending is rejected both in UI and store.
- Pending choices persist across refresh but do not affect gameplay until confirmed.

### Actual attribute effects
- Strength multiplies physical attack damage, including a measurable effect for the first point.
- Vitality increases maximum health and reduces incoming monster damage through bounded resistance. Equipment defence still applies.
- Agility increases movement speed, shortens attack interval and lowers dodge stamina cost.
- Endurance increases maximum stamina and reduces attack, sprint and dodge stamina costs.
- Intelligence provides a reusable magical-damage calculation for future spells. It also improves healing-potion potency now, so it has an existing gameplay use rather than being display-only.
- Survival reduces hunger depletion and gathering duration.
- Equipment equip/unequip/upgrade and character level changes recalculate capacities without discarding allocated attribute effects. Allocating capacity does not give free current health/stamina.
- Carry capacity is not added: the supplied inventory has no weight/capacity system.

### Bounded balancing
`BALANCE` centralizes attribute caps, half-saturation, level reward and mastery XP curve values. The curve is `points / (25 + points)`.
Attribute-only asymptotic limits (equipment and existing character-level scaling remain separate): physical damage +80%, maximum health +100%, maximum stamina +100%, movement +20%, resistance 35%, general stamina savings 35%, hunger savings 50%, attack-interval reduction 25%, dodge-only cost reduction 25%, gathering-time reduction 45%, magical/potion potency +100%.
Bonuses approach these limits rather than reaching them at finite point totals. Food, stamina, equipment, enemy damage and traps remain relevant.

### Mastery tracks
Every track has independent level and within-level XP, displayed in Character and saved. All begin at level 1 / 0 XP. Threshold is 40 + 25 per additional mastery level; excess XP carries forward.
- Combat: successful kills in the existing combat path; no XP from misses or repeatedly attacking corpses. Award 4–25 based on authored enemy XP, with a persisted 3-second XP throttle.
- Fishing: a successful catch with a fishing rod gives 8 XP; a persisted 1.8-second minimum interval prevents rapid repeated rewards. The existing near-water casting/bite UI remains in use.
- Gathering: successful resource collection gives 6 XP, with a persisted 450ms XP throttle. Normal resource regrowth is also persisted, preventing refresh from instantly regrowing harvested nodes.
- Crafting: 8 XP only after recipe completion and ingredient consumption; no XP for missing materials or duplicate pending requests. 700ms XP throttle.
- Farming: 10 XP only for a mature harvest; planting, watering, early harvests and empty plots cannot be spammed for XP. Repeated watering no longer repeatedly backdates growth.
- Exploration: 15 XP for a new POI and 20 for a new region, guarded by the existing saved discovered lists. Revisits and refreshes do not award again.
- Magic: independent saved level/XP and shared award API are ready for future successful spell actions. There is intentionally no spell system or passive Magic XP award.
- Per-award XP is capped at 25. Existing recipe ingredients, casting wait, crop maturation, resource tools/regrowth and monster combat remain activity gates.

### Backward-compatible persistence
- Retains `azura.save.v1` and existing fields, inventory, equipment, upgrades, missions, crops, appearance, discoveries, chests, gold and fish count.
- Adds a versioned `growth` object. Missing/partial growth data receives typed defaults; malformed growth counters and over-budget pending choices are sanitized.
- Existing characters receive a one-time manual-allocation budget of `3 × (level − 1)` for levels already earned. Previously discovered locations do not award retroactive mastery XP.
- Saves a one-time untouched pre-migration snapshot under `azura.save.v1.phase5.backup` where browser storage permits. Loading the migrated save is idempotent.
- Growth, pending choices, mastery levels/XP, throttles and resource-ready timestamps persist together.

## Tests performed

Environment: Node 22.16.0, npm-resolved existing dependency ranges, Chromium Headless Shell. Dependency declarations and the supplied Bun lockfile were not altered.

- `npm test`: **26 tests passed**, 3 test files, including the original routing test, 24 growth/gameplay/regression tests and 1 real Character component UI test.
- `npx tsc --noEmit`: **passed**, no diagnostics.
- `npm run build`: **passed** through client, SSR and Nitro/Cloudflare output, using the existing build configuration.
- Local Chromium: game booted and rendered; no page runtime errors were observed.
- Local Chromium with a Phase 5-shaped level-4 save: migrated to 9 points while retaining level/XP/gold, displayed all six attributes and seven mastery progress bars, cancelled a pending choice, staged six choices, refreshed with them pending, confirmed one point per attribute, and refreshed again. Confirmed attributes persisted and the remaining balance stayed at 3, with no duplicate reward. Level remained 4 and XP remained 37.
- Existing Inventory, Crafting, Community Farm, Mission Log and World Map panels opened successfully in Chromium; no page runtime errors were observed.

### Requested verification checklist
1. Exactly 3 points on level-up: automated pass, also multi-level awards.
2. No duplicate points on refresh: automated and Chromium pass.
3. Manual allocation: automated store/UI and Chromium pass.
4. Cancel pending choices: automated and Chromium pass.
5. Confirm choices: automated and Chromium pass.
6. Gameplay effects: automated real engine action/update harnesses and stat calculations pass for all six attributes; no replacement gameplay implementations used.
7. Combat mastery through kills: automated actual engine attack path pass.
8. Fishing mastery through catches: automated catch action pass, including missing rod and refresh throttle.
9. Gathering mastery through collection: automated actual engine interaction/timer and store paths pass.
10. Crafting mastery through completion: automated timed recipe action pass.
11. Farming mastery through mature harvest: automated crop lifecycle pass, including anti-repeat checks.
12. Exploration mastery: automated actual POI and region-discovery paths pass, including reload/revisit checks.
13. Magic foundation saved: automated independent track persistence pass; no spells claimed.
14. Progression persists on refresh: automated all-track roundtrip and Chromium pending/confirmed allocation refresh pass.
15. Prior features: original routing test, item use, buying/selling, resting, equipment upgrades, mission turn-in single-use checks and browser panel smoke tests pass. This is not an exhaustive replay of every Phase 1–5 quest, scene, boss, secret or visual state.

Machine-readable browser checks and captured test/build/typecheck logs are in `phase5_1_validation/`.

## Remaining limitations / known issues

- No known Phase 5.1 failures in the exercised paths. Long-session balance, every dungeon encounter/quest, mobile/touch behavior and all browsers have not been exhaustively playtested.
- Magic gameplay remains intentionally future work. Intelligence currently affects healing potions and the prepared magical-damage calculation; no playable spells were added.
- Saves remain browser-local and require usable localStorage, as in Phase 5. This is not a server-authoritative or anti-cheat system; direct developer-console save editing, cross-tab simultaneous play and clock tampering are outside the guarantees. The level watermark protects normal level progression and refresh, not arbitrary duplicated external XP grant calls.
- Resource refresh protection was added; existing monster respawn/world simulation remains the original in-memory engine behavior. Combat XP throttles limit rapid rewards but do not replace a server-side exploit prevention system.
- The dependency installation reported **16 audit findings (14 moderate, 2 high)** in the existing dependency graph. No potentially breaking dependency upgrades were made for this gameplay update; review those separately before deployment.
- Existing build emits non-fatal plugin/chunk/code-splitting warnings. Build completes successfully.

## Running

Use Node 22.12 or newer (tested on 22.16.0):

```sh
npm install
npm test
npx tsc --noEmit
npm run build
npm run dev
```

The delivered archive is the updated source project, not node_modules or prebuilt deployment output. The original Bun configuration and lockfile remain available for the project's existing workflow.
