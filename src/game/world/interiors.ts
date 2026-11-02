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

const INN = [
  "##################",
  "#S.F..S....F..N.N#",
  "#.............N.N#",
  "#..T....T........#",
  "#................#",
  "#CCCC.....T....P.#",
  "#.I..............#",
  "#P.......@.......#",
  "#######DD#########",
];

const COTTAGE = [
  "##########",
  "#S.F..N.Q#",
  "#........#",
  "#..T.....#",
  "#P...@..P#",
  "####DD####",
];

const DUNGEON1 = [
  "####################################",
  "#<@....#........F.......#.........$#",
  "#......#................#..........#",
  "#..m...#....m.....m.....h....m.....#",
  "#......######..##########..........#",
  "#..........X.....X.......###########",
  "#F.....................X..L........#",
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
  "#....#,,,,,,,G,,,,,,,,#......#",
  "#..$.#,,,,,,,,,,,,,,,,h......#",
  "#..m.#########,,#######..$...#",
  "#............................#",
  "#F.......W.........m.........#",
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
        case "h": ground[i] = o.floor; put("rune", false); break; // concealed root-rune passage
        case "L": ground[i] = o.wall; solid[i] = 1; put("sealeddoor", true); triggers.push({ x: x - 1.1, y: y - 0.35, w: 1.5, h: 1.7, label: "Unlock the rootbound door", action: { type: "keydoor", title: "Rootbound Seal", text: "A living-root lock blocks the passage.", key: "root_key", x, y } }); break;
        case "F": ground[i] = o.wall; solid[i] = 1; put("walltorch", false); lights.push({ x: x + 0.5, y: y + 1, r: 5 }); break;
        case ",": ground[i] = o.id === "guild" ? T.CARPET : T.RITUAL; break;
        case "S": put("shelf", true); break;
        case "T": put("table", true); break;
        case "C": put("counter", true); break;
        case "K": put("banner", true); break;
        case "P": put("plant", true); break;
        case "N":
          put("bed", true);
          triggers.push({ x: x - 0.5, y: y - 0.5, w: 2, h: 2.2, label: "Lie down and nap", action: { type: "rest", price: 0 } });
          break;
        case "Q":
          put("chest", true);
          triggers.push({ x: x - 1, y: y, w: 3, h: 2, label: "Check the pantry", action: { type: "chest", id: `${o.id}:pantry`, loot: { apple: 3, bread: 1 }, gold: 0 } });
          break;
        case "B":
          put("board", true);
          triggers.push({ x: x - 1, y: y, w: 3, h: 2, label: "Read the Mission Board", action: { type: "board" } });
          break;
        case "$":
          put("chest", true);
          triggers.push({ x: x - 1, y: y - 1, w: 3, h: 3, label: "Open chest", action: { type: "chest", id: `${o.id}:${x},${y}`, loot: o.id.startsWith("dungeon") ? { azure_potion: 1, ancient_shard: 2, iron_sword: 1, root_key: 1 } : { azure_potion: 1, herb: 2 }, gold: o.id.startsWith("dungeon") ? 65 : 30 } });
          break;
        case "X": traps.push({ x, y }); break;
        case "m": {
          const dungeonKinds = ["skeleton", "cave_spider", "shadow_goblin", "ancient_skeleton", "root_guardian", "dungeon_wraith"] as const;
          const kind = o.id === "dungeon1" ? dungeonKinds[(x + y) % 4] : dungeonKinds[(x + y + 2) % dungeonKinds.length];
          spawns.push({ kind, x: x + 0.5, y: y + 0.5 }); break;
        }
        case "W": spawns.push({ kind: "hollow_king", x: x + 0.5, y: y + 0.5 }); break;
        case "G": spawns.push({ kind: "hollowroot_guardian", x: x + 0.5, y: y + 0.5 }); break;
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

export function buildInn(): Scene {
  const r = find(INN, "I");
  const npcs = [
    makeNpc({ id: "bram", name: "Bram", title: "Innkeeper", x: r.x + 0.5, y: r.y + 0.5, role: "innkeeper", look: { skin: "#e0b48c", hair: "#6a4a2a", cloak: "#7a3a2a", trim: "#f0d090" }, lines: ["Welcome to the Sleeping Stag! Ten gold for a warm bed and a hot meal — health, stamina and belly all restored.", "The beds upstairs? Those are for paying guests. Or a quick nap, if you're quiet about it."] }),
    makeNpc({ id: "odo", name: "Odo", title: "Bard", x: 9.5, y: 4.2, role: "villager", activity: "strumming a lute", look: { skin: "#f0c8a0", hair: "#c08a3a", cloak: "#4a6a2a", trim: "#f0c060" }, lines: ["♪ Six lands bound by one river of stars… ♪ — ah, you've heard it too? Every child in Eldergrove knows the song.", "Nobody knows the last verse. They say it's carved somewhere in the Forgotten Reach."] }),
  ];
  return build({ id: "inn", name: "The Sleeping Stag", map: INN, floor: T.WOOD, wall: T.WALL, dark: 0.2, exits: { D: { label: "Leave the inn", to: "overworld", x: 117.5, y: 80.2 } }, npcs });
}

export function buildCottage(): Scene {
  const npcs = [
    makeNpc({ id: "hesta", name: "Hesta", title: "Weaver", x: 3.5, y: 2.6, role: "villager", activity: "weaving", look: { skin: "#f0d0b0", hair: "#8a5a3a", cloak: "#8a4a5a", trim: "#f0d0d0" }, lines: ["Oh! A visitor. Mind the loom. I weave forest fiber into rope for the Guild.", "Help yourself to an apple from the pantry. And take a nap if you're weary — the bed's soft."] }),
  ];
  return build({ id: "cottage", name: "Hesta's Cottage", map: COTTAGE, floor: T.WOOD, wall: T.WALL, dark: 0.22, exits: { D: { label: "Leave the cottage", to: "overworld", x: 115.5, y: 88.3 } }, npcs });
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
