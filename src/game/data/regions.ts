import type { MonsterKind, RegionId } from "../core/types";

/**
 * AZURA GEOGRAPHY CONFIG
 * Everything about the country's shape lives here. Move region centers,
 * change weights (bigger = larger territory), redraw rivers/paths/lakes —
 * the overworld and the world map regenerate from this data.
 */
export const WORLD_W = 200;
export const WORLD_H = 140;
export const TILE = 32;

export type RegionStatus = "safe" | "wild" | "dangerous";

export interface RegionDef {
  id: RegionId;
  name: string;
  subtitle: string;
  description: string;
  danger: 1 | 2 | 3 | 4 | 5;
  status: RegionStatus;
  center: [number, number];
  weight: number;
  groundTile: number;
  treeDensity: number;
  trees: string[];
  monsters: MonsterKind[];
  monsterCount: number;
  ambient: { tint: string; tintAlpha: number; dark: number; mist: number; fireflies: number };
  mapColor: string;
}

export const REGIONS: RegionDef[] = [
  {
    id: "eldergrove",
    name: "Eldergrove",
    subtitle: "The Main Village",
    description:
      "A warm medieval settlement of timber houses and lantern-lit lanes. Home of the Adventurers' Guild, the Sleeping Stag inn, merchants and a training ground. Every road into the wilds begins here.",
    danger: 1,
    status: "safe",
    center: [106, 80],
    weight: 0.6,
    groundTile: 3,
    treeDensity: 0.025,
    trees: ["oak"],
    monsters: [],
    monsterCount: 0,
    ambient: { tint: "#ffd9a0", tintAlpha: 0.06, dark: 0, mist: 0, fireflies: 0 },
    mapColor: "#8fbf5a",
  },
  {
    id: "verdant",
    name: "Verdant Wilds",
    subtitle: "The Great Forest",
    description:
      "An ocean of ancient oaks with winding paths, babbling streams and mossy caves. Slimes and wolves roam the undergrowth. Hunters' trails hide forgotten cabins.",
    danger: 2,
    status: "wild",
    center: [78, 42],
    weight: 1,
    groundTile: 17,
    treeDensity: 0.32,
    trees: ["oak", "oak", "pine", "birch"],
    monsters: ["slime", "slime", "wolf"],
    monsterCount: 34,
    ambient: { tint: "#9fe0a0", tintAlpha: 0.05, dark: 0.08, mist: 0.15, fireflies: 0.2 },
    mapColor: "#4f9a46",
  },
  {
    id: "thornveil",
    name: "Thornveil Jungle",
    subtitle: "The Poisoned Green",
    description:
      "Humid tropical tangle of giant ferns and venomous blossoms. Rare potion ingredients grow in hidden clearings — guarded by spiderlings and creeping vines.",
    danger: 3,
    status: "dangerous",
    center: [160, 106],
    weight: 1.05,
    groundTile: 6,
    treeDensity: 0.36,
    trees: ["palm", "jungle", "jungle"],
    monsters: ["spiderling", "vinecrawler"],
    monsterCount: 30,
    ambient: { tint: "#7dffb0", tintAlpha: 0.08, dark: 0.12, mist: 0.35, fireflies: 0.3 },
    mapColor: "#2f8a52",
  },
  {
    id: "hollowroot",
    name: "Hollowroot",
    subtitle: "The Dungeon Woods",
    description:
      "Twisted roots swallow the ancient Hollowroot Gate — a dungeon descending through trapped halls and hidden chambers to the throne of the Hollow King.",
    danger: 4,
    status: "dangerous",
    center: [40, 100],
    weight: 0.9,
    groundTile: 7,
    treeDensity: 0.3,
    trees: ["pine", "oak", "dead"],
    monsters: ["wolf", "slime", "wolf"],
    monsterCount: 22,
    ambient: { tint: "#a0c0ff", tintAlpha: 0.07, dark: 0.2, mist: 0.4, fireflies: 0.15 },
    mapColor: "#557048",
  },
  {
    id: "forgotten",
    name: "Forgotten Reach",
    subtitle: "Ruins of the First Kingdom",
    description:
      "Golden grasslands strewn with toppled columns, star-rings and obelisks inscribed in a dead script. Stone golems still guard what their makers abandoned.",
    danger: 3,
    status: "wild",
    center: [162, 30],
    weight: 1,
    groundTile: 8,
    treeDensity: 0.07,
    trees: ["birch", "dead"],
    monsters: ["golem"],
    monsterCount: 16,
    ambient: { tint: "#ffe08a", tintAlpha: 0.09, dark: 0, mist: 0.1, fireflies: 0 },
    mapColor: "#c2b062",
  },
  {
    id: "blackwood",
    name: "Blackwood Expanse",
    subtitle: "Where Light Dies",
    description:
      "A lightless forest of black pines and whispering shades. Something colossal slumbers at its heart — and legends speak of Mythical relics buried beneath its roots.",
    danger: 5,
    status: "dangerous",
    center: [32, 28],
    weight: 1.1,
    groundTile: 9,
    treeDensity: 0.4,
    trees: ["darkpine", "darkpine", "dead"],
    monsters: ["shade", "shade", "wolf"],
    monsterCount: 26,
    ambient: { tint: "#5a3a8a", tintAlpha: 0.16, dark: 0.5, mist: 0.6, fireflies: 0.1 },
    mapColor: "#2c3a30",
  },
];

export const regionIndex = (id: string) => REGIONS.findIndex((r) => r.id === id);

/** Coastline: landmass is an ellipse distorted by noise. */
export const COAST = { radius: 0.92, noise: 0.55 };

export interface WaterLine {
  name: string;
  width: number;
  points: [number, number][];
}

export const RIVERS: WaterLine[] = [
  {
    name: "Azure River",
    width: 1.8,
    points: [
      [98, 0], [96, 18], [90, 34], [84, 52], [76, 66], [64, 80], [62, 96], [66, 118], [70, 140],
    ],
  },
  {
    name: "Sunfall River",
    width: 1.6,
    points: [
      [200, 40], [176, 44], [158, 48], [146, 62], [138, 82], [134, 100], [138, 120], [140, 140],
    ],
  },
];

export const LAKES: { name: string; x: number; y: number; rx: number; ry: number }[] = [
  { name: "Mirrorlake", x: 62, y: 81, rx: 7, ry: 5 },
  { name: "Gloomtarn", x: 36, y: 33, rx: 4, ry: 3 },
  { name: "Emerald Lagoon", x: 170, y: 114, rx: 5, ry: 4 },
];

export const PATHS: WaterLine[] = [
  { name: "North Road", width: 1.3, points: [[106, 80], [104, 62], [100, 52], [82, 45], [60, 36], [40, 30], [26, 20]] },
  { name: "Ruin Road", width: 1.2, points: [[106, 80], [120, 66], [134, 56], [150, 40], [162, 30], [174, 36]] },
  { name: "Jungle Trail", width: 1.1, points: [[106, 80], [120, 88], [134, 94], [150, 100], [162, 104], [172, 98]] },
  { name: "Hollow Path", width: 1.1, points: [[106, 80], [88, 84], [72, 90], [56, 96], [40, 102]] },
  { name: "Lake Spur", width: 0.9, points: [[82, 86], [70, 84]] },
  { name: "Cave Trail", width: 0.9, points: [[82, 45], [72, 32]] },
  { name: "Hunter Trail", width: 0.8, points: [[70, 40], [62, 52]] },
];
