# Azura Living World

Project: Azura — The Living Fantasy World

Build an interactive, playable browser-based 2D fantasy MMORPG world prototype. This must be a game prototype, not a landing page or promotional website.

VISION
Azura is the first country in a much larger persistent fantasy MMORPG. The atmosphere is anime-inspired fantasy with hand-painted environments, medieval village architecture, mysterious forests, dangerous monsters, ancient ruins, dungeons, and unexplored territories. Focus this first prototype on geography and exploration.

VISUAL DIRECTION
Use a beautiful 2D top-down or 2D isometric perspective. Aim for polished indie fantasy-adventure presentation: anime-inspired hand-painted environments, rich green forests, rivers, waterfalls, medieval architecture, detailed vegetation, atmospheric lighting, shadows, mist, magical effects, smooth animation, and readable visual hierarchy. Avoid generic dashboards, corporate UI, cartoonish placeholder graphics, and overly simplistic maps. Use original temporary art/assets if final art is unavailable; do not imitate copyrighted game assets.

COUNTRY: AZURA
Create one interconnected country with these six initial regions:
1. Eldergrove — Main Village: primary starting settlement; medieval houses, shops/trading area, inn, training ground, Adventurers' Guild, NPCs and village inhabitants, roads leading into surrounding forests.
2. Verdant Wilds — Great Forest: dense trees and vegetation, forest paths, streams, small caves, beginner/intermediate monsters, gathering and hunting locations, hidden paths and abandoned structures.
3. Thornveil Jungle: dense tropical vegetation, mysterious/poisonous plants, dangerous creatures, rare materials and potion ingredients, hidden clearings and unexplored paths.
4. Hollowroot Dungeon: ancient dungeon entrance hidden within the forest; multiple levels, monsters, traps, treasure rooms, hidden chambers, powerful boss encounter; architecture should support a future Legendary reward encounter.
5. Forgotten Reach: ancient ruins, abandoned civilisation, mysterious structures and inscriptions, rare discoveries, hidden exploration opportunities.
6. Blackwood Expanse: extremely dangerous mysterious forest, powerful monsters, rare discoveries, possible world-boss location, potential hidden Mythical item locations.

WORLD MAP
Create a large, attractive interactive map of Azura showing all six regions, Eldergrove prominently, connecting paths, forests, rivers, lakes, caves, ruins, landmarks, and distinct safe/unexplored/dangerous visual states. Support zoom and pan. Clicking a region should show its description and danger level. Discovered and undiscovered locations should look different. Regions must form one continuous geographical environment, not disconnected level cards. Country borders and river layout are not finalised: keep terrain, boundaries, and water layout easy to modify in data/configuration.

PLAYER EXPLORATION
Implement a playable character with WASD and arrow-key movement, exploration of the village and nearby environment, forest paths, designated exploration areas, NPC/location interactions, and a visible current-location indicator on the map. Use a temporary original fantasy character sprite if necessary. Include basic collision detection and transitions between connected areas without making them feel like separate disconnected games.

ADVENTURERS' GUILD
Build an interactive guild building in Eldergrove, including an interior, receptionist NPC, mission board, sample monster-hunting missions, exploration missions, dungeon missions, and a functional mission acceptance interface. Use local prototype data.

GAME UI
Create a polished in-game interface with player health, stamina, hunger, level, inventory access, character information, world map, quest/mission log, and contextual interaction prompts. Keep the UI stylistically consistent with the fantasy world. Buttons and controls must work; do not create fake interactions.

TECHNICAL IMPLEMENTATION
Use a suitable browser-based 2D game framework such as Phaser if appropriate, integrated with the Lovable React application. Use clean modular TypeScript code. Separate world/region data, player state, gameplay logic, and UI components. Implement responsive layout, basic collision, region selection, NPC interactions, and local persistence of basic player progress. Keep geography and region definitions data-driven and easy to change. If Phaser is unsuitable, choose a lightweight browser 2D approach and explain the tradeoff in your summary.

DEVELOPMENT BOUNDARIES
This is the first geography and exploration prototype. Do not attempt the entire MMORPG yet. Do not implement global multiplayer, the complete economy, full PvP, all monster systems, or the complete item-rarity system. Build a sound world foundation so later systems can be added without rewriting the project.

FINAL OBJECTIVE
Deliver a working, visually polished browser prototype in which a player can spawn in Eldergrove, walk around the village, visit the Adventurers' Guild, enter the surrounding forest, explore connected areas, and inspect Azura's interactive world map. Prioritise world atmosphere, geography, exploration, and a solid technical foundation over many incomplete features.

Build the playable core first. Ensure the preview launches and verify the main interactions before considering the first milestone complete.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cd7c8c3c-7597-4890-adc7-0ac07d8160f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
