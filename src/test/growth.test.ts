import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ATTRIBUTES, MASTERIES, BALANCE, effects, emptyAttributes, migrateGrowth, masteryThreshold } from "../game/state/growth";
import { game, defaultData, addXp, xpForLevel, stageAttribute, confirmAttributes, cancelAttributes, pendingTotal, loadSave, save, attackPower, incomingDamage, staminaCost, magicDamage, recalculateStats, statEffects, useItem, equipItem, unequipItem, upgradeEquipment, gatherResource, craftRecipe, plantCrop, waterCrop, harvestCrop, catchFish, addMasteryXp, acceptMission, turnInMission, rest, buyItem, sellMaterials } from "../game/state/store";
import { Engine } from "../game/engine/engine";
import { REGIONS } from "../game/data/regions";
import { MONSTERS } from "../game/data/monsters";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  localStorage.clear(); game.data = defaultData(); game.ui.panel = null; game.ui.toasts = [];
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const reload = () => { game.data = defaultData(); loadSave(); };
const allocate = (key: typeof ATTRIBUTES[number], n = 1) => {
  game.data.growth.unspent += n;
  for(let i=0;i<n;i++) stageAttribute(key);
  confirmAttributes();
};
// No canvas/render mock replaces gameplay methods. These engine harnesses run real actions/calculations.
const engine = () => {
  const e = Object.create(Engine.prototype) as Engine;
  Object.assign(e, { scene: { id: "overworld", npcs: [], traps: [], triggers: [], dark: 0, region: undefined }, monsters: new Map(), resources: new Map(), drops: [], keys: new Set(), target: null, atkCd: 0, atk: 0, dir: 0, dodge: 0, hurt: 0, trapCd: 0, deathTimer: 0, tint: { dark: 0 }, emitT: 0, saveT: 0, walk: 0 });
  e.blocked = () => false;
  game.data.pos = {scene:"overworld",x:10,y:10};
  return e;
};

describe("level rewards and migration", () => {
  it("awards exactly three once, saves immediately and does not duplicate on repeated loads", () => {
    addXp(xpForLevel(1));
    expect(game.data.level).toBe(2); expect(game.data.growth.unspent).toBe(3);
    expect(game.ui.toasts.some(t=>t.text.includes("+3 attribute points"))).toBe(true);
    reload(); reload(); expect(game.data.growth.unspent).toBe(3);
    addXp(1); expect(game.data.growth.unspent).toBe(3);
  });
  it("handles several level-ups in one award and rejects invalid XP", () => {
    addXp(xpForLevel(1)+xpForLevel(2)+xpForLevel(3)+7);
    expect(game.data.level).toBe(4); expect(game.data.xp).toBe(7); expect(game.data.growth.unspent).toBe(9);
    addXp(NaN); addXp(-99); addXp(Infinity); expect(game.data.xp).toBe(7);
    reload(); expect(game.data.growth.rewardedLevel).toBe(4);
  });
  it("migrates a Phase 5 save without losing items, missions, appearance, exploration or crops", () => {
    const old = JSON.parse(JSON.stringify(defaultData())); delete old.growth;
    Object.assign(old,{level:5,xp:12,gold:123,fishCaught:4});
    old.inventory["kings_sigil"]=1; old.equipmentUpgrades["wooden_sword"]=2;
    old.missions.test={status:"done",base:0}; old.farmPlots[0]={crop:"wheat",plantedAt:Date.now(),watered:true};
    old.discoveredPois.push("old-discovery"); old.openedChests.push("old-chest");
    localStorage.setItem("azura.save.v1", JSON.stringify(old)); loadSave();
    expect(game.data.growth.unspent).toBe(12); expect(game.data.level).toBe(5); expect(game.data.xp).toBe(12);
    for (const k of ["inventory","equipment","equipmentUpgrades","missions","appearance","farmPlots","discoveredPois","openedChests","gold","fishCaught"] as const) expect(game.data[k]).toEqual(old[k]);
    reload(); expect(game.data.growth.unspent).toBe(12);
    expect(Object.keys(game.data.growth.masteries)).toHaveLength(7);
  });
  it("sanitizes malformed growth fields and over-budget pending allocations", () => {
    const g=migrateGrowth({unspent:-8,attributes:{strength:NaN} as never,pending:{strength:10} as never},2);
    expect(g.unspent).toBe(0); expect(g.attributes.strength).toBe(0); expect(g.pending.strength).toBe(0);
  });
});

