import { ATTRIBUTES, BALANCE, emptyAttributes, effects, masteryThreshold, migrateGrowth, type Attribute, type Growth, type Mastery } from "./growth";
import { useEffect, useReducer } from "react";
import type { MonsterKind, RegionId, SceneId } from "../core/types";
import { ITEMS } from "../data/items";
import { MAX_ACTIVE_MISSIONS, MISSIONS, type MissionDef } from "../data/missions";
import { VILLAGE_SPAWN } from "../world/overworld";
import { DEFAULT_APPEARANCE, type Appearance } from "../data/places";

const SAVE_KEY = "azura.save.v1";

export type MissionStatus = "active" | "done";
export interface MissionState {
  status: MissionStatus;
  base: number; // kill-count baseline at acceptance
}

export interface PlayerData {
  growth: Growth;
  name: string;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  inventory: Record<string, number>;
  equipment: Partial<Record<import("../data/items").EquipmentSlot, string>>;
  equipmentUpgrades: Record<string, number>;
  discoveredRegions: RegionId[];
  discoveredPois: string[];
  openedChests: string[];
  missions: Record<string, MissionState>;
  kills: Partial<Record<MonsterKind, number>>;
  pos: { scene: SceneId; x: number; y: number };
  appearance: Appearance;
  starterV2?: boolean;
  starterV3?: boolean;
  discoveredRecipes?: string[];
  farmPlots?: { crop: string | null; plantedAt: number; watered: boolean }[];
  fishCaught?: number;
  housing: { ownedHomeId: string | null; homeName: string; storage: Record<string, number>; upgrades: { bed: number } };
  marketListings: { id: string; seller: string; sellerType: "village" | "player"; itemId: string; quantity: number; unitPrice: number; createdAt: number }[];
  guild: { id: string | null; name: string | null; role: "leader" | "officer" | "member" | null; members: { id: string; name: string; role: "leader" | "officer" | "member" }[]; messages: { id: string; author: string; text: string; createdAt: number }[] };
}

export type Panel = null | "home" | "market" | "communityGuild" | "multiplayer" | "map" | "inventory" | "character" | "quests" | "guild" | "dialogue" | "shop" | "crafting" | "farming";

export interface DialogueState {
  name: string;
  title?: string;
  lines: string[];
  page: number;
  role?: "receptionist" | "merchant" | "innkeeper" | "trainer" | "villager" | "blacksmith" | "alchemist" | "info";
}

export interface UIState {
  panel: Panel;
  dialogue: DialogueState | null;
  prompt: string | null;
  toasts: { id: number; text: string; tone: "info" | "good" | "bad" | "gold" }[];
  banner: { title: string; sub: string; danger: number; key: number } | null;
  regionId: RegionId;
  sceneName: string;
  fade: number;
}

export function defaultData(): PlayerData {
  return {
    growth: migrateGrowth(undefined, 1),
    name: "Wanderer",
    level: 1,
    xp: 0,
    gold: 30,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 80,
    inventory: { apple: 4, bread: 2, healing_potion: 2, wooden_sword: 1, forest_fiber: 3, axe: 1, pickaxe: 1, gathering_knife: 1, fishing_rod: 1, watering_can: 1, wheat_seeds: 2, carrot_seeds: 2, potato_seeds: 2, herb_seeds: 2 },
    equipment: { weapon: "wooden_sword" },
    equipmentUpgrades: {},
    starterV2: true,
    starterV3: true,
    appearance: { ...DEFAULT_APPEARANCE },
    discoveredRegions: ["eldergrove"],
    discoveredPois: ["eldergrove"],
    openedChests: [],
    missions: {},
    kills: {},
    pos: { scene: "overworld", x: VILLAGE_SPAWN.x, y: VILLAGE_SPAWN.y },
    discoveredRecipes: ["healing_potion", "bread", "axe", "pickaxe", "knife", "fishing_rod", "watering_can"],
    farmPlots: Array.from({ length: 6 }, () => ({ crop: null, plantedAt: 0, watered: false })),
    fishCaught: 0,
    housing: { ownedHomeId: "eldergrove-cottage", homeName: "Willow Cottage", storage: {}, upgrades: { bed: 1 } },
    marketListings: [
      { id: "village-apple-1", seller: "Mira the Merchant", sellerType: "village", itemId: "apple", quantity: 8, unitPrice: 2, createdAt: 0 },
      { id: "village-bread-1", seller: "Bram the Innkeeper", sellerType: "village", itemId: "bread", quantity: 5, unitPrice: 5, createdAt: 0 },
      { id: "village-herb-1", seller: "Sylvi the Alchemist", sellerType: "village", itemId: "herb", quantity: 6, unitPrice: 7, createdAt: 0 },
      { id: "village-potion-1", seller: "Sylvi the Alchemist", sellerType: "village", itemId: "healing_potion", quantity: 3, unitPrice: 14, createdAt: 0 },
    ],
    guild: { id: null, name: null, role: null, members: [], messages: [] },
  };
}

