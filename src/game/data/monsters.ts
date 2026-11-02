import type { MonsterKind } from "../core/types";

export interface MonsterDef {
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  xp: number;
  gold: number;
  drop: string;
  aggro: number;
  size: number;
  boss?: boolean;
  respawn: number;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  slime: { name: "Moss Slime", hp: 22, dmg: 4, speed: 1.6, xp: 8, gold: 2, drop: "slime_gel", aggro: 4, size: 0.42, respawn: 30 },
  wolf: { name: "Thicket Wolf", hp: 38, dmg: 7, speed: 3.1, xp: 16, gold: 4, drop: "wolf_pelt", aggro: 6, size: 0.5, respawn: 40 },
  spiderling: { name: "Thorn Spiderling", hp: 32, dmg: 9, speed: 3, xp: 18, gold: 5, drop: "venom_sac", aggro: 5.5, size: 0.45, respawn: 40 },
  vinecrawler: { name: "Vinecrawler", hp: 50, dmg: 8, speed: 1.4, xp: 22, gold: 6, drop: "rare_herb", aggro: 4, size: 0.55, respawn: 50 },
  golem: { name: "Ruin Golem", hp: 90, dmg: 14, speed: 1.2, xp: 42, gold: 12, drop: "ancient_shard", aggro: 4.5, size: 0.65, respawn: 60 },
  shade: { name: "Blackwood Shade", hp: 75, dmg: 18, speed: 3.3, xp: 58, gold: 15, drop: "umbral_essence", aggro: 7, size: 0.55, respawn: 60 },
  skeleton: { name: "Hollow Sentinel", hp: 42, dmg: 10, speed: 2.3, xp: 26, gold: 8, drop: "bone_dust", aggro: 6, size: 0.48, respawn: 45 },
  hollow_king: { name: "The Hollow King", hp: 420, dmg: 22, speed: 2.1, xp: 320, gold: 150, drop: "kings_sigil", aggro: 9, size: 1.1, boss: true, respawn: 240 },
  goblin: { name: "Goblin Scout", hp: 34, dmg: 7, speed: 2.6, xp: 18, gold: 5, drop: "goblin_token", aggro: 5.5, size: 0.46, respawn: 42 },
  boar: { name: "Forest Boar", hp: 48, dmg: 11, speed: 3.0, xp: 24, gold: 4, drop: "boar_tusk", aggro: 4.8, size: 0.58, respawn: 48 },
  treant: { name: "Ancient Treant", hp: 150, dmg: 16, speed: 0.9, xp: 75, gold: 18, drop: "heartwood_core", aggro: 3.8, size: 0.9, boss: true, respawn: 150 },
  cave_spider: { name: "Cave Spider", hp: 46, dmg: 11, speed: 3.2, xp: 28, gold: 7, drop: "cave_silk", aggro: 5.5, size: 0.48, respawn: 55 },
  shadow_goblin: { name: "Shadow Goblin", hp: 58, dmg: 13, speed: 2.9, xp: 36, gold: 10, drop: "shadow_ember", aggro: 6.2, size: 0.5, respawn: 60 },
  ancient_skeleton: { name: "Ancient Skeleton", hp: 68, dmg: 14, speed: 2.1, xp: 42, gold: 12, drop: "ancient_bone", aggro: 6, size: 0.52, respawn: 65 },
  root_guardian: { name: "Root Guardian", hp: 105, dmg: 17, speed: 1.25, xp: 58, gold: 16, drop: "root_shard", aggro: 4.8, size: 0.72, respawn: 75 },
  dungeon_wraith: { name: "Dungeon Wraith", hp: 72, dmg: 16, speed: 3.4, xp: 52, gold: 14, drop: "wraith_dust", aggro: 7, size: 0.55, respawn: 70 },
  hollowroot_guardian: { name: "The Hollowroot Guardian", hp: 680, dmg: 24, speed: 1.5, xp: 600, gold: 300, drop: "guardian_core", aggro: 10, size: 1.3, boss: true, respawn: 999999 },
};
