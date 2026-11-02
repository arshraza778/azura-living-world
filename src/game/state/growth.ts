// Phase 5.1 tuning: every attribute uses a bounded, diminishing-return curve.
export const ATTRIBUTE_INFO = {
  strength: { name: "Strength", description: "Increases physical attack damage." },
  vitality: { name: "Vitality", description: "Increases maximum health and defensive resistance." },
  agility: { name: "Agility", description: "Improves movement, attack speed and dodge stamina efficiency." },
  endurance: { name: "Endurance", description: "Increases maximum stamina and reduces all stamina costs." },
  intelligence: { name: "Intelligence", description: "Increases magical power and the potency of healing potions. Future spell damage uses the same multiplier." },
  survival: { name: "Survival", description: "Slows hunger depletion and speeds up gathering." },
} as const;
export type Attribute = keyof typeof ATTRIBUTE_INFO;
export const ATTRIBUTES = Object.keys(ATTRIBUTE_INFO) as Attribute[];
export const MASTERIES = ["combat", "fishing", "gathering", "crafting", "farming", "exploration", "magic"] as const;
export type Mastery = typeof MASTERIES[number];
export type Attributes = Record<Attribute, number>;
export interface Growth {
  version: 1;
  rewardedLevel: number;
  unspent: number;
  attributes: Attributes;
  pending: Attributes;
  masteries: Record<Mastery, { level: number; xp: number }>;
  activityAt: Partial<Record<Mastery, number>>;
  resourceReadyAt: Record<string, number>;
}
export const BALANCE = {
  pointsPerLevel: 3, halfSaturation: 25,
  attack: .8, health: 1, resistance: .35, movement: .2,
  attackSpeed: .25, dodgeCost: .25, stamina: 1, staminaSaving: .35,
  magic: 1, hungerSaving: .5, gatheringSpeed: .45,
  masteryBase: 40, masteryStep: 25,
};
const integer = (n: unknown, fallback = 0) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1_000_000, Math.floor(n))) : fallback;
export const emptyAttributes = (): Attributes => Object.fromEntries(ATTRIBUTES.map(k => [k, 0])) as Attributes;
export function migrateGrowth(raw: Partial<Growth> | undefined, level: number): Growth {
  const g: Growth = {
    version: 1, rewardedLevel: Math.max(level, integer(raw?.rewardedLevel, level)),
    unspent: integer(raw?.unspent, Math.max(0, level - 1) * BALANCE.pointsPerLevel),
    attributes: emptyAttributes(), pending: emptyAttributes(),
    masteries: {} as Growth["masteries"], activityAt: {}, resourceReadyAt: {},
  };
  for (const k of ATTRIBUTES) { g.attributes[k] = integer(raw?.attributes?.[k]); g.pending[k] = integer(raw?.pending?.[k]); }
  if (Object.values(g.pending).reduce((a,b) => a+b,0) > g.unspent) g.pending = emptyAttributes();
  for (const k of MASTERIES) {
    const m = raw?.masteries?.[k];
    g.masteries[k] = { level: Math.max(1, integer(m?.level, 1)), xp: integer(m?.xp) };
    while (g.masteries[k].xp >= masteryThreshold(g.masteries[k].level)) { g.masteries[k].xp -= masteryThreshold(g.masteries[k].level); g.masteries[k].level++; }
    const at = raw?.activityAt?.[k];
    if (typeof at === "number" && Number.isFinite(at)) g.activityAt[k] = at;
  }
  for (const [key, at] of Object.entries(raw?.resourceReadyAt ?? {})) if (typeof at === "number" && Number.isFinite(at)) g.resourceReadyAt[key] = at;
  return g;
}
export const masteryThreshold = (level: number) => BALANCE.masteryBase + BALANCE.masteryStep * (level - 1);
export const curve = (points: number) => Math.max(0, points) / (BALANCE.halfSaturation + Math.max(0, points));
export function effects(a: Attributes) {
  const b = BALANCE;
  return {
    attack: 1 + b.attack * curve(a.strength), health: 1 + b.health * curve(a.vitality),
    resistance: b.resistance * curve(a.vitality), movement: 1 + b.movement * curve(a.agility),
    attackInterval: 1 - b.attackSpeed * curve(a.agility), dodgeCost: 1 - b.dodgeCost * curve(a.agility),
    stamina: 1 + b.stamina * curve(a.endurance), staminaCost: 1 - b.staminaSaving * curve(a.endurance),
    magic: 1 + b.magic * curve(a.intelligence), hunger: 1 - b.hungerSaving * curve(a.survival),
    gatheringTime: 1 - b.gatheringSpeed * curve(a.survival),
  };
}
export function attributeBenefits(a: Attributes, k: Attribute): string {
  const f = effects(a), pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  switch(k) {
    case "strength": return `Physical damage +${pct(f.attack-1)}`;
    case "vitality": return `Max health +${pct(f.health-1)}; resistance ${pct(f.resistance)}`;
    case "agility": return `Movement +${pct(f.movement-1)}; attack interval −${pct(1-f.attackInterval)}; dodge cost −${pct(1-f.dodgeCost)}`;
    case "endurance": return `Max stamina +${pct(f.stamina-1)}; stamina cost −${pct(1-f.staminaCost)}`;
    case "intelligence": return `Magic and healing-potion potency +${pct(f.magic-1)}`;
    case "survival": return `Hunger depletion −${pct(1-f.hunger)}; gathering time −${pct(1-f.gatheringTime)}`;
  }
}