type Listener = () => void;
const listeners = new Set<Listener>();
let toastId = 1;

export const game = {
  data: defaultData(),
  ui: {
    panel: null,
    dialogue: null,
    prompt: null,
    toasts: [],
    banner: null,
    regionId: "eldergrove",
    sceneName: "Azura",
    fade: 0,
  } as UIState,
  version: 0,
};

export function emit() {
  game.version++;
  listeners.forEach((l) => l());
}

export function useGame() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return game;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PlayerData>;
    // Keep a one-time, untouched Phase 5 snapshot before introducing growth data.
    if (!parsed.growth) {
      try { if (!localStorage.getItem(`${SAVE_KEY}.phase5.backup`)) localStorage.setItem(`${SAVE_KEY}.phase5.backup`, raw); } catch { /* A full quota must not prevent loading the existing save. */ }
    }
    game.data = { ...defaultData(), ...parsed };
    game.data.growth = migrateGrowth(parsed.growth, game.data.level);
    recalculateStats();
    game.data.appearance = { ...DEFAULT_APPEARANCE, ...(parsed.appearance ?? {}) };
    game.data.equipment = { ...(parsed.equipment ?? { weapon: "wooden_sword" }) };
    game.data.equipmentUpgrades = { ...(parsed.equipmentUpgrades ?? {}) };
    game.data.housing = { ...defaultData().housing, ...(parsed.housing ?? {}), storage: { ...(parsed.housing?.storage ?? {}) }, upgrades: { bed: 1, ...(parsed.housing?.upgrades ?? {}) } };
    game.data.marketListings = Array.isArray(parsed.marketListings) ? parsed.marketListings : defaultData().marketListings;
    game.data.guild = { ...defaultData().guild, ...(parsed.guild ?? {}), members: parsed.guild?.members ?? [], messages: parsed.guild?.messages ?? [] };
    if (!parsed.starterV2) {
      // Grant the Phase 2 starter kit once to existing saves.
      for (const [k, n] of Object.entries({ apple: 4, healing_potion: 2, wooden_sword: 1, forest_fiber: 3 })) addItem(k, n);
      game.data.starterV2 = true;
    }
    if (!parsed.starterV3) {
      for (const [k, n] of Object.entries({ axe: 1, pickaxe: 1, gathering_knife: 1, fishing_rod: 1, watering_can: 1, wheat_seeds: 2, carrot_seeds: 2, potato_seeds: 2, herb_seeds: 2 })) addItem(k, n);
      game.data.farmPlots ??= Array.from({ length: 6 }, () => ({ crop: null, plantedAt: 0, watered: false }));
      game.data.discoveredRecipes ??= ["healing_potion", "bread", "axe", "pickaxe", "knife", "fishing_rod", "watering_can"];
      game.data.starterV3 = true;
      save();
    }
    save();
    emit();
  } catch {
    game.data = defaultData();
  }
}

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.data));
  } catch {
    /* storage unavailable */
  }
  // While connected, mirror the economy snapshot so gathered/earned items can be traded.
  // The multiplayer service treats this as a prototype client sync; production must move all grants server-side.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("azura:character-save", { detail: { gold: game.data.gold, inventory: { ...game.data.inventory }, equipment: { ...(game.data.equipment ?? {}) } } }));
  }
}

export function resetProgress() {
  localStorage.removeItem(SAVE_KEY);
  game.data = defaultData();
  window.location.reload();
}

export function toast(text: string, tone: UIState["toasts"][number]["tone"] = "info") {
  const id = toastId++;
  game.ui.toasts = [...game.ui.toasts.slice(-4), { id, text, tone }];
  emit();
  setTimeout(() => {
    game.ui.toasts = game.ui.toasts.filter((t) => t.id !== id);
    emit();
  }, 3800);
}

