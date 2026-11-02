export const T = {
  DEEP: 0,
  WATER: 1,
  SAND: 2,
  GRASS: 3,
  PATH: 4,
  PLAZA: 5,
  JUNGLE: 6,
  MOSS: 7,
  DRYGRASS: 8,
  DARK: 9,
  BRIDGE: 10,
  WOOD: 11,
  STONEF: 12,
  WALL: 13,
  RUIN: 14,
  VOID: 15,
  CARPET: 16,
  FOREST: 17,
  RITUAL: 18,
} as const;

/** [base, alt] painted colors per tile. Edit to restyle terrain. */
export const TILE_COLORS: Record<number, [string, string]> = {
  0: ["#1d4e7a", "#174268"],
  1: ["#2f7fb0", "#3990c2"],
  2: ["#dcc893", "#c9b37a"],
  3: ["#86b84e", "#6ea23f"],
  4: ["#c9a46a", "#b38f57"],
  5: ["#bcb4a2", "#a59d8b"],
  6: ["#3e8a45", "#2c7238"],
  7: ["#4f6e3c", "#3d5a30"],
  8: ["#b9ab60", "#a2944e"],
  9: ["#2f3d2e", "#222d23"],
  10: ["#8a5f3a", "#74502f"],
  11: ["#a5794c", "#8f6740"],
  12: ["#6e6c75", "#5c5a64"],
  13: ["#3e3a46", "#2f2c37"],
  14: ["#aaa18a", "#938a75"],
  15: ["#0b0b10", "#0b0b10"],
  16: ["#8e2f35", "#76262c"],
  17: ["#559640", "#427d32"],
  18: ["#3b2440", "#2e1b33"],
};

export const SOLID_TILES = new Set<number>([T.DEEP, T.WATER, T.WALL, T.VOID]);
export const GRASSY = new Set<number>([T.GRASS, T.JUNGLE, T.MOSS, T.DRYGRASS, T.DARK, T.FOREST]);