describe("manual allocation", () => {
  it("does not auto-allocate and prevents overspending", () => {
    addXp(50); expect(game.data.growth.attributes).toEqual(emptyAttributes());
    for(let i=0;i<4;i++) stageAttribute("strength");
    expect(pendingTotal()).toBe(3); expect(game.data.growth.attributes.strength).toBe(0);
    expect(confirmAttributes()).toBe(true); expect(game.data.growth.unspent).toBe(0);
    expect(game.data.growth.attributes.strength).toBe(3); expect(confirmAttributes()).toBe(false);
    stageAttribute("vitality"); expect(pendingTotal()).toBe(0);
  });
  it("cancels pending points without spending and persists pending choices on refresh", () => {
    addXp(50); stageAttribute("agility"); stageAttribute("survival"); reload();
    expect(game.data.growth.pending.agility).toBe(1); expect(game.data.growth.attributes.agility).toBe(0);
    cancelAttributes(); reload(); expect(pendingTotal()).toBe(0); expect(game.data.growth.unspent).toBe(3);
    stageAttribute("vitality"); stageAttribute("intelligence"); confirmAttributes(); reload();
    expect(game.data.growth.attributes.vitality).toBe(1); expect(game.data.growth.attributes.intelligence).toBe(1);
    expect(game.data.growth.unspent).toBe(1);
  });
});

describe("gameplay attributes", () => {
  it("Strength increases actual combat damage even for a single point", () => {
    const e=engine(), before=attackPower(game.data); allocate("strength"); expect(attackPower(game.data)).toBeGreaterThan(before);
    const m={kind:"slime",x:10,y:10.6,hp:100,dead:0,hurt:0} as never;
    // Use an authored monster kind rather than assuming a specific name.
    const kind=Object.keys(MONSTERS)[0] as keyof typeof MONSTERS;
    Object.assign(m,{kind}); e.monsters.set("overworld",[m]); e.attack();
    expect((m as {hp:number}).hp).toBeCloseTo(100-attackPower(game.data));
  });
  it("Vitality raises health, reduces incoming damage, and equipment changes preserve attributes", () => {
    const before=incomingDamage(game.data,20); allocate("vitality",10);
    expect(game.data.maxHp).toBeGreaterThan(100); expect(incomingDamage(game.data,20)).toBeLessThan(before);
    const hp=game.data.maxHp; unequipItem("weapon"); equipItem("wooden_sword"); expect(game.data.maxHp).toBe(hp);
  });
  it("Agility changes real movement, attack interval and dodge cost", () => {
    const e=engine(); e.keys.add("d"); e.update(.05); const base=game.data.pos.x-10;
    game.data.pos.x=10; allocate("agility",10); e.update(.05); expect(game.data.pos.x-10).toBeGreaterThan(base);
    e.attack(); expect(e.atkCd).toBeLessThan(.38);
    game.data.stamina=100; e.evade(); expect(100-game.data.stamina).toBeLessThan(18);
  });
  it("Endurance changes real stamina capacity, attack and sprint costs", () => {
    const e=engine(); allocate("endurance",10); expect(game.data.maxStamina).toBeGreaterThan(100);
    game.data.stamina=100; e.attack(); expect(100-game.data.stamina).toBeLessThan(6);
    e.keys.add("d"); e.keys.add("shift"); const s=game.data.stamina; e.update(.05); expect(s-game.data.stamina).toBeLessThan(25*.05);
    expect(staminaCost(game.data,18,true)).toBeLessThan(18);
  });
  it("Survival changes real hunger depletion and gathering duration", () => {
    const e=engine(); allocate("survival",10); game.data.hunger=80; e.update(.05);
    expect(80-game.data.hunger).toBeLessThan(.18*.05);
    const node={id:"test",item:"wood",x:10,y:10,respawn:90,cooldown:0}; e.target={resource:node} as never; e.interact();
    expect(e.gatherTimer).toBeLessThan(.9); vi.advanceTimersByTime(900);
    expect(game.data.inventory["wood"]).toBe(2); expect(game.data.growth.masteries.gathering.xp).toBe(6);
    reload(); expect(game.data.growth.resourceReadyAt["overworld:test"]).toBeGreaterThan(Date.now());
  });
  it("Intelligence changes potion healing now and future spell damage", () => {
    allocate("intelligence",10); game.data.hp=1; useItem("healing_potion");
    expect(game.data.hp).toBeGreaterThan(46); expect(magicDamage(game.data,20)).toBeGreaterThan(20);
  });
  it("uses diminishing returns and bounded bonuses", () => {
    const a=emptyAttributes(); a.strength=1; const low=effects(a).attack-1;
    a.strength=100; const high=effects(a).attack; a.strength=101;
    expect(effects(a).attack-high).toBeLessThan(low);
    for(const k of ATTRIBUTES) a[k]=1e9;
    const f=effects(a); expect(f.attack).toBeLessThan(1.8); expect(f.resistance).toBeLessThan(.35);
    expect(f.movement).toBeLessThan(1.2); expect(f.staminaCost).toBeGreaterThan(.65); expect(f.hunger).toBeGreaterThan(.5);
  });
});

