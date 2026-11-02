import { fbm, hash2, mulberry32 } from "../core/noise";
import type { Decor, NPC, Scene, Trigger } from "../core/types";
import { BUILDINGS, OVERWORLD_NPCS, POIS } from "../data/places";
import { COAST, LAKES, PATHS, REGIONS, RIVERS, WORLD_H, WORLD_W, type WaterLine } from "../data/regions";
import { SOLID_TILES, T } from "../data/tiles";
import { makeNpc } from "./npc";

export const VILLAGE_SPAWN = { x: 106, y: 77 };

function stampLine(line: WaterLine, fn: (x: number, y: number, d: number) => void, extra = 0) {
  const pts = line.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(len * 3);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // gentle meander
      const wob = (fbm(ax + t * 9, ay + t * 9, 91, 2) - 0.5) * 3;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const cx = ax + (bx - ax) * t + nx * wob;
      const cy = ay + (by - ay) * t + ny * wob;
      const r = line.width + extra;
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r) fn(x, y, d);
        }
    }
  }
}

export function generateOverworld(): Scene {
  const W = WORLD_W;
  const H = WORLD_H;
  const N = W * H;
  const ground = new Uint8Array(N);
  const solid = new Uint8Array(N);
  const region = new Uint8Array(N);
  const clear = new Uint8Array(N); // 1 = keep free of vegetation
  const decor: Decor[] = [];
  const triggers: Trigger[] = [];
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x: number, y: number) => y * W + x;
  const clearDisc = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if (inb(x, y) && Math.hypot(x - cx, y - cy) <= r) clear[idx(x, y)] = 1;
  };

  // 1. landmass + regions
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const nx = (x / W - 0.5) * 2;
      const ny = (y / H - 0.5) * 2;
      const d = Math.sqrt(nx * nx * 0.92 + ny * ny) + (fbm(x * 0.035, y * 0.035, 7) - 0.5) * COAST.noise;
      const wx = x + (fbm(x * 0.05, y * 0.05, 11) - 0.5) * 26;
      const wy = y + (fbm(x * 0.05, y * 0.05, 23) - 0.5) * 26;
      let best = 0;
      let bestD = Infinity;
      REGIONS.forEach((r, ri) => {
        const dd = Math.hypot(wx - r.center[0], wy - r.center[1]) / r.weight;
        if (dd < bestD) {
          bestD = dd;
          best = ri;
        }
      });
      region[i] = best;
      if (d > COAST.radius + 0.07) ground[i] = T.DEEP;
      else if (d > COAST.radius) ground[i] = T.WATER;
      else if (d > COAST.radius - 0.045) ground[i] = T.SAND;
      else ground[i] = REGIONS[best].groundTile;
    }

  // 2. rivers & lakes
  for (const river of RIVERS) {
    stampLine(river, (x, y) => {
      if (!inb(x, y)) return;
      const i = idx(x, y);
      if (ground[i] !== T.DEEP && ground[i] !== T.WATER && ground[i] !== T.SAND) ground[i] = T.SAND;
    }, 1);
    stampLine(river, (x, y) => {
      if (!inb(x, y)) return;
      const i = idx(x, y);
      if (ground[i] !== T.DEEP) ground[i] = T.WATER;
    });
  }
  for (const lake of LAKES) {
    for (let y = lake.y - lake.ry - 3; y <= lake.y + lake.ry + 3; y++)
      for (let x = lake.x - lake.rx - 3; x <= lake.x + lake.rx + 3; x++) {
        if (!inb(x, y)) continue;
        const dx = (x - lake.x) / lake.rx;
        const dy = (y - lake.y) / lake.ry;
        const d = Math.sqrt(dx * dx + dy * dy) + (fbm(x * 0.3, y * 0.3, 5) - 0.5) * 0.4;
        if (d < 1) ground[idx(x, y)] = T.WATER;
        else if (d < 1.25 && ground[idx(x, y)] !== T.WATER) ground[idx(x, y)] = T.SAND;
      }
  }

  // 3. paths (bridges over water)
  for (const p of PATHS) {
    stampLine(p, (x, y) => inb(x, y) && (clear[idx(x, y)] = 1), 2.2);
    stampLine(p, (x, y) => {
      if (!inb(x, y)) return;
      const i = idx(x, y);
      if (ground[i] === T.WATER) ground[i] = T.BRIDGE;
      else if (ground[i] !== T.DEEP && ground[i] !== T.BRIDGE) ground[i] = T.PATH;
    });
  }

  // 4. Eldergrove plaza
  const [vx, vy] = REGIONS[0].center;
  for (let y = vy - 6; y <= vy + 6; y++)
    for (let x = vx - 7; x <= vx + 7; x++) {
      const d = Math.hypot((x - vx) / 1.15, y - vy);
      if (d < 5.2) ground[idx(x, y)] = T.PLAZA;
    }
  clearDisc(vx, vy, 19);
  decor.push({ kind: "fountain", x: vx + 0.5, y: vy + 0.9, v: 0.5 });
  solid[idx(vx, vy)] = 1;
  solid[idx(vx - 1, vy)] = 1;
  solid[idx(vx + 1, vy)] = 1;

  // 5. buildings
  for (const b of BUILDINGS) {
    const doorX = b.x + Math.floor(b.w / 2);
    // road from door to plaza
    stampLine({ name: "", width: 0.8, points: [[doorX + 0.5, b.y + b.h + 0.5], [vx + 0.5, vy + 0.5]] }, (x, y) => {
      if (inb(x, y) && ground[idx(x, y)] !== T.PLAZA && ground[idx(x, y)] !== T.WATER) ground[idx(x, y)] = T.PATH;
    });
  }
  for (const b of BUILDINGS) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) solid[idx(x, y)] = 1;
    decor.push({ kind: "building", x: b.x, y: b.y + b.h, w: b.w, h: b.h, v: hash2(b.x, b.y, 3), label: b.id });
    const doorX = b.x + Math.floor(b.w / 2);
    triggers.push({
      x: doorX - 1,
      y: b.y + b.h,
      w: 2,
      h: 1.2,
      label: b.enter ? `Enter ${b.name}` : `Knock on ${b.name}`,
      action: b.enter
        ? { type: "scene", to: "guild", x: 11, y: 11.5 }
        : { type: "locked", title: b.name, text: b.lockedText ?? "It's locked." },
    });
    decor.push({ kind: "lamp", x: b.x - 0.3, y: b.y + b.h + 0.6, v: 0.3 });
  }

  // training ground
  const tg = { x: 82, y: 77 };
  for (let y = tg.y; y < tg.y + 7; y++) for (let x = tg.x; x < tg.x + 7; x++) ground[idx(x, y)] = T.PATH;
  for (const [dx, dy] of [[1, 1], [4, 1], [1, 4], [5, 5]]) {
    decor.push({ kind: "dummy", x: tg.x + dx + 0.5, y: tg.y + dy + 0.9, v: 0.2 });
    solid[idx(tg.x + dx, tg.y + dy)] = 1;
  }
  for (let x = tg.x - 1; x <= tg.x + 7; x++) {
    if (x !== tg.x + 3) {
      decor.push({ kind: "fence", x: x + 0.5, y: tg.y - 0.1, v: 0 });
      solid[idx(x, tg.y - 1)] = 1;
    }
  }
  decor.push({ kind: "signpost", x: 104.5, y: 66.6, v: 0 });
  for (const [x, y] of [[100, 79], [112, 81], [108, 86], [99, 71]]) {
    decor.push({ kind: hash2(x, y, 4) > 0.5 ? "barrel" : "crate", x: x + 0.5, y: y + 0.9, v: hash2(x, y, 1) });
    solid[idx(x, y)] = 1;
  }

  // 6. POIs
  for (const p of POIS) {
    clearDisc(p.x, p.y, p.kind === "town" ? 0 : 3.5);
    if (p.kind === "town") continue;
    const at = (kind: string, dx = 0, dy = 0, isSolid = true) => {
      decor.push({ kind, x: p.x + dx + 0.5, y: p.y + dy + 0.9, v: hash2(p.x + dx, p.y + dy, 9) });
      if (isSolid && inb(p.x + dx, p.y + dy)) solid[idx(p.x + dx, p.y + dy)] = 1;
    };
    switch (p.kind) {
      case "cave": at("cave"); break;
      case "dungeon": at("gate"); break;
      case "structure": at("cabin"); break;
      case "waterfall": at("waterfall", 0, -1); break;
      case "ruin":
        if (p.id === "astral_ring") {
          for (let a = 0; a < 8; a++) at(a % 3 === 0 ? "brokenpillar" : "pillar", Math.round(Math.cos((a / 8) * Math.PI * 2) * 3), Math.round(Math.sin((a / 8) * Math.PI * 2) * 3));
          at("rune", 0, 0, false);
        } else if (p.id === "old_watchtower") at("tower");
        else {
          at("obelisk");
          at("brokenpillar", -2, 1);
          at("pillar", 2, -1);
        }
        break;
      case "boss": at("crater", 0, 0, true); break;
      case "mythic": at("shrine"); break;
      case "landmark":
        if (p.id === "venom_glade") for (let k = 0; k < 10; k++) at("venomflower", Math.round(Math.cos(k) * 2), Math.round(Math.sin(k * 1.7) * 2), false);
        else at("stone");
        break;
    }
    let action: Trigger["action"] | null = null;
    const it = p.interact;
    if (it?.type === "inspect") action = { type: "inspect", title: p.name, text: it.text };
    if (it?.type === "locked") action = { type: "locked", title: p.name, text: it.text };
    if (it?.type === "chest") action = { type: "chest", id: `poi:${p.id}`, loot: it.loot, gold: it.gold };
    if (it?.type === "dungeon") action = { type: "scene", to: "dungeon1", x: -1, y: -1 };
    if (action)
      triggers.push({
        x: p.x - 1.5,
        y: p.y - 1.2,
        w: 4,
        h: 3.4,
        label: it?.type === "dungeon" ? "Descend into Hollowroot" : it?.type === "chest" ? `Search ${p.name}` : `Examine ${p.name}`,
        action,
      });
  }

  // scattered ruins in the Reach
  const rng = mulberry32(1337);
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(135 + rng() * 55);
    const y = Math.floor(10 + rng() * 40);
    if (!inb(x, y)) continue;
    const i = idx(x, y);
    if (REGIONS[region[i]].id !== "forgotten" || clear[i] || ground[i] !== T.DRYGRASS) continue;
    ground[i] = T.RUIN;
    decor.push({ kind: rng() > 0.5 ? "pillar" : "brokenpillar", x: x + 0.5, y: y + 0.9, v: rng() });
    solid[i] = 1;
    clear[i] = 1;
  }

  // 7. vegetation
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      const g = ground[i];
      if (clear[i] || solid[i] || SOLID_TILES.has(g) || g === T.SAND || g === T.PATH || g === T.BRIDGE || g === T.PLAZA || g === T.RUIN) continue;
      const r = REGIONS[region[i]];
      const density = r.treeDensity * (0.35 + fbm(x * 0.08, y * 0.08, 31) * 1.3);
      const h = hash2(x, y, 77);
      if (h < density) {
        const kind = r.trees[Math.floor(hash2(x, y, 5) * r.trees.length)];
        decor.push({ kind, x: x + 0.5 + (hash2(x, y, 8) - 0.5) * 0.4, y: y + 0.85, v: hash2(x, y, 6) });
        solid[i] = 1;
      } else if (h < density + 0.05) {
        const v = hash2(x, y, 12);
        let kind = "bush";
        if (r.id === "thornveil") kind = v > 0.5 ? "fern" : "venomflower";
        else if (r.id === "blackwood" || r.id === "hollowroot") kind = v > 0.55 ? "mushroom" : "fern";
        else if (r.id === "forgotten") kind = v > 0.6 ? "stone" : "tallgrass";
        else if (r.id === "eldergrove") kind = v > 0.4 ? "flowers" : "bush";
        else kind = v > 0.7 ? "flowers" : v > 0.45 ? "fern" : "bush";
        decor.push({ kind, x: x + 0.5, y: y + 0.8, v });
      } else if (h < density + 0.065 && r.id !== "eldergrove") {
        decor.push({ kind: "rock", x: x + 0.5, y: y + 0.85, v: hash2(x, y, 13) });
        solid[i] = 1;
      }
    }

  // 8. solidity of terrain
  for (let i = 0; i < N; i++) if (SOLID_TILES.has(ground[i])) solid[i] = 1;

  // 9. monsters
  const spawns: Scene["spawns"] = [];
  const mr = mulberry32(4242);
  REGIONS.forEach((r, ri) => {
    let placed = 0;
    let tries = 0;
    while (placed < r.monsterCount && tries < 20000) {
      tries++;
      const x = Math.floor(mr() * W);
      const y = Math.floor(mr() * H);
      const i = idx(x, y);
      if (region[i] !== ri || solid[i] || Math.hypot(x - vx, y - vy) < 24) continue;
      spawns.push({ kind: r.monsters[Math.floor(mr() * r.monsters.length)], x: x + 0.5, y: y + 0.5 });
      placed++;
    }
  });

  const npcs: NPC[] = OVERWORLD_NPCS.map(makeNpc);

  return {
    id: "overworld",
    name: "Azura",
    w: W,
    h: H,
    ground,
    solid,
    region,
    decor,
    npcs,
    spawns,
    triggers,
    traps: [],
    lights: [],
    dark: 0,
    spawn: VILLAGE_SPAWN,
  };
}