export function openPanel(p: Panel) {
  game.ui.panel = game.ui.panel === p ? null : p;
  if (game.ui.panel !== "dialogue") game.ui.dialogue = null;
  emit();
}

export function closePanel() {
  game.ui.panel = null;
  game.ui.dialogue = null;
  emit();
}

export function openDialogue(d: Omit<DialogueState, "page">) {
  game.ui.dialogue = { ...d, page: 0 };
  game.ui.panel = "dialogue";
  emit();
}

// ---------- progression ----------
export const xpForLevel = (lvl: number) => 50 * lvl + 25 * (lvl - 1) * (lvl - 1);
export const equippedBonus = (d: PlayerData, stat: "attack" | "defence" | "healthBonus" | "staminaBonus") =>
  Object.values(d.equipment ?? {}).reduce((sum, id) => {
    if (!id) return sum;
    const item = ITEMS[id];
    return sum + (item?.[stat] ?? 0) + (item?.[stat] ? (d.equipmentUpgrades?.[id] ?? 0) * Math.max(1, Math.floor(item[stat]! * 0.2)) : 0);
  }, 0);
export const statEffects = (d: PlayerData) => effects(d.growth.attributes);
export const attackPower = (d: PlayerData) => Number(((8 + d.level * 3 + equippedBonus(d, "attack")) * statEffects(d).attack).toFixed(2));
// Future spells must call magicDamage rather than physical attackPower.
export const magicDamage = (d: PlayerData, base: number) => Math.max(0, base) * statEffects(d).magic;
export const incomingDamage = (d: PlayerData, raw: number, armourScale = 1) => Math.max(1, (raw - defencePower(d) * armourScale) * (1 - statEffects(d).resistance));
export const staminaCost = (d: PlayerData, base: number, dodge = false) => base * statEffects(d).staminaCost * (dodge ? statEffects(d).dodgeCost : 1);
export function recalculateStats() {
  const d = game.data, f = statEffects(d);
  d.maxHp = Math.round((100 + (d.level-1)*15 + equippedBonus(d, "healthBonus")) * f.health);
  d.maxStamina = Math.round((100 + (d.level-1)*5 + equippedBonus(d, "staminaBonus")) * f.stamina);
  d.hp = Math.min(d.hp, d.maxHp); d.stamina = Math.min(d.stamina, d.maxStamina);
}
export const pendingTotal = () => Object.values(game.data.growth.pending).reduce((a,b) => a+b,0);
export function stageAttribute(key: Attribute) {
  const g = game.data.growth;
  if (!ATTRIBUTES.includes(key) || pendingTotal() >= g.unspent) return;
  g.pending[key]++; save(); emit();
}
export function cancelAttributes() { game.data.growth.pending = emptyAttributes(); save(); emit(); }
export function confirmAttributes() {
  const g = game.data.growth, total = pendingTotal();
  if (!total || total > g.unspent || ATTRIBUTES.some(k => !Number.isSafeInteger(g.pending[k]) || g.pending[k] < 0)) return false;
  for (const key of ATTRIBUTES) g.attributes[key] += g.pending[key];
  g.unspent -= total; g.pending = emptyAttributes(); recalculateStats(); save(); emit();
  toast("Attributes confirmed.", "good"); return true;
}
// Persisted rate limits survive refreshes. XP is awarded only at successful activity completion.
export function addMasteryXp(track: Mastery, amount: number, cooldownMs = 0) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const g = game.data.growth, now = Date.now(), last = g.activityAt[track];
  if (last !== undefined && now - last < cooldownMs) return false;
  g.activityAt[track] = now;
  const m = g.masteries[track]; m.xp += Math.min(25, Math.floor(amount));
  while (m.xp >= masteryThreshold(m.level)) { m.xp -= masteryThreshold(m.level); m.level++; toast(`${track} mastery reached level ${m.level}!`, "gold"); }
  save(); emit(); return true;
}

