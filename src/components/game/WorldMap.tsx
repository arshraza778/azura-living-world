import { useEffect, useMemo, useRef, useState } from "react";
import { REGIONS, WORLD_H, WORLD_W } from "@/game/data/regions";
import { POIS } from "@/game/data/places";
import { fogCanvas, getMapCanvas } from "@/game/render/mapRender";
import { getScene } from "@/game/world/scenes";
import { useGame } from "@/game/state/store";

export function WorldMap() {
  const g = useGame();
  const d = g.data;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [sel, setSel] = useState<string>(g.ui.regionId);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const fog = useMemo(() => fogCanvas(d.discoveredRegions), [d.discoveredRegions.length]);

  useEffect(() => {
    const c = mapRef.current!;
    c.width = WORLD_W * 4; c.height = WORLD_H * 4;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(getMapCanvas(), 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.filter = "blur(3px)";
    ctx.drawImage(fog, 0, 0, c.width, c.height);
    ctx.filter = "none";
  }, [fog]);

  useEffect(() => {
    const el = box.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const z = Math.max(1, Math.min(5, v.z * Math.exp(-dy * 0.0015)));
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top, k = z / v.z;
      setView({ z, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const region = REGIONS.find((r) => r.id === sel)!;
  const known = d.discoveredRegions.includes(region.id);
  const pct = (x: number, y: number) => ({ left: `${(x / WORLD_W) * 100}%`, top: `${(y / WORLD_H) * 100}%` });
  const pos = d.pos.scene === "overworld" ? d.pos : d.pos.scene === "guild" ? { x: 106, y: 76 } : { x: 38, y: 104 };

  const click = (e: React.MouseEvent) => {
    if (drag.current?.moved) return;
    const r = mapRef.current!.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * WORLD_W), ty = Math.floor(((e.clientY - r.top) / r.height) * WORLD_H);
    const s = getScene("overworld");
    if (tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H) setSel(REGIONS[s.region![ty * WORLD_W + tx]].id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div ref={box} className="map-frame relative aspect-[200/140] cursor-grab touch-none overflow-hidden"
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: viewRef.current.z };
            drag.current = null;
          } else drag.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch.current && pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            const z = Math.max(1, Math.min(5, pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / (pinch.current.d || 1))));
            setView((v) => ({ ...v, z }));
            return;
          }
          const dr = drag.current; if (!dr) return;
          const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
          dr.x = e.clientX; dr.y = e.clientY;
          if (dr.moved) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; setTimeout(() => (drag.current = null), 0); }}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; drag.current = null; }}
        onClick={click}>
        <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.z})` }}>
          <canvas ref={mapRef} className="h-full w-full" />
          {REGIONS.map((r) => (
            <div key={r.id} className="map-label absolute -translate-x-1/2 -translate-y-1/2 text-center" style={pct(r.center[0], r.center[1] - 6)}>
              <div className={`font-display text-sm ${r.id === "eldergrove" ? "text-base" : ""}`}>{d.discoveredRegions.includes(r.id) ? r.name : "Unexplored"}</div>
              <div className={`text-[10px] danger-${r.danger}`}>{r.status.toUpperCase()} {"◆".repeat(r.danger)}</div>
            </div>
          ))}
          {POIS.filter((p) => p.kind !== "town").map((p) => {
            const found = d.discoveredPois.includes(p.id);
            if (!found && p.hidden) return null;
            return <div key={p.id} title={found ? p.name : "Undiscovered"} className={`absolute -translate-x-1/2 -translate-y-1/2 ${found ? "poi-found" : "poi-unknown"}`} style={pct(p.x, p.y)}>{found ? "◈" : "?"}</div>;
          })}
          <div className="player-marker absolute -translate-x-1/2 -translate-y-1/2" style={pct(pos.x, pos.y)} />
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button className="fantasy-btn px-2" onClick={(e) => { e.stopPropagation(); setView((v) => ({ ...v, z: Math.min(5, v.z * 1.3) })); }}>+</button>
          <button className="fantasy-btn px-2" onClick={(e) => { e.stopPropagation(); setView({ z: 1, x: 0, y: 0 }); }}>Reset</button>
        </div>
      </div>
      <div className="parchment-card p-4">
        <div className="font-display text-2xl">{region.name}</div>
        <div className="text-sm italic opacity-80">{region.subtitle}</div>
        <div className={`mt-2 font-semibold danger-${region.danger}`}>Danger {region.danger}/5 · {region.status}</div>
        <div className="mt-1 text-xs uppercase tracking-widest">{known ? "Discovered" : "Not yet discovered — rumours only"}</div>
        <p className="mt-3 text-sm leading-relaxed">{region.description}</p>
        <div className="mt-3 text-xs font-semibold uppercase">Known places</div>
        <ul className="mt-1 text-sm">
          {POIS.filter((p) => p.region === region.id && d.discoveredPois.includes(p.id)).map((p) => <li key={p.id}>◈ {p.name}</li>)}
        </ul>
        <p className="mt-3 text-xs opacity-70">Scroll to zoom · drag to pan · click a region</p>
      </div>
    </div>
  );
}
