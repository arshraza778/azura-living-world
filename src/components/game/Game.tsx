import { ATTRIBUTES, ATTRIBUTE_INFO, MASTERIES, attributeBenefits, masteryThreshold } from "@/game/state/growth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Backpack, Compass, Map as MapIcon, ScrollText, User, X, Hammer, Sprout, Fish } from "lucide-react";
import { Engine } from "@/game/engine/engine";
import { REGIONS } from "@/game/data/regions";
import { OUTFITS, HAIR_STYLES, HAIR_COLORS } from "@/game/data/places";
import { ITEMS, REST_PRICE, SHOP_STOCK, type EquipmentSlot } from "@/game/data/items";
import { MISSIONS } from "@/game/data/missions";
import { POIS } from "@/game/data/places";
import {
  stageAttribute, confirmAttributes, cancelAttributes, pendingTotal, abandonMission, acceptMission, attackPower, defencePower, equippedBonus, equipItem, unequipItem, upgradeEquipment, buyItem, closePanel, game, isReady, loadSave, missionProgress, RECIPES, craftRecipe, plantCrop, waterCrop, harvestCrop, catchFish,
  openPanel, resetProgress, rest, sellMaterials, setAppearance, turnInMission, useGame, useItem, xpForLevel,
} from "@/game/state/store";
import { WorldMap } from "./WorldMap";
import { getScene } from "@/game/world/scenes";
import { T } from "@/game/data/tiles";
import { buyMarketListing, cancelMarketListing, createMarketListing, createPlayerGuild, availableGuilds, joinAvailableGuild, leavePlayerGuild, postGuildMessage, renameHome, retrieveFromHome, storeAtHome } from "@/game/state/social";
import { authenticateMultiplayer, disconnectMultiplayer, getMultiplayerState, reconnectMultiplayer, sendNetwork, subscribeMultiplayer, listSharedMarketItem, buySharedMarketItem, cancelSharedMarketItem, createSharedGuild, joinSharedGuild, leaveSharedGuild, postSharedGuildMessage } from "@/game/network/multiplayer";

function Bar({ v, max, kind, label }: { v: number; max: number; kind: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[11px] uppercase tracking-widest text-parchment/70 sm:w-14">{label}</span>
      <div className="bar-track w-24 sm:w-40"><div className={`bar-fill bar-${kind}`} style={{ width: `${Math.max(0, (v / max) * 100)}%` }} /></div>
      <span className="w-12 text-right text-[10px] tabular-nums text-parchment/80 sm:w-14 sm:text-xs">{Math.round(v)}/{max}</span>
    </div>
  );
}