export const defencePower = (d: PlayerData) => equippedBonus(d, "defence");
export function equipItem(id: string) {
  const d = game.data, def = ITEMS[id];
  if (!def?.slot || !d.inventory[id]) return toast("This item cannot be equipped.", "bad");
  d.equipment ??= {};
  d.equipment[def.slot] = id;
  recalculateStats();
  d.hp = Math.min(d.maxHp, d.hp); d.stamina = Math.min(d.maxStamina, d.stamina);
  toast(`${def.name} equipped.`, "good"); save(); emit();
}
export function unequipItem(slot: import("../data/items").EquipmentSlot) {
  const d = game.data; delete d.equipment[slot];
  recalculateStats();
  d.hp = Math.min(d.hp, d.maxHp); d.stamina = Math.min(d.stamina, d.maxStamina);
  save(); emit(); toast(`${slot} unequipped.`);
}
export function upgradeEquipment(id: string) {
  const d = game.data, def = ITEMS[id];
  if (!def?.slot || !d.inventory[id]) return toast("Select owned equipment to upgrade.", "bad");
  const level = d.equipmentUpgrades[id] ?? 0;
  if (level >= (def.upgradeMax ?? 5)) return toast("This item is already at its upgrade limit.", "info");
  const material = id.includes("sword") ? "ancient_shard" : "forest_fiber";
  const need = level + 1, goldCost = 15 * (level + 1);
  if ((d.inventory[material] ?? 0) < need || d.gold < goldCost) return toast(`Need ${need} ${ITEMS[material].name} and ${goldCost} gold.`, "bad");
  d.inventory[material] -= need; if (!d.inventory[material]) delete d.inventory[material];
  d.gold -= goldCost; d.equipmentUpgrades[id] = level + 1;
  recalculateStats();
  d.hp = Math.min(d.hp, d.maxHp); d.stamina = Math.min(d.stamina, d.maxStamina);
  toast(`${def.name} upgraded to +${level + 1}. Stats improved.`, "gold"); save(); emit();
}

export function setAppearance(a: Partial<Appearance>) {
  game.data.appearance = { ...game.data.appearance, ...a };
  save();
  emit();
}

export function addXp(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const d = game.data;
  d.xp += amount;
  const levels: number[] = [];
  while (d.xp >= xpForLevel(d.level)) {
    d.xp -= xpForLevel(d.level); d.level++;
    if (d.level > d.growth.rewardedLevel) {
      d.growth.unspent += BALANCE.pointsPerLevel;
      d.growth.rewardedLevel = d.level;
    }
    recalculateStats(); d.hp = d.maxHp;
    levels.push(d.level);
  }
  // Save the reward watermark and point balance atomically before notifications.
  save(); emit();
  for (const level of levels) toast(`Level up! Level ${level} · +3 attribute points.`, "gold");
}

export function addItem(id: string, n = 1) {
  game.data.inventory[id] = (game.data.inventory[id] ?? 0) + n;
}

export function useItem(id: string) {
  const d = game.data;
  const def = ITEMS[id];
  if (!def?.use || !d.inventory[id]) return;
  if (def.use.hp) d.hp = Math.min(d.maxHp, d.hp + def.use.hp * (def.kind === "potion" || id.includes("potion") ? statEffects(d).magic : 1));
  if (def.use.hunger) d.hunger = Math.min(100, d.hunger + def.use.hunger);
  if (def.use.stamina) d.stamina = Math.min(d.maxStamina, d.stamina + def.use.stamina);
  d.inventory[id]--;
  if (d.inventory[id] <= 0) delete d.inventory[id];
  toast(`Used ${def.name}.`, "good");
  save();
  emit();
}

export function buyItem(id: string, price: number) {
  const d = game.data;
  if (d.gold < price) return toast("Not enough gold.", "bad");
  d.gold -= price;
  addItem(id);
  toast(`Bought ${ITEMS[id].name}.`, "gold");
  save();
  emit();
}

export function sellMaterials() {
  const d = game.data;
  let total = 0;
  for (const [id, n] of Object.entries(d.inventory)) {
    const def = ITEMS[id];
    if (def && (def.kind === "material" || def.kind === "relic") && id !== "kings_sigil") {
      total += def.value * n;
      delete d.inventory[id];
    }
  }
  if (!total) return toast("You have no materials to sell.", "info");
  d.gold += total;
  toast(`Sold materials for ${total} gold.`, "gold");
  save();
  emit();
}

export function rest(price: number) {
  const d = game.data;
  if (d.gold < price) return toast("Not enough gold for a room.", "bad");
  d.gold -= price;
  d.hp = d.maxHp;
  d.stamina = d.maxStamina;
  if (price > 0) d.hunger = 100;
  toast(price > 0 ? "You wake fully rested and well fed." : "A short nap. Health and stamina restored.", "good");
  save();
  emit();
}