describe("activity-based mastery integration", () => {
  it("character XP awards no mastery XP", () => {
    addXp(1000); for(const k of MASTERIES) expect(game.data.growth.masteries[k]).toEqual({level:1,xp:0});
  });
  it("combat awards mastery only on actual kills, not misses or dead targets", () => {
    const e=engine(), kind=Object.keys(MONSTERS)[0] as keyof typeof MONSTERS;
    e.attack(); expect(game.data.growth.masteries.combat.xp).toBe(0); e.atkCd=0;
    const m={kind,x:10,y:10.6,hp:1,dead:0,hurt:0} as never; e.monsters.set("overworld",[m]); e.attack();
    expect(game.data.growth.masteries.combat.xp).toBeGreaterThan(0); const xp=game.data.growth.masteries.combat.xp;
    e.atkCd=0; e.attack(); expect(game.data.growth.masteries.combat.xp).toBe(xp);
  });
  it("fishing requires a rod and rate limits rewards across refresh", () => {
    delete game.data.inventory["fishing_rod"]; catchFish(); expect(game.data.growth.masteries.fishing.xp).toBe(0);
    game.data.inventory["fishing_rod"]=1; catchFish(); expect(game.data.growth.masteries.fishing.xp).toBe(8);
    reload(); catchFish(); expect(game.data.fishCaught).toBe(1); expect(game.data.growth.masteries.fishing.xp).toBe(8);
    vi.advanceTimersByTime(2000); catchFish(); expect(game.data.growth.masteries.fishing.xp).toBe(16);
  });
  it("gathering XP requires successful gathering and cannot spam mastery", () => {
    delete game.data.inventory["axe"]; gatherResource("wood"); expect(game.data.growth.masteries.gathering.xp).toBe(0);
    game.data.inventory["axe"]=1; gatherResource("wood"); gatherResource("wood"); expect(game.data.growth.masteries.gathering.xp).toBe(6);
  });
  it("crafting awards XP only on completion and respects ingredient requirements", () => {
    craftRecipe("bread"); vi.advanceTimersByTime(4000); expect(game.data.growth.masteries.crafting.xp).toBe(0);
    game.data.inventory["wheat"]=3; const bread=game.data.inventory["bread"];
    craftRecipe("bread"); craftRecipe("bread"); expect(game.data.growth.masteries.crafting.xp).toBe(0);
    vi.advanceTimersByTime(2000); expect(game.data.growth.masteries.crafting.xp).toBe(8); expect(game.data.inventory["bread"]).toBe(bread+2);
    expect(game.data.inventory["wheat"]).toBeUndefined();
  });
  it("farming awards XP only for mature harvests; repeated watering does not accelerate twice", () => {
    plantCrop(0,"wheat"); waterCrop(0); const at=game.data.farmPlots![0].plantedAt;
    vi.advanceTimersByTime(1000); waterCrop(0); expect(game.data.farmPlots![0].plantedAt).toBe(at);
    harvestCrop(0); expect(game.data.growth.masteries.farming.xp).toBe(0);
    vi.advanceTimersByTime(30_000); harvestCrop(0); harvestCrop(0);
    expect(game.data.growth.masteries.farming.xp).toBe(10); expect(game.data.inventory["wheat"]).toBe(3);
  });
  it("exploration awards mastery only on a first discovery, including after reload", () => {
    const e=engine(); e.discoverPoi("new-place","New Place"); e.discoverPoi("new-place","New Place");
    expect(game.data.growth.masteries.exploration.xp).toBe(15);
    reload(); e.discoverPoi("new-place","New Place"); expect(game.data.growth.masteries.exploration.xp).toBe(15);
  });
  it("new regions grant exploration XP exactly once", () => {
    const e=engine(), regionIndex=REGIONS.findIndex(r=>r.id==="verdant");
    e.scene.w=32; e.scene.region=new Uint8Array(32*32).fill(regionIndex);
    game.ui.regionId="eldergrove";
    e.update(.05); const xp=game.data.growth.masteries.exploration.xp;
    expect(xp).toBeGreaterThanOrEqual(20); expect(game.data.discoveredRegions).toContain("verdant");
    reload(); game.ui.regionId="eldergrove"; e.update(.05);
    expect(game.data.growth.masteries.exploration.xp).toBe(xp);
  });
  it("all seven tracks have independent levels/XP and persist, including future magic", () => {
    for(const [i,k] of MASTERIES.entries()) { addMasteryXp(k,25); addMasteryXp(k,20+i); }
    const snapshot=JSON.parse(JSON.stringify(game.data.growth.masteries)); reload();
    expect(game.data.growth.masteries).toEqual(snapshot);
    for(const k of MASTERIES) expect(game.data.growth.masteries[k].level).toBe(2);
    expect(game.data.growth.masteries.magic.xp).toBe(10);
    expect(masteryThreshold(2)).toBeGreaterThan(masteryThreshold(1));
  });
});