function Frame({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/60 p-4" onClick={closePanel}>
      <div className={`fantasy-panel relative max-h-[86vh] w-full overflow-y-auto p-6 ${wide ? "max-w-6xl" : "max-w-2xl"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-gold">{title}</h2>
          <button className="fantasy-btn px-2" onClick={closePanel} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Hud() {
  const g = useGame();
  const d = g.data;
  const region = REGIONS.find((r) => r.id === g.ui.regionId)!;
  const inside = d.pos.scene !== "overworld";
  const [banner, setBanner] = useState<typeof g.ui.banner>(null);
  useEffect(() => {
    if (!g.ui.banner) return;
    setBanner(g.ui.banner);
    const t = setTimeout(() => setBanner(null), 3200);
    return () => clearTimeout(t);
  }, [g.ui.banner?.key]);
  return (
    <>
      <div className="fantasy-panel absolute left-2 top-2 z-10 space-y-1 p-2 sm:left-4 sm:top-4 sm:space-y-1.5 sm:p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-base text-gold sm:text-lg">{d.name}</span>
          <span className="text-xs text-parchment/80">Lv {d.level} · {d.gold} gold</span>
        </div>
        <Bar v={d.hp} max={d.maxHp} kind="hp" label="Health" />
        <Bar v={d.stamina} max={d.maxStamina} kind="stamina" label="Stamina" />
        <Bar v={d.hunger} max={100} kind="hunger" label="Hunger" />
        <div className="bar-track h-1"><div className="bar-fill bar-xp" style={{ width: `${(d.xp / xpForLevel(d.level)) * 100}%` }} /></div>
      </div>
      <div className="fantasy-panel absolute left-1/2 top-36 z-10 max-w-[92vw] -translate-x-1/2 px-3 py-1.5 text-center sm:top-4 sm:max-w-none sm:px-5 sm:py-2">
        <div className="truncate font-display text-sm text-gold sm:text-base">{inside ? g.ui.sceneName : region.name}</div>
        <div className="text-[11px] uppercase tracking-widest text-parchment/70">
          {inside ? "Interior" : region.subtitle} · <span className={`danger-${inside ? 1 : region.danger}`}>Danger {"◆".repeat(inside ? 1 : region.danger)}</span>
        </div>
      </div>
      <div className="absolute right-4 top-16 z-10 hidden gap-2 sm:flex">
        <button className="fantasy-btn" onClick={() => openPanel("market")}>Marketplace</button>
        <button className="fantasy-btn" onClick={() => openPanel("communityGuild")}>Guilds</button>
        <button className="fantasy-btn" onClick={() => openPanel("multiplayer")}>Multiplayer</button>
      </div>
      <button className="fantasy-panel absolute right-4 top-4 z-10 hidden items-center gap-2 px-3 py-2 text-sm text-parchment sm:flex" onClick={() => openPanel("map")}>
        <Compass size={16} className="text-gold" /> World Map <kbd className="kbd">M</kbd>
      </button>
      {banner && (
        <div key={banner.key} className="region-banner pointer-events-none absolute left-1/2 top-1/4 z-20 -translate-x-1/2 text-center">
          <div className="font-display text-5xl text-gold drop-shadow-lg">{banner.title}</div>
          <div className="mt-1 text-lg italic text-parchment">{banner.sub}</div>
        </div>
      )}
      {g.ui.prompt && !g.ui.panel && (
        <div className="fantasy-panel absolute bottom-60 left-1/2 z-10 max-w-[92vw] -translate-x-1/2 px-4 py-2 text-center text-sm text-parchment sm:bottom-24">
          <kbd className="kbd hidden sm:inline">E</kbd> {g.ui.prompt}
        </div>
      )}
      <div className="absolute bottom-40 left-1/2 z-10 flex max-w-[96vw] -translate-x-1/2 gap-1 overflow-x-auto px-1 sm:bottom-4 sm:gap-2">
        {([["inventory", Backpack, "Inventory", "I"], ["character", User, "Character", "C"], ["quests", ScrollText, "Missions", "J"], ["map", MapIcon, "Map", "M"]] as const).map(([p, Icon, label, key]) => (
          <button key={p} className="fantasy-btn flex shrink-0 items-center gap-2" onClick={() => openPanel(p)}><Icon size={16} /> <span className="hidden sm:inline">{label}</span> <kbd className="kbd hidden sm:inline">{key}</kbd></button>
        ))}
        <button className="fantasy-btn flex shrink-0 items-center gap-1" onClick={() => openPanel("shop")}><Fish size={15}/> <span className="hidden sm:inline">Fish</span></button>
        {(["bread", "herb"] as const).map((id) => (
          <button key={id} className="fantasy-btn shrink-0 whitespace-nowrap text-xs sm:text-sm" disabled={!d.inventory[id]} onClick={() => useItem(id)}>{ITEMS[id].name} ×{d.inventory[id] ?? 0}</button>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-10 hidden text-[11px] leading-5 text-parchment/70 lg:block">
        WASD / Arrows move · Shift sprint · Click / F attack · Space dodge · E interact · I inventory · C character
      </div>
      <div className="absolute right-2 top-14 z-20 flex w-52 max-w-[62vw] flex-col gap-2 sm:right-4 sm:top-20 sm:w-72 sm:max-w-none">
        {g.ui.toasts.map((t) => <div key={t.id} className={`fantasy-panel toast-${t.tone} px-3 py-2 text-sm`}>{t.text}</div>)}
      </div>
    </>
  );
}

function Crafting() {
  const g = useGame(); const d = g.data;
  const [category, setCategory] = useState("All");
  const categories = ["All", "Weapons", "Armour", "Tools", "Potions", "Food"];
  const recipes = Object.entries(RECIPES).filter(([id, r]) => (d.discoveredRecipes ?? []).includes(id) && (category === "All" || r.category === category));
  return <Frame title="Crafting · Blacksmith & Alchemist" wide>
    <p className="mb-3 text-sm text-parchment/70">Use gathered materials at the Eldergrove workbenches. Crafting consumes ingredients from your shared inventory.</p>
    <div className="mb-4 flex flex-wrap gap-2">{categories.map(c => <button key={c} className={category===c?"fantasy-btn-primary":"fantasy-btn"} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="grid gap-3 md:grid-cols-2">{recipes.map(([id,r])=>{const ready=Object.entries(r.ingredients).every(([it,n])=>(d.inventory[it]??0)>=n);return <div key={id} className="parchment-card p-3"><div className="font-display text-lg">{ITEMS[r.result]?.icon} {r.name}</div><div className="my-2 text-xs">Ingredients: {Object.entries(r.ingredients).map(([it,n])=>`${ITEMS[it]?.icon??"•"} ${ITEMS[it]?.name??it} ${d.inventory[it]??0}/${n}`).join(" · ")}</div><div className="mb-2 text-xs opacity-70">Crafting time: {r.time}s · Result: {r.count}× {ITEMS[r.result]?.name??r.result}</div><button className="fantasy-btn-primary" disabled={!ready} onClick={()=>craftRecipe(id)}>{ready?"Craft":"Missing materials"}</button></div>})}</div>
  </Frame>;
}
function Farming() {
  const g=useGame(); const d=g.data; const plots=d.farmPlots??[];
  const [crop,setCrop]=useState("wheat"); const seeds=["wheat","carrot","potato","herb"];
  return <Frame title="Eldergrove Community Farm" wide>
    <p className="mb-3 text-sm text-parchment/70">Plant seeds, water crops with your watering can, then return after they grow. Growth continues while you are away.</p>
    <div className="mb-3 flex flex-wrap gap-2">{seeds.map(x=><button key={x} className={crop===x?"fantasy-btn-primary":"fantasy-btn"} onClick={()=>setCrop(x)}>{ITEMS[x]?.icon} {x}</button>)}</div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{plots.map((plot,i)=>{const ready=!!plot.crop&&Date.now()-plot.plantedAt>=(plot.watered?90000:180000);return <div key={i} className="parchment-card p-4"><div className="font-display">Plot {i+1}</div><div className="my-3 text-3xl">{plot.crop?(ready?"🌾":"🌱"):"🟫"}</div><div className="mb-2 text-sm">{plot.crop?`${plot.crop} · ${ready?"Ready to harvest":plot.watered?"Growing · watered":"Growing · needs water"}`:"Empty plot"}</div>{!plot.crop?<button className="fantasy-btn-primary" disabled={!(d.inventory[`${crop}_seeds`]??0)} onClick={()=>plantCrop(i,crop)}>Plant ({d.inventory[`${crop}_seeds`]??0} seeds)</button>:<div className="flex flex-wrap gap-2"><button className="fantasy-btn" onClick={()=>waterCrop(i)}>Water</button><button className="fantasy-btn-primary" onClick={()=>harvestCrop(i)} disabled={!ready}>Harvest</button></div>}</div>})}</div>
    <div className="mt-4 text-xs text-parchment/60">Seeds are available from exploration and the village supply basket. Starter seed packets are included in the farm chest.</div>
  </Frame>;
}
function Fishing() {
  const g=useGame(); const pos=g.data.pos; const scene=useMemo(()=>getScene(pos.scene),[pos.scene]); const nearWater=scene.id === "overworld" && [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].some(([dx,dy])=>scene.ground[(Math.floor(pos.y)+dy)*scene.w+Math.floor(pos.x)+dx]===T.WATER);
  const [phase,setPhase]=useState<"idle"|"waiting"|"bite">("idle");
  useEffect(()=>{if(phase!=="waiting")return;const t=setTimeout(()=>setPhase("bite"),1800+Math.random()*2600);return()=>clearTimeout(t)},[phase]);
  return <Frame title="Fishing by the Eldergrove Brook"><p className="mb-4 text-parchment">Cast your line and watch for a bite. Reel in quickly when the float dips.</p>{nearWater && phase==="idle"?<button className="fantasy-btn-primary" onClick={()=>setPhase("waiting")}>🎣 Cast line</button>:nearWater && phase==="waiting"?<button className="fantasy-btn" disabled>Waiting for a bite…</button>:nearWater?<button className="fantasy-btn-primary" onClick={()=>{catchFish();setPhase("idle")}}>Reel in!</button>:null}<p className="mt-3 text-xs text-parchment/60">Requires a fishing rod. Fish are added to your regular inventory.</p></Frame>;
}

function Dialogue() {
  const g = useGame();
  const dl = g.ui.dialogue!;
  const d = g.data;
  const last = dl.page >= dl.lines.length - 1;
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-6">
      <div className="fantasy-panel w-full max-w-3xl p-5">
        <div className="font-display text-xl text-gold">{dl.name} {dl.title && <span className="text-sm text-parchment/60">— {dl.title}</span>}</div>
        <p className="mt-2 text-lg leading-relaxed text-parchment">{dl.lines[dl.page]}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(dl.role === "blacksmith" || dl.role === "alchemist") && <button className="fantasy-btn-primary" onClick={() => openPanel("crafting")}>Open {dl.role === "blacksmith" ? "Blacksmith Forge" : "Alchemy Bench"}</button>}
          {dl.role === "receptionist" && <button className="fantasy-btn-primary" onClick={() => openPanel("guild")}>Open Mission Board</button>}
          {dl.role === "merchant" && <>
            <button className="fantasy-btn-primary" onClick={() => openPanel("market")}>Open Marketplace</button>
            {SHOP_STOCK.map((s) => <button key={s.id} className="fantasy-btn" onClick={() => buyItem(s.id, s.price)}>Buy {ITEMS[s.id].name} ({s.price}g)</button>)}
            <button className="fantasy-btn-primary" onClick={sellMaterials}>Sell materials</button>
          </>}
          {dl.role === "innkeeper" && <button className="fantasy-btn-primary" onClick={() => rest(REST_PRICE)}>Rest ({REST_PRICE}g) — you have {d.gold}g</button>}
          {!last && <button className="fantasy-btn" onClick={() => { dl.page++; g.version++; openPanel("dialogue"); openPanel("dialogue"); }}>Next</button>}
          <button className="fantasy-btn" onClick={closePanel}>Farewell</button>
        </div>
      </div>
    </div>
  );
}

function MissionCard({ id, board }: { id: string; board: boolean }) {
  const g = useGame();
  const m = MISSIONS.find((x) => x.id === id)!;
  const st = g.data.missions[id];
  const pr = missionProgress(m);
  const inGuild = g.data.pos.scene === "guild";
  return (
    <div className="parchment-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg">{m.title}</div>
          <div className="text-xs uppercase tracking-widest opacity-70">Rank {m.rank} · {m.category} · from {m.giver}</div>
        </div>
        <span className="rank-seal">{m.rank}</span>
      </div>
      <p className="mt-2 text-sm">{m.description}</p>
      <div className="mt-2 text-sm font-semibold">Reward: {m.reward.xp} XP · {m.reward.gold} gold{m.reward.items ? " · " + Object.entries(m.reward.items).map(([k, n]) => `${n}× ${ITEMS[k].name}`).join(", ") : ""}</div>
      {st?.status === "active" && <div className="mt-2 text-sm">Progress: {pr.cur}/{pr.max}</div>}
      <div className="mt-3 flex gap-2">
        {!st && board && <button className="fantasy-btn-primary" onClick={() => acceptMission(id)}>Accept</button>}
        {st?.status === "active" && isReady(m) && (inGuild ? <button className="fantasy-btn-primary" onClick={() => turnInMission(id)}>Turn in</button> : <span className="text-sm italic">Return to the Guild to claim</span>)}
        {st?.status === "active" && <button className="fantasy-btn" onClick={() => abandonMission(id)}>Abandon</button>}
        {st?.status === "done" && <span className="text-sm font-semibold">✓ Completed</span>}
      </div>
    </div>
  );
}

function GuildBoard() {
  const [cat, setCat] = useState<"hunt" | "explore" | "dungeon">("hunt");
  return (
    <Frame title="Adventurers' Guild — Mission Board" wide>
      <div className="mb-4 flex gap-2">
        {(["hunt", "explore", "dungeon"] as const).map((c) => (
          <button key={c} className={cat === c ? "fantasy-btn-primary" : "fantasy-btn"} onClick={() => setCat(c)}>{c === "hunt" ? "Monster Hunts" : c === "explore" ? "Exploration" : "Dungeon"}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{MISSIONS.filter((m) => m.category === cat).map((m) => <MissionCard key={m.id} id={m.id} board />)}</div>
    </Frame>
  );
}

function Quests() {
  const g = useGame();
  const ids = Object.keys(g.data.missions);
  return (
    <Frame title="Mission Log">
      <p className="mb-3 text-sm text-parchment/80">Regions discovered: {g.data.discoveredRegions.length}/6 · Places found: {g.data.discoveredPois.length}/{POIS.length + 1}</p>
      {ids.length === 0 ? <p className="text-parchment">No missions yet. Visit the Adventurers' Guild in Eldergrove.</p> : <div className="grid gap-3">{ids.map((id) => <MissionCard key={id} id={id} board={false} />)}</div>}
    </Frame>
  );
}

function Inventory() {
  const g = useGame();
  const entries = Object.entries(g.data.inventory);
  return (
    <Frame title="Inventory">
      <p className="mb-3 text-sm text-gold">{g.data.gold} gold · Equipped attack {attackPower(g.data)} · Defence {defencePower(g.data)} · Bonus HP {equippedBonus(g.data, "healthBonus")} · Bonus stamina {equippedBonus(g.data, "staminaBonus")}</p>
      <div className="mb-3 flex flex-wrap gap-2">{(["weapon", "helmet", "chest", "gloves", "boots", "accessory"] as EquipmentSlot[]).map((slot) => <span key={slot} className="rounded border border-gold/30 px-2 py-1 text-xs capitalize">{slot}: {g.data.equipment?.[slot] ? ITEMS[g.data.equipment[slot]!]?.name : "Empty"}</span>)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {entries.length === 0 && <p className="text-parchment">Your pack is empty.</p>}
        {entries.map(([id, n]) => {
          const it = ITEMS[id];
          if (!it) return null;
          const equipped = Object.values(g.data.equipment ?? {}).includes(id);
          const upgrade = g.data.equipmentUpgrades?.[id] ?? 0;
          const rarity = it.rarity ?? "Common";
          const rarityColor = rarity === "Epic" ? "#b58cff" : rarity === "Rare" ? "#72c9ff" : rarity === "Legendary" ? "#ffb84d" : rarity === "Mythical" ? "#ff72da" : "#d8d0bb";
          return (
            <div key={id} className="parchment-card p-3">
              <div className="mb-1 flex items-center justify-between gap-2"><div className="font-display">{it.icon} {it.name} ×{n}</div><span className="text-[10px] font-bold uppercase" style={{ color: rarityColor }}>{rarity}</span></div>
              <div className="text-xs opacity-80">{it.description}</div>
              {it.slot && <div className="mt-1 text-xs">{it.slot} · ATK +{it.attack ?? 0} · DEF +{it.defence ?? 0} · HP +{it.healthBonus ?? 0} · STA +{it.staminaBonus ?? 0}{upgrade ? ` · Upgrade +${upgrade}` : ""}</div>}
              {it.use && <button className="fantasy-btn-primary mt-2" onClick={() => useItem(id)}>Use</button>}
              {it.slot && <div className="mt-2 flex flex-wrap gap-2"><button className={equipped ? "fantasy-btn-primary" : "fantasy-btn"} onClick={() => equipped ? unequipItem(it.slot as EquipmentSlot) : equipItem(id)}>{equipped ? "Unequip" : "Equip"}</button><button className="fantasy-btn" onClick={() => upgradeEquipment(id)} disabled={(g.data.equipmentUpgrades?.[id] ?? 0) >= (it.upgradeMax ?? 5)}>Upgrade (+{upgrade})</button></div>}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

export function Character() {
  const g = useGame();
  const d = g.data;
  const kills = Object.values(d.kills).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <Frame title="Character">
      <div className="mb-5 grid grid-cols-2 gap-3 text-parchment">
        {[["Name", d.name], ["Level", d.level], ["Experience", `${d.xp}/${xpForLevel(d.level)}`], ["Attack", attackPower(d)], ["Max health", d.maxHp], ["Max stamina", d.maxStamina], ["Defence", defencePower(d)], ["Gold", d.gold], ["Monsters slain", kills], ["Regions", `${d.discoveredRegions.length}/6`], ["Location", d.pos.scene === "overworld" ? REGIONS.find((r) => r.id === g.ui.regionId)?.name : g.ui.sceneName]].map(([k, v]) => (
          <div key={String(k)} className="parchment-card px-3 py-2"><div className="text-xs uppercase opacity-70">{k}</div><div className="font-display text-lg">{v}</div></div>
        ))}
      </div>
      <section className="mb-5 border-t border-gold/30 pt-4 text-parchment" aria-label="Attributes">
        <h3 className="font-display text-xl text-gold">Attributes</h3>
        <p className="my-3" role="status">Available points: {d.growth.unspent - pendingTotal()} · Pending: {pendingTotal()}</p>
        <p className="mb-3 text-xs text-parchment/70">Earn 3 points each level. Pending choices are saved but have no effect until confirmed. Scaling has diminishing returns.</p>
        {ATTRIBUTES.map(key => {
          const preview = { ...d.growth.attributes };
          for (const k of ATTRIBUTES) preview[k] += d.growth.pending[k];
          const next = { ...preview, [key]: preview[key] + 1 };
          return <div key={key} className="parchment-card mb-2 p-3">
            <div className="flex items-center justify-between gap-2"><strong>{ATTRIBUTE_INFO[key].name}: {d.growth.attributes[key]}{d.growth.pending[key] > 0 ? ` (+${d.growth.pending[key]} pending)` : ""}</strong>
              <button className="fantasy-btn" aria-label={`Add ${ATTRIBUTE_INFO[key].name}`} disabled={pendingTotal() >= d.growth.unspent} onClick={() => stageAttribute(key)}>+</button></div>
            <p className="text-sm">{ATTRIBUTE_INFO[key].description}</p>
            <p className="mt-1 text-xs">Preview: {attributeBenefits(preview, key)}</p>
            <p className="text-xs">Next point: {attributeBenefits(next, key)}</p>
          </div>;
        })}
        <div className="mt-3 flex gap-2"><button className="fantasy-btn-primary" disabled={!pendingTotal()} onClick={confirmAttributes}>Confirm allocations</button><button className="fantasy-btn" disabled={!pendingTotal()} onClick={cancelAttributes}>Cancel allocations</button></div>
      </section>
      <section className="mb-5 border-t border-gold/30 pt-4 text-parchment" aria-label="Masteries">
        <h3 className="mb-3 font-display text-xl text-gold">Masteries</h3>
        {MASTERIES.map(key => { const m = d.growth.masteries[key]; return <div key={key} className="mb-3">
          <div className="flex justify-between text-sm"><span className="capitalize">{key} Mastery · Level {m.level}</span><span>{m.xp}/{masteryThreshold(m.level)} XP</span></div>
          <progress className="w-full accent-amber-500" aria-label={`${key} mastery experience`} value={m.xp} max={masteryThreshold(m.level)} />
          {key === "magic" && <p className="text-xs text-parchment/60">Foundation ready. No spell gameplay yet; no passive XP is awarded.</p>}
        </div>; })}
      </section>
      <div className="border-t border-gold/30 pt-4 text-parchment">
        <h3 className="mb-3 font-display text-xl text-gold">Appearance</h3>
        <p className="mb-3 text-sm text-parchment/70">Changes are previewed on your character immediately and saved locally.</p>
        <label className="mb-1 block text-xs uppercase tracking-wider">Outfit</label>
        <select className="mb-3 w-full rounded border border-gold/30 bg-ink px-3 py-2" value={d.appearance.outfit} onChange={(e) => setAppearance({ outfit: e.target.value })}>{OUTFITS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <label className="mb-1 block text-xs uppercase tracking-wider">Hairstyle</label>
        <select className="mb-3 w-full rounded border border-gold/30 bg-ink px-3 py-2" value={d.appearance.hairStyle} onChange={(e) => setAppearance({ hairStyle: e.target.value as typeof d.appearance.hairStyle })}>{HAIR_STYLES.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
        <label className="mb-1 block text-xs uppercase tracking-wider">Hair colour</label>
        <div className="mb-2 flex flex-wrap gap-2">{HAIR_COLORS.map((color) => <button key={color} title={color} aria-label={`Hair colour ${color}`} onClick={() => setAppearance({ hairColor: color })} className={`h-8 w-8 rounded-full border-2 ${d.appearance.hairColor === color ? "border-gold ring-2 ring-gold/40" : "border-parchment/30"}`} style={{ backgroundColor: color }} />)}</div>
      </div>
      <button className="fantasy-btn mt-5" onClick={() => { if (confirm("Erase all progress and restart?")) resetProgress(); }}>Reset progress</button>
    </Frame>
  );
}

function HomePanel() {
  const g = useGame(); const d = g.data;
  const [homeName, setHomeName] = useState(d.housing.homeName);
  return <Frame title={d.housing.homeName || "Your Home"} wide>
    <p className="mb-3 text-sm text-parchment/70">Your Eldergrove cottage is a safe place to rest and keep belongings. Stored items remain in your local save.</p>
    <div className="mb-4 flex flex-wrap items-end gap-2"><label className="flex-1 text-xs text-parchment/70">Home name<input className="mt-1 w-full rounded border border-gold/30 bg-ink px-3 py-2 text-parchment" value={homeName} maxLength={28} onChange={e=>setHomeName(e.target.value)} /></label><button className="fantasy-btn" onClick={()=>renameHome(homeName)}>Save name</button><button className="fantasy-btn-primary" onClick={()=>rest(0)}>Rest in bed</button></div>
    <div className="grid gap-4 md:grid-cols-2"><section><h3 className="mb-2 font-display text-lg text-gold">Backpack</h3><div className="max-h-72 space-y-2 overflow-y-auto">{Object.entries(d.inventory).filter(([,n])=>n>0).map(([id,n])=><div key={id} className="parchment-card flex items-center justify-between gap-2 p-2"><span>{ITEMS[id]?.icon} {ITEMS[id]?.name ?? id} ×{n}</span><button className="fantasy-btn" onClick={()=>storeAtHome(id,n)}>Store all</button></div>)}</div></section><section><h3 className="mb-2 font-display text-lg text-gold">Home storage</h3><div className="max-h-72 space-y-2 overflow-y-auto">{Object.entries(d.housing.storage).filter(([,n])=>n>0).map(([id,n])=><div key={id} className="parchment-card flex items-center justify-between gap-2 p-2"><span>{ITEMS[id]?.icon} {ITEMS[id]?.name ?? id} ×{n}</span><button className="fantasy-btn" onClick={()=>retrieveFromHome(id,n)}>Take all</button></div>)}{!Object.keys(d.housing.storage).length&&<p className="text-sm text-parchment/60">Your chest is empty.</p>}</div></section></div>
  </Frame>;
}

function Marketplace() {
  const g=useGame(); const d=g.data; const [,refresh]=useState(0); useEffect(()=>subscribeMultiplayer(()=>refresh(n=>n+1)),[]); const net=getMultiplayerState(); const listings=net.status==="online"?net.marketListings:d.marketListings;
  const [itemId,setItemId]=useState(Object.keys(d.inventory).find(id=>(d.inventory[id]??0)>0)??"apple");
  const [quantity,setQuantity]=useState("1"); const [price,setPrice]=useState("5");
  return <Frame title="Eldergrove Marketplace" wide>
    <p className="mb-3 text-sm text-parchment/70">Browse village vendor offers and create your own listings. When connected, listings and gold/item settlement are shared and validated by the multiplayer server. Offline listings remain local to this browser.</p>{net.error&&<p className="mb-2 text-sm text-red-300" role="alert">{net.error}</p>}
    <div className="parchment-card mb-4 grid gap-2 p-3 md:grid-cols-4"><label className="text-xs">Item<select className="mt-1 w-full rounded bg-ink p-2 text-parchment" value={itemId} onChange={e=>setItemId(e.target.value)}>{Object.entries(d.inventory).filter(([,n])=>n>0).map(([id])=><option key={id} value={id}>{ITEMS[id]?.name??id} ({d.inventory[id]})</option>)}</select></label><label className="text-xs">Quantity<input className="mt-1 w-full rounded bg-ink p-2 text-parchment" type="number" min="1" max={d.inventory[itemId]??1} value={quantity} onChange={e=>setQuantity(e.target.value)} /></label><label className="text-xs">Gold per item<input className="mt-1 w-full rounded bg-ink p-2 text-parchment" type="number" min="1" max="100000" value={price} onChange={e=>setPrice(e.target.value)} /></label><button className="fantasy-btn-primary self-end" disabled={!d.inventory[itemId]} onClick={()=>net.status==="online"?listSharedMarketItem(itemId,Number(quantity),Number(price)):createMarketListing(itemId,Number(quantity),Number(price))}>List item</button></div>
    <div className="grid gap-2 md:grid-cols-2">{listings.map(listing=><div key={listing.id} className="parchment-card p-3"><div className="flex items-start justify-between gap-2"><div><strong>{ITEMS[listing.itemId]?.icon} {ITEMS[listing.itemId]?.name??listing.itemId}</strong><p className="text-xs opacity-70">Seller: {listing.seller} · {listing.sellerType==="village"?"Village vendor":"Player listing"}</p></div><strong>{listing.unitPrice}g each</strong></div><p className="my-2 text-sm">Available: {listing.quantity}</p><div className="flex gap-2">{listing.sellerType==="player"&&listing.seller===d.name?<button className="fantasy-btn" onClick={()=>net.status==="online"?cancelSharedMarketItem(listing.id):cancelMarketListing(listing.id)}>Cancel listing</button>:<button className="fantasy-btn-primary" disabled={d.gold<listing.unitPrice} onClick={()=>net.status==="online"?buySharedMarketItem(listing.id,1):buyMarketListing(listing.id,1)}>Buy 1 · {listing.unitPrice}g</button>}</div></div>)}</div>
  </Frame>;
}

function CommunityGuild() {
  const g=useGame(); const d=g.data; const [name,setName]=useState(""); const [message,setMessage]=useState(""); const [,refresh]=useState(0); useEffect(()=>subscribeMultiplayer(()=>refresh(n=>n+1)),[]); const net=getMultiplayerState(); const activeGuild=net.status==="online"?net.guild:d.guild; const guildOptions=net.status==="online"?net.guilds:availableGuilds;
  return <Frame title="Guild Hall & Fellowship" wide>
    {!activeGuild?.id?<><p className="mb-3 text-sm text-parchment/70">Join a frontier company or spend 100 gold to establish your own guild. When connected, guild membership, roster and messages are shared and persisted by the multiplayer server; offline guilds remain local.</p>{net.error&&<p className="mb-2 text-sm text-red-300" role="alert">{net.error}</p>}<div className="parchment-card mb-4 p-3"><h3 className="mb-2 font-display text-lg text-gold">Found a guild</h3><div className="flex gap-2"><input className="min-w-0 flex-1 rounded bg-ink px-3 py-2 text-parchment" placeholder="Guild name" maxLength={28} value={name} onChange={e=>setName(e.target.value)} /><button className="fantasy-btn-primary" onClick={()=>net.status==="online"?createSharedGuild(name):createPlayerGuild(name)}>Create · 100g</button></div></div><h3 className="mb-2 font-display text-lg text-gold">Frontier guilds recruiting</h3>{guildOptions.map(item=><div key={item.id} className="parchment-card mb-2 flex items-center justify-between gap-2 p-3"><div><strong>{item.name}</strong><p className="text-xs opacity-70">Leader: {item.leader} · {item.members} members</p></div><button className="fantasy-btn-primary" onClick={()=>net.status==="online"?joinSharedGuild(item.id):joinAvailableGuild(item.id)}>Join guild</button></div>)}</>:<><div className="mb-3 flex items-center justify-between"><div><h3 className="font-display text-xl text-gold">{activeGuild?.name}</h3><p className="text-xs text-parchment/70">Your rank: {activeGuild?.role}</p></div><button className="fantasy-btn" onClick={()=>net.status==="online"?leaveSharedGuild():leavePlayerGuild()}>Leave guild</button></div><div className="grid gap-4 md:grid-cols-2"><section><h4 className="mb-2 font-display text-lg text-gold">Roster</h4>{activeGuild?.members.map(member=><div key={member.id} className="parchment-card mb-2 flex justify-between p-2"><span>{member.name}</span><span className="text-xs capitalize">{member.role}</span></div>)}</section><section><h4 className="mb-2 font-display text-lg text-gold">Guild notice board</h4><div className="mb-2 max-h-52 space-y-2 overflow-y-auto">{activeGuild?.messages.map(m=><div key={m.id} className="parchment-card p-2"><strong className="text-xs">{m.author}</strong><p className="text-sm">{m.text}</p></div>)}{!activeGuild?.messages.length&&<p className="text-sm text-parchment/60">No messages yet. Leave a note for your company.</p>}</div><form className="flex gap-2" onSubmit={e=>{e.preventDefault();(net.status==="online"?postSharedGuildMessage(message):postGuildMessage(message));setMessage("")}}><input className="min-w-0 flex-1 rounded bg-ink px-3 py-2 text-parchment" maxLength={240} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a guild notice"/><button className="fantasy-btn-primary" type="submit" disabled={!message.trim()}>Post</button></form></section></div></>}
  </Frame>;
}

function MultiplayerPanel() {
  const [, refresh] = useState(0); const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [register,setRegister]=useState(false); const [chat,setChat]=useState("");
  useEffect(()=>{const unsub=subscribeMultiplayer(()=>refresh(n=>n+1));reconnectMultiplayer();return unsub},[]);
  const net=getMultiplayerState(); const sendChat=(e:React.FormEvent)=>{e.preventDefault();if(chat.trim()){sendNetwork({type:"chat",text:chat});setChat("")}};
  return <Frame title="Azura — Shared World" wide>
    <p className="mb-3 text-sm text-parchment/70">Connect to a running Azura multiplayer service to meet other adventurers. Accounts are stored on that server; your character inventory and gold are synchronised to the server when you first connect; other progression remains in your local save.</p>
    <div className="mb-4 flex flex-wrap items-center gap-3"><span className={`rounded px-3 py-1 text-sm ${net.status==="online"?"bg-emerald-900 text-emerald-100":"bg-slate-800 text-parchment"}`}>● {net.status}</span>{net.latency!=null&&<span className="text-xs text-parchment/70">Ping {net.latency} ms</span>}{net.username&&<span className="text-sm text-parchment">Signed in as {net.username}</span>}{net.status==="online"&&<button className="fantasy-btn" onClick={disconnectMultiplayer}>Sign out</button>}</div>
    {net.status!=="online"&&<form className="parchment-card mb-4 grid gap-2 p-3 md:grid-cols-3" onSubmit={e=>{e.preventDefault();authenticateMultiplayer(username,password,register)}}><label className="text-xs">Username<input className="mt-1 w-full rounded bg-ink px-3 py-2 text-parchment" minLength={3} maxLength={20} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></label><label className="text-xs">Password<input className="mt-1 w-full rounded bg-ink px-3 py-2 text-parchment" type="password" minLength={8} maxLength={128} autoComplete={register?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} required /></label><div className="flex items-end gap-2"><button className="fantasy-btn-primary" type="submit">{register?"Create account":"Sign in"}</button><button className="fantasy-btn" type="button" onClick={()=>setRegister(v=>!v)}>{register?"I have an account":"Register"}</button></div></form>}
    {net.notice&&<p className="mb-3 text-sm text-gold" role="status">{net.notice}</p>}{net.error&&<p className="mb-3 text-sm text-red-300" role="alert">{net.error}</p>}
    {net.status==="online"&&<div className="grid gap-4 md:grid-cols-2"><section><h3 className="mb-2 font-display text-lg text-gold">Adventurers nearby ({net.players.length})</h3><div className="max-h-56 space-y-2 overflow-y-auto">{net.players.map(p=><div key={p.id} className="parchment-card flex items-center justify-between gap-2 p-2"><span>{p.name} <span className="text-xs text-parchment/60">· {Math.round(p.hp??100)}/{p.maxHp??100} HP{p.action==="dead"?" · fallen":p.action==="attack"?" · fighting":""}</span></span><button className="fantasy-btn" disabled={!!net.party} onClick={()=>sendNetwork({type:"party:invite",targetId:p.id})}>Invite to party</button></div>)}{!net.players.length&&<p className="text-sm text-parchment/60">No other players are in this area yet.</p>}</div><div className="mt-3 flex flex-wrap gap-2">{!net.party?<button className="fantasy-btn-primary" onClick={()=>sendNetwork({type:"party:create"})}>Create party</button>:<button className="fantasy-btn" onClick={()=>sendNetwork({type:"party:leave"})}>Leave party ({net.party.members.length}/5)</button>}{net.invitation&&<button className="fantasy-btn-primary" onClick={()=>{sendNetwork({type:"party:accept",partyId:net.invitation!.partyId});refresh(n=>n+1)}}>Accept invite from {net.invitation.from}</button>}</div>{net.party&&<p className="mt-2 text-xs text-parchment/70">Party members: {net.party.members.length} · Party formed</p>}</section><section><h3 className="mb-2 font-display text-lg text-gold">Local area chat</h3><div className="mb-2 h-56 space-y-2 overflow-y-auto rounded border border-gold/20 bg-ink/40 p-3">{net.messages.filter(m=>m.scene===game.data.pos.scene).map(m=><p key={m.id} className="text-sm"><strong className="text-gold">{m.name}: </strong><span className="text-parchment">{m.text}</span></p>)}{!net.messages.length&&<p className="text-sm text-parchment/50">No messages yet.</p>}</div><form className="flex gap-2" onSubmit={sendChat}><input className="min-w-0 flex-1 rounded bg-ink px-3 py-2 text-parchment" maxLength={240} value={chat} onChange={e=>setChat(e.target.value)} placeholder="Say something to nearby players"/><button className="fantasy-btn-primary" type="submit" disabled={!chat.trim()}>Send</button></form></section></div>}
    <p className="mt-4 text-xs text-parchment/50">Server address: {import.meta.env["VITE_AZURA_SERVER_URL"] || "http://localhost:8787"}. The server must be started separately; see MULTIPLAYER.md.</p>
  </Frame>;
}

function tapKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  window.dispatchEvent(new KeyboardEvent("keyup", { key }));
}

function TouchControls() {
  const [show, setShow] = useState(false);
  const base = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const active = useRef<Set<string>>(new Set());

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setShow(mq.matches || window.innerWidth < 768);
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => { mq.removeEventListener("change", update); window.removeEventListener("resize", update); };
  }, []);

  const setDirs = (dx: number, dy: number) => {
    const next = new Set<string>();
    if (dx < -0.35) next.add("a");
    if (dx > 0.35) next.add("d");
    if (dy < -0.35) next.add("w");
    if (dy > 0.35) next.add("s");
    if (Math.hypot(dx, dy) > 0.92) next.add("shift");
    for (const k of active.current) if (!next.has(k)) window.dispatchEvent(new KeyboardEvent("keyup", { key: k }));
    for (const k of next) if (!active.current.has(k)) window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
    active.current = next;
  };

  const move = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return;
    const r = base.current!.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
    setDirs(dx, dy);
  };

  const end = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    if (knobRef.current) knobRef.current.style.transform = "translate(-50%, -50%)";
    setDirs(0, 0);
  };

  if (!show) return null;
  const btn = "fantasy-btn flex items-center justify-center rounded-full text-xl";
  return (
    <>
      <div ref={base} className="absolute bottom-6 left-4 z-10 h-32 w-32 rounded-full border-2 border-gold/40 bg-ink/40" style={{ touchAction: "none" }}
        onPointerDown={(e) => { pid.current = e.pointerId; base.current!.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div ref={knobRef} className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/60 bg-gold/30" />
      </div>
      <div className="absolute bottom-6 right-4 z-10 flex items-end gap-3" style={{ touchAction: "none" }}>
        <div className="flex flex-col gap-3">
          <button aria-label="Interact" className={`${btn} h-14 w-14`} onPointerDown={(e) => { e.preventDefault(); tapKey("e"); }}>✋</button>
          <button aria-label="Dodge" className={`${btn} h-14 w-14`} onPointerDown={(e) => { e.preventDefault(); tapKey(" "); }}>💨</button>
        </div>
        <button aria-label="Attack" className={`${btn} fantasy-btn-primary h-20 w-20 text-2xl`} onPointerDown={(e) => { e.preventDefault(); tapKey("f"); }}>⚔️</button>
      </div>
    </>
  );
}

export function Game() {
  const ref = useRef<HTMLCanvasElement>(null);
  const g = useGame();
  useEffect(() => {
    loadSave();
    const e = new Engine(ref.current!);
    return () => e.destroy();
  }, []);
  return (
    <div className="relative h-screen w-screen touch-none overflow-hidden bg-ink font-body select-none">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1">
        {([["+", 1.2, "Zoom in"], ["−", 1 / 1.2, "Zoom out"], ["⟳", 0, "Reset zoom"]] as const).map(([l, f, t]) => (
          <button key={t} aria-label={t} title={t} className="fantasy-btn h-9 w-9 p-0" onClick={() => window.dispatchEvent(new CustomEvent("azura:zoom", { detail: f }))}>{l}</button>
        ))}
      </div>
      <Hud />
      <TouchControls />
      {g.ui.panel === "dialogue" && g.ui.dialogue && <Dialogue />}
      {g.ui.panel === "guild" && <GuildBoard />}
      {g.ui.panel === "home" && <HomePanel />}
      {g.ui.panel === "market" && <Marketplace />}
      {g.ui.panel === "communityGuild" && <CommunityGuild />}
      {g.ui.panel === "multiplayer" && <MultiplayerPanel />}
      {g.ui.panel === "quests" && <Quests />}
      {g.ui.panel === "inventory" && <Inventory />}
      {g.ui.panel === "crafting" && <Crafting />}
      {g.ui.panel === "farming" && <Farming />}
      {g.ui.panel === "shop" && <Fishing />}
      {g.ui.panel === "character" && <Character />}
      {g.ui.panel === "map" && <Frame title="Azura — World Map" wide><WorldMap /></Frame>}
    </div>
  );
}

export { game };
