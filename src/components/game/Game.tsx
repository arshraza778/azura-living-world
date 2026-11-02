import { useEffect, useRef, useState } from "react";
import { Backpack, Compass, Map as MapIcon, ScrollText, User, X } from "lucide-react";
import { Engine } from "@/game/engine/engine";
import { REGIONS } from "@/game/data/regions";
import { ITEMS, REST_PRICE, SHOP_STOCK } from "@/game/data/items";
import { MISSIONS } from "@/game/data/missions";
import { POIS } from "@/game/data/places";
import {
  abandonMission, acceptMission, attackPower, buyItem, closePanel, game, isReady, loadSave, missionProgress,
  openPanel, resetProgress, rest, sellMaterials, turnInMission, useGame, useItem, xpForLevel,
} from "@/game/state/store";
import { WorldMap } from "./WorldMap";

function Bar({ v, max, kind, label }: { v: number; max: number; kind: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[11px] uppercase tracking-widest text-parchment/70">{label}</span>
      <div className="bar-track w-40"><div className={`bar-fill bar-${kind}`} style={{ width: `${Math.max(0, (v / max) * 100)}%` }} /></div>
      <span className="w-14 text-right text-xs tabular-nums text-parchment/80">{Math.round(v)}/{max}</span>
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
      <div className="fantasy-panel absolute left-4 top-4 z-10 space-y-1.5 p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg text-gold">{d.name}</span>
          <span className="text-xs text-parchment/80">Lv {d.level} · {d.gold} gold</span>
        </div>
        <Bar v={d.hp} max={d.maxHp} kind="hp" label="Health" />
        <Bar v={d.stamina} max={d.maxStamina} kind="stamina" label="Stamina" />
        <Bar v={d.hunger} max={100} kind="hunger" label="Hunger" />
        <div className="bar-track h-1"><div className="bar-fill bar-xp" style={{ width: `${(d.xp / xpForLevel(d.level)) * 100}%` }} /></div>
      </div>
      <div className="fantasy-panel absolute left-1/2 top-4 z-10 -translate-x-1/2 px-5 py-2 text-center">
        <div className="font-display text-base text-gold">{inside ? g.ui.sceneName : region.name}</div>
        <div className="text-[11px] uppercase tracking-widest text-parchment/70">
          {inside ? "Interior" : region.subtitle} · <span className={`danger-${inside ? 1 : region.danger}`}>Danger {"◆".repeat(inside ? 1 : region.danger)}</span>
        </div>
      </div>
      <button className="fantasy-panel absolute right-4 top-4 z-10 flex items-center gap-2 px-3 py-2 text-sm text-parchment" onClick={() => openPanel("map")}>
        <Compass size={16} className="text-gold" /> World Map <kbd className="kbd">M</kbd>
      </button>
      {banner && (
        <div key={banner.key} className="region-banner pointer-events-none absolute left-1/2 top-1/4 z-20 -translate-x-1/2 text-center">
          <div className="font-display text-5xl text-gold drop-shadow-lg">{banner.title}</div>
          <div className="mt-1 text-lg italic text-parchment">{banner.sub}</div>
        </div>
      )}
      {g.ui.prompt && !g.ui.panel && (
        <div className="fantasy-panel absolute bottom-24 left-1/2 z-10 -translate-x-1/2 px-4 py-2 text-sm text-parchment">
          <kbd className="kbd">E</kbd> {g.ui.prompt}
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {([["inventory", Backpack, "Inventory", "I"], ["character", User, "Character", "C"], ["quests", ScrollText, "Missions", "J"], ["map", MapIcon, "Map", "M"]] as const).map(([p, Icon, label, key]) => (
          <button key={p} className="fantasy-btn flex items-center gap-2" onClick={() => openPanel(p)}><Icon size={16} /> {label} <kbd className="kbd">{key}</kbd></button>
        ))}
        {(["bread", "herb"] as const).map((id) => (
          <button key={id} className="fantasy-btn" disabled={!d.inventory[id]} onClick={() => useItem(id)}>{ITEMS[id].name} ×{d.inventory[id] ?? 0}</button>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 z-10 hidden text-[11px] leading-5 text-parchment/70 lg:block">
        WASD / Arrows move · Shift sprint · Space attack · E interact · Esc close
      </div>
      <div className="absolute right-4 top-20 z-20 flex w-72 flex-col gap-2">
        {g.ui.toasts.map((t) => <div key={t.id} className={`fantasy-panel toast-${t.tone} px-3 py-2 text-sm`}>{t.text}</div>)}
      </div>
    </>
  );
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
          {dl.role === "receptionist" && <button className="fantasy-btn-primary" onClick={() => openPanel("guild")}>Open Mission Board</button>}
          {dl.role === "merchant" && <>
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
      <p className="mb-3 text-sm text-gold">{g.data.gold} gold</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {entries.length === 0 && <p className="text-parchment">Your pack is empty.</p>}
        {entries.map(([id, n]) => {
          const it = ITEMS[id];
          if (!it) return null;
          return (
            <div key={id} className="parchment-card p-3">
              <div className="font-display">{it.name} ×{n}</div>
              <div className="text-xs opacity-80">{it.description}</div>
              {it.use && <button className="fantasy-btn-primary mt-2" onClick={() => useItem(id)}>Use</button>}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function Character() {
  const g = useGame();
  const d = g.data;
  const kills = Object.values(d.kills).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <Frame title="Character">
      <div className="grid grid-cols-2 gap-3 text-parchment">
        {[["Name", d.name], ["Level", d.level], ["Experience", `${d.xp}/${xpForLevel(d.level)}`], ["Attack", attackPower(d)], ["Max health", d.maxHp], ["Max stamina", d.maxStamina], ["Gold", d.gold], ["Monsters slain", kills], ["Regions", `${d.discoveredRegions.length}/6`], ["Location", d.pos.scene === "overworld" ? REGIONS.find((r) => r.id === g.ui.regionId)?.name : g.ui.sceneName]].map(([k, v]) => (
          <div key={String(k)} className="parchment-card px-3 py-2"><div className="text-xs uppercase opacity-70">{k}</div><div className="font-display text-lg">{v}</div></div>
        ))}
      </div>
      <button className="fantasy-btn mt-5" onClick={() => { if (confirm("Erase all progress and restart?")) resetProgress(); }}>Reset progress</button>
    </Frame>
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
    <div className="relative h-screen w-screen overflow-hidden bg-ink font-body select-none">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <Hud />
      {g.ui.panel === "dialogue" && g.ui.dialogue && <Dialogue />}
      {g.ui.panel === "guild" && <GuildBoard />}
      {g.ui.panel === "quests" && <Quests />}
      {g.ui.panel === "inventory" && <Inventory />}
      {g.ui.panel === "character" && <Character />}
      {g.ui.panel === "map" && <Frame title="Azura — World Map" wide><WorldMap /></Frame>}
    </div>
  );
}

export { game };