// ---------- gathering, crafting, fishing and farming ----------
export const RECIPES: Record<string, { name: string; result: string; count: number; ingredients: Record<string, number>; time: number; category: string }> = {
  axe: { name: "Woodcutter Axe", result: "axe", count: 1, ingredients: { wood: 4, stone: 2, branch: 1 }, time: 3, category: "Tools" },
  pickaxe: { name: "Miner's Pickaxe", result: "pickaxe", count: 1, ingredients: { wood: 3, stone: 4, iron_ore: 1 }, time: 4, category: "Tools" },
  knife: { name: "Gathering Knife", result: "gathering_knife", count: 1, ingredients: { wood: 1, stone: 2, iron_ore: 1 }, time: 2, category: "Tools" },
  fishing_rod: { name: "Fishing Rod", result: "fishing_rod", count: 1, ingredients: { wood: 3, branch: 2, forest_fiber: 2 }, time: 3, category: "Tools" },
  watering_can: { name: "Watering Can", result: "watering_can", count: 1, ingredients: { iron_ore: 2, wood: 1 }, time: 2, category: "Tools" },
  healing_potion: { name: "Herbal Healing Potion", result: "healing_potion", count: 2, ingredients: { herb: 2, mushroom: 1 }, time: 4, category: "Potions" },
  stamina_potion: { name: "Stamina Tonic", result: "stamina_potion", count: 1, ingredients: { herb: 1, rare_herb: 1 }, time: 4, category: "Potions" },
  bread: { name: "Trail Bread", result: "bread", count: 2, ingredients: { wheat: 3 }, time: 3, category: "Food" },
  cooked_fish: { name: "Pan-seared River Fish", result: "cooked_fish", count: 1, ingredients: { river_fish: 1, mushroom: 1 }, time: 5, category: "Food" },
  iron_sword: { name: "Ironbark Sword", result: "iron_sword", count: 1, ingredients: { iron_ore: 4, wood: 2, forest_fiber: 2 }, time: 6, category: "Weapons" },
};
export function gatherResource(item: string, amount = 1) {
  const d = game.data; const tool = item === "wood" || item === "branch" ? "axe" : item === "stone" || item === "iron_ore" || item === "copper_ore" ? "pickaxe" : "gathering_knife";
  if (tool !== "gathering_knife" && !d.inventory[tool]) return toast(`You need a ${tool.replace("_", " ")} to gather this.`, "bad");
  addItem(item, amount); addMasteryXp("gathering", 6, 450); if (item === "wood") addItem("branch", 1); toast(`Gathered ${amount}× ${ITEMS[item]?.name ?? item}${item === "wood" ? " and 1× Dry Branch" : ""}.`, "good"); save(); emit();
}
const craftingNow = new Set<string>();
export function craftRecipe(id: string) {
  const d = game.data, r = RECIPES[id]; if (!r || craftingNow.has(id)) return;
  for (const [item, n] of Object.entries(r.ingredients)) if ((d.inventory[item] ?? 0) < n) return toast(`Missing ${n}× ${ITEMS[item]?.name ?? item}.`, "bad");
  craftingNow.add(id); toast(`Crafting ${r.name}…`, "info");
  window.setTimeout(() => {
    const current = game.data;
    if (Object.entries(r.ingredients).some(([item,n]) => (current.inventory[item] ?? 0) < n)) { craftingNow.delete(id); return toast("Craft cancelled: ingredients changed.", "bad"); }
    for (const [item, n] of Object.entries(r.ingredients)) { current.inventory[item] -= n; if (!current.inventory[item]) delete current.inventory[item]; }
    addItem(r.result, r.count); addMasteryXp("crafting", 8, 700); craftingNow.delete(id); toast(`Crafted ${r.count}× ${ITEMS[r.result]?.name ?? r.name}.`, "good"); save(); emit();
  }, Math.max(700, r.time * 500));
}
export function plantCrop(index: number, crop: string) {
  const d = game.data; d.farmPlots ??= Array.from({ length: 6 }, () => ({ crop: null, plantedAt: 0, watered: false }));
  if (!["wheat", "carrot", "potato", "herb"].includes(crop) || !Number.isInteger(index)) return;
  if (!d.inventory[`${crop}_seeds`]) return toast(`You need ${crop} seeds.`, "bad");
  const plot = d.farmPlots[index]; if (!plot || plot.crop) return toast("That plot is occupied.", "bad");
  d.inventory[`${crop}_seeds`]--; if (!d.inventory[`${crop}_seeds`]) delete d.inventory[`${crop}_seeds`];
  plot.crop = crop; plot.plantedAt = Date.now(); plot.watered = false; save(); emit(); toast(`${crop} seeds planted. Water them to help them grow.`, "good");
}
export function waterCrop(index: number) {
  const d=game.data, plot=d.farmPlots?.[index]; if (!plot?.crop) return toast("Nothing is planted here.");
  if (!d.inventory["watering_can"]) return toast("You need a watering can.", "bad");
  if (plot.watered) return toast("This crop is already watered.");
  plot.watered=true; plot.plantedAt=Math.min(plot.plantedAt, Date.now()-60_000); save(); emit(); toast("Crop watered. Growth accelerated.", "good");
}
export function harvestCrop(index: number) {
  const d=game.data, plot=d.farmPlots?.[index]; if (!plot?.crop) return;
  const duration=plot.watered ? 90_000 : 180_000; if (Date.now()-plot.plantedAt < duration) return toast("This crop is still growing.", "info");
  const crop=plot.crop; addItem(crop, crop === "herb" ? 2 : 3); plot.crop=null; plot.plantedAt=0; plot.watered=false; addMasteryXp("farming", 10); save(); emit(); toast(`Harvested ${crop}!`, "good");
}
export function catchFish() { const d=game.data; if (!d.inventory["fishing_rod"]) return toast("You need a fishing rod.", "bad"); if (Date.now() - (d.growth.activityAt.fishing ?? -Infinity) < 1800) return; const fish=Math.random()<0.12?"golden_trout":"river_fish"; addItem(fish,1); d.fishCaught=(d.fishCaught??0)+1; addMasteryXp("fishing", 8, 1800); save(); emit(); toast(`You caught ${ITEMS[fish].name}!`, "good"); }

