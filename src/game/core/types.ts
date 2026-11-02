export type RegionId = "eldergrove" | "verdant" | "thornveil" | "hollowroot" | "forgotten" | "blackwood";
export type SceneId = "overworld" | "guild" | "dungeon1" | "dungeon2";
export type Dir = 0 | 1 | 2 | 3; // down, left, right, up

export type MonsterKind =
  | "slime"
  | "wolf"
  | "spiderling"
  | "vinecrawler"
  | "golem"
  | "shade"
  | "skeleton"
  | "hollow_king";

export interface Look {
  skin: string;
  hair: string;
  cloak: string;
  trim: string;
}

export interface Decor {
  kind: string;
  x: number; // tile coords (base / feet point for y-sorting)
  y: number;
  w?: number;
  h?: number;
  v: number; // variant hash 0..1
  label?: string;
}

export type Action =
  | { type: "scene"; to: SceneId; x: number; y: number }
  | { type: "board" }
  | { type: "inspect"; title: string; text: string }
  | { type: "chest"; id: string; loot: Record<string, number>; gold: number }
  | { type: "locked"; title: string; text: string };

export interface Trigger {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: Action;
}

export type NpcRole = "receptionist" | "merchant" | "innkeeper" | "trainer" | "villager";

export interface NPC {
  id: string;
  name: string;
  title?: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  dir: Dir;
  look: Look;
  lines: string[];
  role: NpcRole;
  wander: boolean;
  tx?: number;
  ty?: number;
  wait: number;
  walk: number;
}

export interface MonsterSpawn {
  kind: MonsterKind;
  x: number;
  y: number;
}

export interface Scene {
  id: SceneId;
  name: string;
  w: number;
  h: number;
  ground: Uint8Array;
  solid: Uint8Array;
  region?: Uint8Array; // index into REGIONS (overworld only)
  decor: Decor[];
  npcs: NPC[];
  spawns: MonsterSpawn[];
  triggers: Trigger[];
  traps: { x: number; y: number }[];
  lights: { x: number; y: number; r: number }[];
  dark: number; // 0..1 base darkness
  spawn: { x: number; y: number };
}
