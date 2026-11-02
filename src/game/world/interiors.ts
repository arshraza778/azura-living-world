import { hash2 } from "../core/noise";
import type { Decor, MonsterSpawn, NPC, Scene, SceneId, Trigger } from "../core/types";
import { T } from "../data/tiles";
import { makeNpc } from "./npc";

/**
 * ASCII-authored interiors. Legend:
 *  # wall   . floor   , carpet/ritual floor   h hidden passage (looks like wall)
 *  F wall torch   S shelf   T table   C counter   B mission board   K banner   P plant
 *  D door (exit)   < stairs up / exit   > stairs down   $ chest   X spike trap
 *  m monster spawn   W boss spawn   A sealed altar   @ player spawn   R receptionist
 */
const GUILD = [
  "######################",
  "#S.S.K....B.....K.S.S#",
  "#....................#",
  "#..T.......,,....T...#",
  "#.........,,,,.......#",
  "#..R......,,,,.......#",
  "#CCCCCC...,,,,...T...#",
  "#.........,,,,.......#",
  "#P........,,,,......P#",
  "#.........,,,,.......#",
  "#.........,,,,.......#",
  "#.........,@,,.......#",
  "##########DD##########",
];

const DUNGEON1 = [
  "####################################",
  "#<@....#........F.......#.........$#",
  "#......#................#..........#",
  "#..m...#....m.....m.....h....m.....#",
  "#......######..##########..........#",
  "#..........X.....X.......###########",
  "#F.....................X...........#",
  "#####..#####.....#####.........m...#",
  "#$..#..#...#..m..#...#.............#",
  "#...h..#.m.#.....#.$.#....######...#",
  "#####..##.##.....##.##....#....#...#",
  "#.............X...........#.>..#...#",
  "#..m.........XXX..........#....#.m.#",
  "#.............X...........##..##...#",
  "#F................m.............F..#",
  "####################################",
];

const DUNGEON2 = [
  "##############################",
  "#<@...#..........F...........#",
  "#.....#......................#",
  "#..m..#####..########..####..#",
  "#..........X.........X.......#",
  "######..##################..##",
  "#F.........................F.#",
  "#....##################......#",
  "#....#,,,,,,,A,,,,,,,,#...m..#",
  "#....#,,,,,,,,,,,,,,,,#......#",
  "#....#,,,,,,,W,,,,,,,,#......#",
  "#..$.#,,,,,,,,,,,,,,,,h......#",
  "#..m.#########,,#######..$...#",
  "#............................#",
  "#F.......m.........m.........#",
  "##############################",
];

function find(map: string[], ch: string): { x: number; y: number } {
  for (let y = 0; y < map.length; y++) {
    const x = map[y].indexOf(ch);
    if (x >= 0) return { x, y };
  }
  return { x: 1, y: 1 };
}

interface BuildOpts {
  id: SceneId;
  name: string;
  map: string[];
  floor: number;
  wall: number;
  dark: number;
  exits: Partial<Record<string, { label: string; to: SceneId; x: number; y: number }>>;
  npcs?: NPC[];
}