// ---------- missions ----------
export function missionProgress(m: MissionDef): { cur: number; max: number } {
  const d = game.data;
  const st = d.missions[m.id];
  const g = m.goal;
  if (g.type === "kill") {
    const base = st?.base ?? 0;
    return { cur: Math.min(g.count, (d.kills[g.monster] ?? 0) - base), max: g.count };
  }
  if (g.type === "collect") { const base = st?.base ?? 0; return { cur: Math.min(g.count, Math.max(0, (d.inventory[g.item] ?? 0) - base)), max: g.count }; }
  if (g.type === "poi") return { cur: d.discoveredPois.includes(g.poi) ? 1 : 0, max: 1 };
  return { cur: d.discoveredRegions.includes(g.region) ? 1 : 0, max: 1 };
}

export const isReady = (m: MissionDef) => {
  const p = missionProgress(m);
  return game.data.missions[m.id]?.status === "active" && p.cur >= p.max;
};

export function acceptMission(id: string) {
  const d = game.data;
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || d.missions[id]) return;
  const active = Object.values(d.missions).filter((s) => s.status === "active").length;
  if (active >= MAX_ACTIVE_MISSIONS) return toast(`You can only hold ${MAX_ACTIVE_MISSIONS} active missions.`, "bad");
  d.missions[id] = { status: "active", base: m.goal.type === "kill" ? d.kills[m.goal.monster] ?? 0 : m.goal.type === "collect" ? d.inventory[m.goal.item] ?? 0 : 0 };
  toast(`Mission accepted: ${m.title}`, "good");
  save();
  emit();
}

export function abandonMission(id: string) {
  delete game.data.missions[id];
  toast("Mission abandoned.");
  save();
  emit();
}

export function turnInMission(id: string) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || !isReady(m)) return;
  const d = game.data;
  d.missions[id]!.status = "done";
  d.gold += m.reward.gold;
  for (const [it, n] of Object.entries(m.reward.items ?? {})) addItem(it, n);
  addXp(m.reward.xp);
  toast(`Mission complete! +${m.reward.xp} XP, +${m.reward.gold} gold`, "gold");
  save();
  emit();
}

const notified = new Set<string>();
export function checkMissionReadiness() {
  for (const m of MISSIONS) {
    if (isReady(m) && !notified.has(m.id)) {
      notified.add(m.id);
      toast(`"${m.title}" complete — report to the Guild.`, "gold");
    }
  }
}