describe("existing system smoke regressions", () => {
  it("mission turn-in rewards remain single-use", () => {
    acceptMission("hunt_slime"); game.data.kills["slime"]=3; turnInMission("hunt_slime");
    expect(game.data.missions["hunt_slime"].status).toBe("done");
    expect(game.data.xp).toBe(40); const gold=game.data.gold;
    turnInMission("hunt_slime"); expect(game.data.xp).toBe(40); expect(game.data.gold).toBe(gold);
    reload(); expect(game.data.missions["hunt_slime"].status).toBe("done");
  });
  it("item use, buying, selling, resting and equipment upgrades remain functional", () => {
    game.data.gold=100; buyItem("apple",1); expect(game.data.inventory["apple"]).toBe(5);
    game.data.hunger=20; useItem("apple"); expect(game.data.hunger).toBe(35);
    game.data.hp=1; rest(5); expect(game.data.hp).toBe(game.data.maxHp);
    game.data.inventory["ancient_shard"]=1; upgradeEquipment("wooden_sword"); expect(game.data.equipmentUpgrades["wooden_sword"]).toBe(1);
    game.data.inventory["wood"]=5; const gold=game.data.gold; sellMaterials(); expect(game.data.gold).toBeGreaterThan(gold);
    save(); const d=JSON.stringify(game.data); reload(); expect(JSON.stringify(game.data)).toBe(d);
  });
});