function build(o: BuildOpts): Scene {
  const h = o.map.length;
  const w = Math.max(...o.map.map((r) => r.length));
  const ground = new Uint8Array(w * h);
  const solid = new Uint8Array(w * h);
  const decor: Decor[] = [];
  const triggers: Trigger[] = [];
  const spawns: MonsterSpawn[] = [];
  const traps: Scene["traps"] = [];
  const lights: Scene["lights"] = [];
  const npcs: NPC[] = o.npcs ?? [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = o.map[y][x] ?? "#";
      const i = y * w + x;
      const put = (kind: string, isSolid: boolean) => {
        decor.push({ kind, x: x + 0.5, y: y + 0.95, v: hash2(x, y, 2) });
        if (isSolid) solid[i] = 1;
      };
      ground[i] = o.floor;
      switch (c) {
        case "#": ground[i] = o.wall; solid[i] = 1; break;
        case "h": ground[i] = o.wall; break; // hidden passage
        case "F": ground[i] = o.wall; solid[i] = 1; put("walltorch", false); lights.push({ x: x + 0.5, y: y + 1, r: 5 }); break;
        case ",": ground[i] = o.id === "guild" ? T.CARPET : T.RITUAL; break;
        case "S": put("shelf", true); break;
        case "T": put("table", true); break;
        case "C": put("counter", true); break;
        case "K": put("banner", true); break;
        case "P": put("plant", true); break;
        case "B":
          put("board", true);
          triggers.push({ x: x - 1, y: y, w: 3, h: 2, label: "Read the Mission Board", action: { type: "board" } });
          break;
        case "$":
          put("chest", true);
          triggers.push({ x: x - 1, y: y - 1, w: 3, h: 3, label: "Open chest", action: { type: "chest", id: `${o.id}:${x},${y}`, loot: { azure_potion: 1, herb: 2 }, gold: 30 } });
          break;
        case "X": traps.push({ x, y }); break;
        case "m": spawns.push({ kind: "skeleton", x: x + 0.5, y: y + 0.5 }); break;
        case "W": spawns.push({ kind: "hollow_king", x: x + 0.5, y: y + 0.5 }); break;
        case "A":
          put("altar", true);
          lights.push({ x: x + 0.5, y: y + 0.5, r: 4 });
          triggers.push({ x: x - 1, y: y, w: 3, h: 2, label: "Examine the Sealed Altar", action: { type: "locked", title: "Sealed Altar", text: "An altar of black crystal pulses with dormant power. A Legendary reward will one day be claimed here — but the seal holds for now." } });
          break;
        case "<":
        case ">":
        case "D": {
          const ex = o.exits[c];
          if (c !== "D") put(c === "<" ? "stairsup" : "stairsdown", false);
          if (ex) triggers.push({ x: x - 0.5, y: y - 0.5, w: 2, h: 2, label: ex.label, action: { type: "scene", to: ex.to, x: ex.x, y: ex.y } });
          if (c === "D") ground[i] = T.WOOD;
          break;
        }
      }
    }
  const sp = find(o.map, "@");
  return { id: o.id, name: o.name, w, h, ground, solid, decor, npcs, spawns, triggers, traps, lights, dark: o.dark, spawn: { x: sp.x + 0.5, y: sp.y + 0.5 } };
}

export function buildGuild(): Scene {
  const r = find(GUILD, "R");
  const npcs = [
    makeNpc({ id: "lyra", name: "Lyra", title: "Guild Receptionist", x: r.x + 0.5, y: r.y + 0.7, role: "receptionist", look: { skin: "#f4d4b8", hair: "#e8b84a", cloak: "#2f5d8a", trim: "#f0d890" }, lines: ["Welcome to the Adventurers' Guild of Eldergrove! I'm Lyra.", "Missions are posted on the board — I can register them for you right here, and pay out when you return."] }),
    makeNpc({ id: "dorn", name: "Dorn", title: "Veteran Adventurer", x: 17.5, y: 4.4, role: "villager", look: { skin: "#c8946c", hair: "#5a3a1a", cloak: "#6a4a2a", trim: "#a0a0a0" }, lines: ["Hollowroot's first floor has a wall that isn't a wall. Look for cracks in the stone.", "And whatever you do — don't take the Blackwood lightly."] }),
    makeNpc({ id: "sela", name: "Sela", title: "Ranger", x: 4.5, y: 3.4, role: "villager", look: { skin: "#e8c0a0", hair: "#2a5a3a", cloak: "#3a6a3a", trim: "#d0e0a0" }, lines: ["There's a hunter's cabin hidden north-west of the Wilds. Nobody's lived there in years."] }),
  ];
  return build({ id: "guild", name: "Adventurers' Guild", map: GUILD, floor: T.WOOD, wall: T.WALL, dark: 0.12, exits: { D: { label: "Leave the Guild", to: "overworld", x: 106, y: 76.5 } }, npcs });
}

export function buildDungeon1(): Scene {
  const down = find(DUNGEON2, "@");
  return build({
    id: "dungeon1",
    name: "Hollowroot — First Depth",
    map: DUNGEON1,
    floor: T.STONEF,
    wall: T.WALL,
    dark: 0.86,
    exits: {
      "<": { label: "Climb back to the surface", to: "overworld", x: 38.5, y: 105.5 },
      ">": { label: "Descend to the Second Depth", to: "dungeon2", x: down.x + 0.5, y: down.y + 0.5 },
    },
  });
}

export function buildDungeon2(): Scene {
  const up = find(DUNGEON1, ">");
  return build({
    id: "dungeon2",
    name: "Hollowroot — Throne Depth",
    map: DUNGEON2,
    floor: T.STONEF,
    wall: T.WALL,
    dark: 0.9,
    exits: { "<": { label: "Climb to the First Depth", to: "dungeon1", x: up.x + 0.5, y: up.y + 1.5 } },
  });
}
