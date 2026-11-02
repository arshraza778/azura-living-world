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
  discoveredRegions: RegionId[];
  discoveredPois: string[];
  openedChests: string[];
  missions: Record<string, MissionState>;
  kills: Partial<Record<MonsterKind, number>>;
  pos: { scene: SceneId; x: number; y: number };
  appearance: Appearance;
  starterV2?: boolean;
}

export type Panel = null | "map" | "inventory" | "character" | "quests" | "guild" | "dialogue" | "shop";

export interface DialogueState {
  name: string;
  title?: string;
  lines: string[];
  page: number;
  role?: "receptionist" | "merchant" | "innkeeper" | "trainer" | "villager" | "info";
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
    name: "Wanderer",
    level: 1,
    xp: 0,
    gold: 30,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 80,
    inventory: { apple: 4, bread: 2, healing_potion: 2, wooden_sword: 1, forest_fiber: 3 },
    starterV2: true,
    appearance: { ...DEFAULT_APPEARANCE },
    discoveredRegions: ["eldergrove"],
    discoveredPois: ["eldergrove"],
    openedChests: [],
    missions: {},
    kills: {},
    pos: { scene: "overworld", x: VILLAGE_SPAWN.x, y: VILLAGE_SPAWN.y },
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
    game.data = { ...defaultData(), ...parsed };
    game.data.appearance = { ...DEFAULT_APPEARANCE, ...(parsed.appearance ?? {}) };
    if (!parsed.starterV2) {
      // Grant the Phase 2 starter kit once to existing saves.
      for (const [k, n] of Object.entries({ apple: 4, healing_potion: 2, wooden_sword: 1, forest_fiber: 3 })) addItem(k, n);
      game.data.starterV2 = true;
    }
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
export const attackPower = (d: PlayerData) =>
  8 + d.level * 3 + Math.max(0, ...Object.keys(d.inventory).map((id) => ITEMS[id]?.attack ?? 0));

export function setAppearance(a: Partial<Appearance>) {
  game.data.appearance = { ...game.data.appearance, ...a };
  save();
  emit();
}

export function addXp(amount: number) {
  const d = game.data;
  d.xp += amount;
  while (d.xp >= xpForLevel(d.level)) {
    d.xp -= xpForLevel(d.level);
    d.level++;
    d.maxHp += 15;
    d.maxStamina += 5;
    d.hp = d.maxHp;
    toast(`Level up! You are now level ${d.level}.`, "gold");
  }
}

export function addItem(id: string, n = 1) {
  game.data.inventory[id] = (game.data.inventory[id] ?? 0) + n;
}

export function useItem(id: string) {
  const d = game.data;
  const def = ITEMS[id];
  if (!def?.use || !d.inventory[id]) return;
  if (def.use.hp) d.hp = Math.min(d.maxHp, d.hp + def.use.hp);
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

// ---------- missions ----------
export function missionProgress(m: MissionDef): { cur: number; max: number } {
  const d = game.data;
  const st = d.missions[m.id];
  const g = m.goal;
  if (g.type === "kill") {
    const base = st?.base ?? 0;
    return { cur: Math.min(g.count, (d.kills[g.monster] ?? 0) - base), max: g.count };
  }
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
  d.missions[id] = { status: "active", base: m.goal.type === "kill" ? d.kills[m.goal.monster] ?? 0 : 0 };
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
