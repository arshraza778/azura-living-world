import { fbm, hash2 } from "../core/noise";
import type { Decor, Dir, Look, MonsterKind, Scene } from "../core/types";
import { BUILDINGS } from "../data/places";
import { TILE } from "../data/regions";
import { GRASSY, T, TILE_COLORS } from "../data/tiles";

type Ctx = CanvasRenderingContext2D;
const S = TILE;

// ---------- color helpers ----------
const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
  }
  return c;
}
export function mix(a: string, b: string, t: number, light = 0): string {
  const A = rgb(a);
  const B = rgb(b);
  const f = (i: number) => Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t + light)));
  return `rgb(${f(0)},${f(1)},${f(2)})`;
}

// ---------- ground chunks ----------
export const CHUNK = 16;
const chunkCache = new Map<string, HTMLCanvasElement>();

function tileColor(g: number, x: number, y: number, light = 0) {
  const [a, b] = TILE_COLORS[g] ?? ["#ff00ff", "#ff00ff"];
  const t = fbm(x * 0.13, y * 0.13, 3, 3);
  return mix(a, b, Math.min(1, Math.max(0, t * 1.6 - 0.3)), (hash2(x, y, 1) - 0.5) * 10 + light);
}

function paintTile(ctx: Ctx, s: Scene, x: number, y: number, px: number, py: number) {
  const g = s.ground[y * s.w + x];
  ctx.fillStyle = tileColor(g, x, y);
  ctx.fillRect(px, py, S, S);
  const h = (k: number) => hash2(x, y, k);
  if (GRASSY.has(g)) {
    const [a, b] = TILE_COLORS[g];
    for (let k = 0; k < 6; k++) {
      const bx = px + h(k + 10) * S;
      const by = py + h(k + 20) * S;
      ctx.strokeStyle = k % 2 ? mix(a, "#000000", 0.25) : mix(b, "#ffffff", 0.18);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bx, by + 3);
      ctx.lineTo(bx + (h(k + 30) - 0.5) * 3, by - 2);
      ctx.stroke();
    }
  } else if (g === T.PATH || g === T.SAND) {
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = `rgba(80,55,30,${0.12 + h(k) * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(px + h(k + 5) * S, py + h(k + 6) * S, 1.5 + h(k + 7) * 2, 1 + h(k + 8), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (g === T.PLAZA || g === T.STONEF || g === T.RUIN) {
    ctx.strokeStyle = "rgba(40,35,30,0.25)";
    ctx.lineWidth = 1;
    const off = y % 2 ? S / 2 : 0;
    ctx.strokeRect(px + 0.5, py + 0.5, S - 1, S / 2 - 1);
    ctx.beginPath();
    ctx.moveTo(px + off + 0.5, py + S / 2);
    ctx.lineTo(px + off + 0.5, py + S);
    ctx.moveTo(px, py + S / 2 + 0.5);
    ctx.lineTo(px + S, py + S / 2 + 0.5);
    ctx.stroke();
    if (h(4) > 0.8) {
      ctx.fillStyle = "rgba(90,120,60,0.35)";
      ctx.fillRect(px + h(5) * S, py + h(6) * S, 4, 3);
    }
  } else if (g === T.WOOD || g === T.BRIDGE) {
    ctx.strokeStyle = "rgba(50,30,15,0.35)";
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      if (g === T.BRIDGE) {
        ctx.moveTo(px + k * 8 + 0.5, py);
        ctx.lineTo(px + k * 8 + 0.5, py + S);
      } else {
        ctx.moveTo(px, py + k * 8 + 0.5);
        ctx.lineTo(px + S, py + k * 8 + 0.5);
      }
      ctx.stroke();
    }
  } else if (g === T.WALL) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(px, py, S, 6);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
    ctx.beginPath();
    ctx.moveTo(px, py + S / 2);
    ctx.lineTo(px + S, py + S / 2);
    ctx.moveTo(px + (y % 2 ? 10 : 22), py);
    ctx.lineTo(px + (y % 2 ? 10 : 22), py + S / 2);
    ctx.stroke();
  } else if (g === T.CARPET || g === T.RITUAL) {
    ctx.strokeStyle = g === T.CARPET ? "rgba(230,190,100,0.35)" : "rgba(170,90,220,0.25)";
    ctx.strokeRect(px + 3.5, py + 3.5, S - 7, S - 7);
  }
  // organic edge blending with neighbours
  const nb: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of nb) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
    const ng = s.ground[ny * s.w + nx];
    if (ng === g || ng === T.WALL || g === T.WALL || ng === T.BRIDGE || g === T.BRIDGE) continue;
    if (!(GRASSY.has(ng) || ng === T.SAND || ng === T.PATH || ng === T.DRYGRASS)) continue;
    ctx.fillStyle = tileColor(ng, nx, ny);
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3 + (h(40 + k + dx * 3 + dy * 7) - 0.5) * 0.2;
      const ex = dx === 0 ? px + t * S : px + (dx > 0 ? S : 0);
      const ey = dy === 0 ? py + t * S : py + (dy > 0 ? S : 0);
      ctx.beginPath();
      ctx.arc(ex, ey, 4 + h(50 + k) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function getChunk(s: Scene, cx: number, cy: number): HTMLCanvasElement {
  const key = `${s.id}:${cx},${cy}`;
  let c = chunkCache.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = CHUNK * S;
  c.height = CHUNK * S;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < CHUNK; y++)
    for (let x = 0; x < CHUNK; x++) {
      const tx = cx * CHUNK + x;
      const ty = cy * CHUNK + y;
      if (tx >= s.w || ty >= s.h) continue;
      paintTile(ctx, s, tx, ty, x * S, y * S);
    }
  // shallow-water shading near shores
  chunkCache.set(key, c);
  return c;
}

export function drawWaterFx(ctx: Ctx, s: Scene, x0: number, y0: number, x1: number, y1: number, t: number) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      const g = s.ground[y * s.w + x];
      if (g !== T.WATER && g !== T.DEEP) continue;
      const ph = t * 1.4 + hash2(x, y, 3) * 6;
      const a = (Math.sin(ph) + 1) * 0.5;
      ctx.strokeStyle = `rgba(220,240,255,${0.08 + a * 0.18})`;
      ctx.lineWidth = 1.5;
      const ox = x * S + hash2(x, y, 4) * 16;
      const oy = y * S + 8 + hash2(x, y, 5) * 16;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(ox + 5, oy - 3 * a, ox + 10 + a * 4, oy);
      ctx.stroke();
      // shore foam
      const near = (dx: number, dy: number) => {
        const n = s.ground[(y + dy) * s.w + (x + dx)];
        return n !== undefined && n !== T.WATER && n !== T.DEEP && n !== T.BRIDGE;
      };
      if (y > 0 && near(0, -1)) {
        ctx.fillStyle = `rgba(255,255,255,${0.15 + a * 0.2})`;
        ctx.fillRect(x * S, y * S, S, 2 + a * 2);
      }
    }
}

export function drawTraps(ctx: Ctx, s: Scene, t: number) {
  for (const tr of s.traps) {
    const up = trapUp(tr.x, tr.y, t);
    const px = tr.x * S;
    const py = tr.y * S;
    ctx.fillStyle = "rgba(20,15,20,0.55)";
    ctx.fillRect(px + 4, py + 4, S - 8, S - 8);
    ctx.fillStyle = up ? "#d8d4e0" : "#5a5560";
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const sx = px + 8 + i * 8;
        const sy = py + 10 + j * 7;
        ctx.beginPath();
        ctx.moveTo(sx - 2.5, sy + 2);
        ctx.lineTo(sx, sy - (up ? 7 : 1));
        ctx.lineTo(sx + 2.5, sy + 2);
        ctx.fill();
      }
  }
}
export const trapUp = (x: number, y: number, t: number) => Math.sin(t * 2.2 + x * 0.9 + y * 0.4) > 0.25;

// ---------- primitives ----------
function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28) {
  ctx.fillStyle = `rgba(10,20,15,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function blob(ctx: Ctx, x: number, y: number, r: number, inner: string, outer: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- decor ----------
export function drawDecor(ctx: Ctx, d: Decor, t: number) {
  const x = d.x * S;
  const y = d.y * S;
  const v = d.v;
  const sway = Math.sin(t * 1.3 + v * 10) * 1.2;
  switch (d.kind) {
    case "oak":
    case "birch": {
      const sc = 0.85 + v * 0.4;
      shadow(ctx, x + 6, y - 2, 24 * sc, 9 * sc);
      ctx.fillStyle = d.kind === "birch" ? "#e8e2d4" : "#5a3a22";
      ctx.fillRect(x - 4, y - 22 * sc, 8, 22 * sc);
      if (d.kind === "birch") {
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(x - 4, y - 14, 5, 2);
        ctx.fillRect(x, y - 8, 4, 2);
      }
      const cy = y - 40 * sc;
      const [dk, md, lt] = d.kind === "birch" ? ["#5f8a2e", "#8ab840", "#c6e070"] : v > 0.5 ? ["#2f5a24", "#4f8a34", "#8cc350"] : ["#2a5228", "#437d38", "#7ab550"];
      blob(ctx, x - 14 * sc + sway, cy + 8, 17 * sc, md, dk);
      blob(ctx, x + 14 * sc + sway, cy + 6, 16 * sc, md, dk);
      blob(ctx, x + sway, cy - 8 * sc, 20 * sc, lt, md);
      blob(ctx, x + sway * 1.3, cy + 6, 15 * sc, md, dk);
      ctx.fillStyle = "rgba(255,250,200,0.18)";
      ctx.beginPath();
      ctx.arc(x - 6 * sc + sway, cy - 14 * sc, 7 * sc, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pine":
    case "darkpine": {
      const sc = 0.85 + v * 0.45;
      const dark = d.kind === "darkpine";
      shadow(ctx, x + 6, y - 2, 18 * sc, 7 * sc, dark ? 0.4 : 0.28);
      ctx.fillStyle = dark ? "#1e1612" : "#4a3020";
      ctx.fillRect(x - 3, y - 14, 6, 14);
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const w = (26 - i * 5) * sc;
        const by = y - 8 - i * 14 * sc;
        const col = dark ? mix("#0f1d18", "#2a3d34", i / layers) : mix("#1f4a2c", "#4a8a4a", i / layers);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - w + sway * (i / 3), by);
        ctx.lineTo(x + sway * (i / 2), by - 24 * sc);
        ctx.lineTo(x + w + sway * (i / 3), by);
        ctx.closePath();
        ctx.fill();
      }
      if (dark && v > 0.7) {
        ctx.fillStyle = `rgba(180,120,255,${0.4 + Math.sin(t * 3 + v * 20) * 0.3})`;
        ctx.beginPath();
        ctx.arc(x + 8, y - 30, 2, 0, Math.PI * 2);
        ctx.arc(x + 14, y - 30, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "dead": {
      shadow(ctx, x + 4, y - 2, 14, 5);
      ctx.strokeStyle = "#3a2e26";
      ctx.lineCap = "round";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2, y - 38);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 22);
      ctx.lineTo(x - 14, y - 36);
      ctx.moveTo(x + 2, y - 30);
      ctx.lineTo(x + 16, y - 46);
      ctx.moveTo(x + 2, y - 38);
      ctx.lineTo(x - 4, y - 52);
      ctx.stroke();
      ctx.lineCap = "butt";
      break;
    }
    case "palm":
    case "jungle": {
      const sc = 0.9 + v * 0.4;
      shadow(ctx, x + 6, y - 2, 24 * sc, 9 * sc);
      ctx.strokeStyle = "#6a4a2a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 20, x + 2 + sway, y - 40 * sc);
      ctx.stroke();
      const cx = x + 2 + sway;
      const cy = y - 40 * sc;
      const n = d.kind === "palm" ? 7 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + v * 3 + Math.sin(t + i) * 0.04;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 28 * sc, 0);
        g.addColorStop(0, d.kind === "palm" ? "#2f7a3a" : "#1f5f30");
        g.addColorStop(1, d.kind === "palm" ? "#7cc35a" : "#4fa050");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(16 * sc, 0, 17 * sc, 6 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      blob(ctx, cx, cy, 6, "#5a9a40", "#2a5a28");
      break;
    }
    case "bush": {
      shadow(ctx, x + 2, y, 13, 4);
      blob(ctx, x - 6, y - 8, 9, "#6aa84a", "#3a6a2e");
      blob(ctx, x + 6, y - 8, 9, "#6aa84a", "#3a6a2e");
      blob(ctx, x, y - 13, 10, "#8cc860", "#4a7a34");
      if (v > 0.6) {
        ctx.fillStyle = "#d84a5a";
        ctx.beginPath();
        ctx.arc(x - 4, y - 12, 2, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 9, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "fern": {
      ctx.strokeStyle = v > 0.5 ? "#2f7a3a" : "#3f8a40";
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.45 + sway * 0.05;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 14, x + Math.cos(a) * 16, y + Math.sin(a) * 10);
        ctx.stroke();
      }
      break;
    }
    case "tallgrass": {
      ctx.strokeStyle = "#d8c870";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 8 + i * 2.6, y);
        ctx.lineTo(x - 8 + i * 2.6 + sway * 2, y - 12 - (i % 3) * 3);
        ctx.stroke();
      }
      break;
    }
    case "flowers": {
      const cols = ["#f4e04a", "#f08ab0", "#ffffff", "#a0b8ff"];
      for (let i = 0; i < 5; i++) {
        const fx = x + (hash2(i, Math.floor(v * 1000), 1) - 0.5) * 22;
        const fy = y - 4 + (hash2(i, Math.floor(v * 1000), 2) - 0.5) * 12;
        ctx.fillStyle = "#3a7a30";
        ctx.fillRect(fx - 0.5, fy, 1, 4);
        ctx.fillStyle = cols[(i + Math.floor(v * 4)) % 4];
        ctx.beginPath();
        ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "venomflower": {
      ctx.fillStyle = "#2a6a30";
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const pulse = 0.6 + Math.sin(t * 2 + v * 9) * 0.25;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.fillStyle = `rgba(190,70,230,${pulse})`;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 4, y - 8 + Math.sin(a) * 3, 3.5, 2, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe46a";
      ctx.beginPath();
      ctx.arc(x, y - 8, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "mushroom": {
      const glow = 0.5 + Math.sin(t * 1.5 + v * 7) * 0.3;
      for (let i = 0; i < 3; i++) {
        const mx = x - 6 + i * 6;
        const my = y - 2 - (i % 2) * 3;
        ctx.fillStyle = "#e8dcc8";
        ctx.fillRect(mx - 1, my - 5, 2, 5);
        ctx.fillStyle = v > 0.5 ? `rgba(90,220,255,${glow + 0.2})` : `rgba(200,120,255,${glow + 0.2})`;
        ctx.beginPath();
        ctx.ellipse(mx, my - 5, 4, 2.5, 0, Math.PI, 0);
        ctx.fill();
      }
      break;
    }
    case "rock":
    case "stone": {
      const sc = d.kind === "stone" ? 1.2 : 0.9 + v * 0.3;
      shadow(ctx, x + 3, y - 1, 14 * sc, 5 * sc);
      ctx.fillStyle = "#6a6a70";
      ctx.beginPath();
      ctx.moveTo(x - 13 * sc, y);
      ctx.lineTo(x - 10 * sc, y - 12 * sc);
      ctx.lineTo(x + 2 * sc, y - 17 * sc);
      ctx.lineTo(x + 12 * sc, y - 9 * sc);
      ctx.lineTo(x + 13 * sc, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8e8e94";
      ctx.beginPath();
      ctx.moveTo(x - 10 * sc, y - 12 * sc);
      ctx.lineTo(x + 2 * sc, y - 17 * sc);
      ctx.lineTo(x + 4 * sc, y - 8 * sc);
      ctx.lineTo(x - 6 * sc, y - 5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(90,140,60,0.6)";
      ctx.beginPath();
      ctx.ellipse(x - 3 * sc, y - 14 * sc, 5 * sc, 2 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pillar":
    case "brokenpillar": {
      const hgt = d.kind === "pillar" ? 52 : 22 + v * 10;
      shadow(ctx, x + 8, y - 1, 14, 5);
      const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
      g.addColorStop(0, "#a8a090");
      g.addColorStop(0.5, "#e2dac8");
      g.addColorStop(1, "#8a8272");
      ctx.fillStyle = g;
      ctx.fillRect(x - 9, y - hgt, 18, hgt);
      ctx.fillStyle = "#c8c0ae";
      ctx.fillRect(x - 12, y - 5, 24, 5);
      if (d.kind === "pillar") ctx.fillRect(x - 12, y - hgt - 5, 24, 6);
      else {
        ctx.fillStyle = "#8a8272";
        ctx.beginPath();
        ctx.moveTo(x - 9, y - hgt);
        ctx.lineTo(x - 2, y - hgt - 6);
        ctx.lineTo(x + 4, y - hgt + 2);
        ctx.lineTo(x + 9, y - hgt - 3);
        ctx.lineTo(x + 9, y - hgt);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(80,120,50,0.5)";
      ctx.fillRect(x - 9, y - 12, 7, 8);
      break;
    }
    case "obelisk": {
      shadow(ctx, x + 10, y - 1, 18, 6);
      ctx.fillStyle = "#4a4a58";
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x - 8, y - 70);
      ctx.lineTo(x, y - 82);
      ctx.lineTo(x + 8, y - 70);
      ctx.lineTo(x + 12, y);
      ctx.fill();
      const glow = 0.55 + Math.sin(t * 2) * 0.3;
      ctx.fillStyle = `rgba(110,220,255,${glow})`;
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 3 + (i % 2) * 3, y - 64 + i * 9, 3, 5);
      ctx.fillStyle = `rgba(110,220,255,${glow * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y - 40, 26, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sealeddoor": {
      ctx.fillStyle = "#302b36"; ctx.fillRect(x - 13, y - 34, 26, 34); ctx.strokeStyle = "#5f9d91"; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 31, 20, 28); ctx.beginPath(); ctx.arc(x, y - 18, 4, 0, Math.PI * 2); ctx.stroke(); break;
    }
    case "rune": {
      ctx.strokeStyle = `rgba(120,220,255,${0.4 + Math.sin(t * 1.5) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 30, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 18, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "tower": {
      shadow(ctx, x + 14, y - 2, 30, 10);
      ctx.fillStyle = "#8a8070";
      ctx.fillRect(x - 18, y - 90, 36, 90);
      ctx.fillStyle = "#6a6256";
      ctx.fillRect(x - 18, y - 90, 10, 90);
      ctx.fillStyle = "#a89e8a";
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 20 + i * 11, y - 100, 7, 12);
      ctx.fillStyle = "#1e1a16";
      ctx.fillRect(x - 5, y - 70, 10, 16);
      ctx.fillRect(x - 6, y - 18, 12, 18);
      break;
    }
    case "cave": {
      shadow(ctx, x, y, 34, 8);
      ctx.fillStyle = "#5a5a5e";
      ctx.beginPath();
      ctx.ellipse(x, y - 18, 36, 26, 0, Math.PI, 0);
      ctx.lineTo(x + 36, y);
      ctx.lineTo(x - 36, y);
      ctx.fill();
      ctx.fillStyle = "#3a6a2e";
      ctx.beginPath();
      ctx.ellipse(x - 6, y - 40, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0e0c10";
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 16, 18, 0, Math.PI, 0);
      ctx.fill();
      break;
    }
    case "gate": {
      shadow(ctx, x, y + 2, 44, 10, 0.4);
      ctx.fillStyle = "#4a4650";
      ctx.fillRect(x - 40, y - 54, 80, 54);
      ctx.fillStyle = "#5e5a66";
      ctx.fillRect(x - 46, y - 62, 92, 12);
      ctx.fillStyle = "#08060a";
      ctx.beginPath();
      ctx.moveTo(x - 20, y);
      ctx.lineTo(x - 20, y - 30);
      ctx.arc(x, y - 30, 20, Math.PI, 0);
      ctx.lineTo(x + 20, y);
      ctx.fill();
      const glow = 0.5 + Math.sin(t * 2.4) * 0.3;
      ctx.fillStyle = `rgba(120,255,170,${glow})`;
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 34 + i * 16, y - 58, 6, 4);
      // roots
      ctx.strokeStyle = "#3e2a1c";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 50, y - 70);
      ctx.bezierCurveTo(x - 30, y - 60, x - 44, y - 30, x - 30, y);
      ctx.moveTo(x + 52, y - 66);
      ctx.bezierCurveTo(x + 30, y - 50, x + 46, y - 26, x + 34, y + 2);
      ctx.moveTo(x - 10, y - 78);
      ctx.bezierCurveTo(x, y - 64, x + 18, y - 70, x + 26, y - 56);
      ctx.stroke();
      ctx.lineCap = "butt";
      break;
    }
    case "cabin": {
      shadow(ctx, x + 6, y, 40, 10);
      ctx.fillStyle = "#6a4a30";
      ctx.fillRect(x - 32, y - 34, 64, 34);
      ctx.strokeStyle = "rgba(30,20,10,0.5)";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 32, y - 34 + i * 7);
        ctx.lineTo(x + 32, y - 34 + i * 7);
        ctx.stroke();
      }
      ctx.fillStyle = "#4a3a2a";
      ctx.beginPath();
      ctx.moveTo(x - 40, y - 30);
      ctx.lineTo(x - 8, y - 64);
      ctx.lineTo(x + 12, y - 60);
      ctx.lineTo(x + 40, y - 30);
      ctx.fill();
      ctx.fillStyle = "#2a1e14";
      ctx.fillRect(x - 6, y - 22, 12, 22);
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(x + 14, y - 26, 10, 8);
      break;
    }
    case "waterfall": {
      ctx.fillStyle = "#5a5a62";
      ctx.fillRect(x - 46, y - 60, 92, 40);
      ctx.fillStyle = "#6e6e78";
      ctx.fillRect(x - 46, y - 64, 92, 8);
      for (let i = 0; i < 8; i++) {
        const off = ((t * 90 + i * 23) % 50) - 10;
        ctx.fillStyle = "rgba(220,240,255,0.75)";
        ctx.fillRect(x - 26 + i * 7, y - 60 + off * 0.8, 3, 14);
      }
      ctx.fillStyle = "rgba(200,230,255,0.35)";
      ctx.fillRect(x - 28, y - 60, 56, 44);
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 5) * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 14, 34, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "crater": {
      const g = ctx.createRadialGradient(x, y - 10, 5, x, y - 10, 70);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.6, "rgba(40,10,50,0.7)");
      g.addColorStop(1, "rgba(40,10,50,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 70, 44, 0, 0, Math.PI * 2);
      ctx.fill();
      const p = 0.4 + Math.sin(t * 0.8) * 0.3;
      ctx.fillStyle = `rgba(255,60,60,${p})`;
      ctx.beginPath();
      ctx.arc(x - 10, y - 14, 3, 0, Math.PI * 2);
      ctx.arc(x + 10, y - 14, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "shrine": {
      shadow(ctx, x, y, 28, 8);
      ctx.fillStyle = "#3a3440";
      ctx.fillRect(x - 24, y - 10, 48, 10);
      ctx.fillStyle = "#4e4656";
      ctx.fillRect(x - 6, y - 44, 12, 34);
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 44);
      ctx.lineTo(x + 8, y - 58);
      ctx.lineTo(x + 6, y - 44);
      ctx.fill();
      const p = 0.4 + Math.sin(t * 1.7) * 0.3;
      ctx.fillStyle = `rgba(255,200,90,${p})`;
      ctx.beginPath();
      ctx.arc(x, y - 30, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,200,90,${p * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y - 30, 30, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "fountain": {
      shadow(ctx, x, y - 4, 44, 14);
      ctx.fillStyle = "#9a9488";
      ctx.beginPath();
      ctx.ellipse(x, y - 14, 42, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a8ac0";
      ctx.beginPath();
      ctx.ellipse(x, y - 16, 34, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b8b2a4";
      ctx.fillRect(x - 5, y - 46, 10, 30);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t;
        ctx.fillStyle = "rgba(220,240,255,0.7)";
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 14, y - 30 + Math.sin(t * 4 + i) * 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(220,240,255,0.8)";
      ctx.beginPath();
      ctx.ellipse(x, y - 48, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "dummy": {
      shadow(ctx, x, y, 10, 4);
      ctx.fillStyle = "#6a4a2a";
      ctx.fillRect(x - 2, y - 34, 4, 34);
      ctx.fillRect(x - 14, y - 26, 28, 4);
      ctx.fillStyle = "#c8a870";
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 38, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a04030";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 22, 4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "fence": {
      ctx.fillStyle = "#7a5432";
      ctx.fillRect(x - 16, y - 16, 32, 4);
      ctx.fillRect(x - 16, y - 8, 32, 4);
      ctx.fillRect(x - 2, y - 20, 4, 20);
      break;
    }
    case "signpost": {
      ctx.fillStyle = "#6a4a2a";
      ctx.fillRect(x - 2, y - 36, 4, 36);
      ctx.fillStyle = "#a07a4a";
      ctx.fillRect(x - 18, y - 36, 22, 8);
      ctx.fillRect(x - 2, y - 26, 22, 8);
      break;
    }
    case "lamp": {
      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(x - 1.5, y - 40, 3, 40);
      const f = 0.75 + Math.sin(t * 7 + v * 10) * 0.08;
      ctx.fillStyle = `rgba(255,210,120,${f * 0.22})`;
      ctx.beginPath();
      ctx.arc(x, y - 42, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,220,140,${f})`;
      ctx.fillRect(x - 4, y - 48, 8, 9);
      break;
    }
    case "crate":
    case "barrel": {
      shadow(ctx, x, y, 12, 4);
      if (d.kind === "crate") {
        ctx.fillStyle = "#9a6e3e";
        ctx.fillRect(x - 11, y - 20, 22, 20);
        ctx.strokeStyle = "#5a3e22";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 11, y - 20, 22, 20);
        ctx.beginPath();
        ctx.moveTo(x - 11, y - 20);
        ctx.lineTo(x + 11, y);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#8a5a32";
        ctx.beginPath();
        ctx.ellipse(x, y - 11, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(x - 10, y - 17, 20, 2);
        ctx.fillRect(x - 10, y - 6, 20, 2);
      }
      break;
    }
    // ---- interiors ----
    case "walltorch": {
      const f = 0.8 + Math.sin(t * 9 + v * 30) * 0.15;
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(x - 2, y - 16, 4, 10);
      ctx.fillStyle = `rgba(255,170,60,${f})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 20, 4, 7 * f, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,180,${f})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 19, 2, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "shelf": {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(x - 15, y - 44, 30, 44);
      const cols = ["#8a2a2a", "#2a5a8a", "#3a7a3a", "#a08030", "#6a3a7a"];
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = cols[(i + r * 2) % 5];
          ctx.fillRect(x - 13 + i * 5.5, y - 40 + r * 13, 4, 10);
        }
      break;
    }
    case "table": {
      shadow(ctx, x, y, 18, 5);
      ctx.fillStyle = "#7a5030";
      ctx.fillRect(x - 18, y - 22, 36, 16);
      ctx.fillStyle = "#5a3a20";
      ctx.fillRect(x - 16, y - 6, 4, 6);
      ctx.fillRect(x + 12, y - 6, 4, 6);
      ctx.fillStyle = "#e0d0a0";
      ctx.fillRect(x - 8, y - 20, 8, 6);
      ctx.fillStyle = "#c08040";
      ctx.beginPath();
      ctx.arc(x + 8, y - 16, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "counter": {
      ctx.fillStyle = "#6a4426";
      ctx.fillRect(x - 16, y - 26, 32, 26);
      ctx.fillStyle = "#8a5e36";
      ctx.fillRect(x - 16, y - 30, 32, 8);
      if (v > 0.6) {
        ctx.fillStyle = "#e8dcb0";
        ctx.fillRect(x - 6, y - 32, 10, 4);
      }
      break;
    }
    case "board": {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(x - 30, y - 50, 60, 42);
      ctx.fillStyle = "#8a6a42";
      ctx.fillRect(x - 27, y - 47, 54, 36);
      const papers = [[-22, -44], [-6, -42], [10, -45], [-18, -28], [2, -27], [16, -30]];
      papers.forEach(([x, y], i) => {
        ctx.fillStyle = i % 2 ? "#efe4c4" : "#e4d6ae";
        ctx.fillRect(x + x, y + y, 12, 14);
        ctx.fillStyle = "#b03a2a";
        ctx.fillRect(x + x + 5, y + y - 1, 2, 2);
      });
      const glow = 0.4 + Math.sin(t * 3) * 0.2;
      ctx.strokeStyle = `rgba(255,220,120,${glow})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 31, y - 51, 62, 44);
      break;
    }
    case "banner": {
      ctx.fillStyle = "#2f5d8a";
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 44);
      ctx.lineTo(x + 10, y - 44);
      ctx.lineTo(x + 10, y - 14);
      ctx.lineTo(x, y - 20);
      ctx.lineTo(x - 10, y - 14);
      ctx.fill();
      ctx.fillStyle = "#e6c36a";
      ctx.beginPath();
      ctx.arc(x, y - 34, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "plant": {
      ctx.fillStyle = "#8a5a3a";
      ctx.fillRect(x - 7, y - 12, 14, 12);
      blob(ctx, x, y - 22, 11, "#6ab04a", "#2a6a2e");
      break;
    }
    case "chest": {
      shadow(ctx, x, y, 14, 4);
      ctx.fillStyle = "#7a4a22";
      ctx.fillRect(x - 13, y - 18, 26, 18);
      ctx.fillStyle = "#9a6232";
      ctx.fillRect(x - 13, y - 22, 26, 8);
      ctx.fillStyle = "#e6c36a";
      ctx.fillRect(x - 13, y - 14, 26, 2);
      ctx.fillRect(x - 2, y - 16, 4, 6);
      break;
    }
    case "stairsup":
    case "stairsdown": {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = d.kind === "stairsdown" ? mix("#7a7680", "#151218", i / 4) : mix("#3a3640", "#9a96a0", i / 4);
        ctx.fillRect(x - 15, y - 30 + i * 7, 30, 7);
      }
      break;
    }
    case "sealeddoor": {
      ctx.fillStyle = "#302b36"; ctx.fillRect(x - 13, y - 34, 26, 34); ctx.strokeStyle = "#5f9d91"; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 31, 20, 28); ctx.beginPath(); ctx.arc(x, y - 18, 4, 0, Math.PI * 2); ctx.stroke(); break;
    }
    case "rune": {
      ctx.strokeStyle = `rgba(91,220,215,${0.25 + Math.sin(t * 2 + x) * 0.12})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 7, y - 2); ctx.lineTo(x, y - 13); ctx.lineTo(x + 7, y - 2); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x + 4, y - 5); ctx.stroke(); break;
    }
    case "altar": {
      shadow(ctx, x, y, 22, 6);
      ctx.fillStyle = "#1e1428";
      ctx.fillRect(x - 20, y - 18, 40, 18);
      ctx.fillStyle = "#2e2040";
      ctx.fillRect(x - 24, y - 24, 48, 8);
      const p = 0.5 + Math.sin(t * 2) * 0.3;
      ctx.fillStyle = `rgba(255,190,80,${p})`;
      ctx.beginPath();
      ctx.moveTo(x, y - 52);
      ctx.lineTo(x + 7, y - 36);
      ctx.lineTo(x, y - 28);
      ctx.lineTo(x - 7, y - 36);
      ctx.fill();
      break;
    }
    case "building":
      drawBuilding(ctx, d);
      break;
  }
}

function drawBuilding(ctx: Ctx, d: Decor) {
  const b = BUILDINGS.find((x) => x.id === d.label);
  if (!b) return;
  const x = b.x * S;
  const w = b.w * S;
  const bottom = (b.y + b.h) * S;
  const wallH = Math.min(3, b.h * 0.42) * S;
  const top = b.y * S - S * 0.9;
  // shadow
  ctx.fillStyle = "rgba(10,20,15,0.3)";
  ctx.fillRect(x + 10, bottom - 8, w, 14);
  // wall (front face)
  ctx.fillStyle = b.wall;
  ctx.fillRect(x, bottom - wallH, w, wallH);
  // timber frame
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(x, bottom - wallH, w, 4);
  for (let i = 0; i <= b.w; i += 2) ctx.fillRect(x + i * S - (i === b.w ? 5 : 0), bottom - wallH, 5, wallH);
  ctx.fillStyle = "#7a7268";
  ctx.fillRect(x - 2, bottom - 8, w + 4, 8);
  // windows (glowing)
  for (let i = 1; i < b.w; i += 2) {
    if (i === Math.floor(b.w / 2) || i === Math.floor(b.w / 2) - 1) continue;
    const wx = x + i * S + 4;
    const wy = bottom - wallH + 18;
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(wx - 2, wy - 2, 24, 22);
    ctx.fillStyle = "#ffd88a";
    ctx.fillRect(wx, wy, 20, 18);
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(wx + 9, wy, 2, 18);
    ctx.fillRect(wx, wy + 8, 20, 2);
  }
  // door
  const dx = x + Math.floor(b.w / 2) * S - S * 0.5;
  ctx.fillStyle = "#3e2614";
  ctx.beginPath();
  ctx.moveTo(dx, bottom - 6);
  ctx.lineTo(dx, bottom - 44);
  ctx.arc(dx + S / 2 + S * 0.0, bottom - 44, S / 2, Math.PI, 0);
  ctx.lineTo(dx + S, bottom - 6);
  ctx.fill();
  ctx.fillStyle = "#e6c36a";
  ctx.fillRect(dx + S - 9, bottom - 26, 3, 3);
  // roof
  const roofBottom = bottom - wallH + 6;
  const g = ctx.createLinearGradient(0, top, 0, roofBottom);
  g.addColorStop(0, mix(b.roof, "#ffffff", 0.18));
  g.addColorStop(1, mix(b.roof, "#000000", 0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 12, roofBottom);
  ctx.lineTo(x + 6, top);
  ctx.lineTo(x + w - 6, top);
  ctx.lineTo(x + w + 12, roofBottom);
  ctx.closePath();
  ctx.fill();
  // shingles
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  for (let ry = top + 10; ry < roofBottom; ry += 10) {
    ctx.beginPath();
    ctx.moveTo(x - 10, ry);
    ctx.lineTo(x + w + 10, ry);
    ctx.stroke();
  }
  ctx.fillStyle = mix(b.roof, "#000000", 0.4);
  ctx.fillRect(x + 6, top - 4, w - 12, 6);
  // chimney
  ctx.fillStyle = "#6a5a50";
  ctx.fillRect(x + w - 40, top - 18, 14, 26);
  // sign
  if (b.sign) {
    ctx.font = "600 13px Cinzel, serif";
    const tw = ctx.measureText(b.name).width + 16;
    ctx.fillStyle = "rgba(30,20,12,0.85)";
    ctx.fillRect(x + w / 2 - tw / 2, bottom - wallH - 10, tw, 20);
    ctx.strokeStyle = "#e6c36a";
    ctx.strokeRect(x + w / 2 - tw / 2 + 0.5, bottom - wallH - 9.5, tw - 1, 19);
    ctx.fillStyle = "#f4e2b0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.name, x + w / 2, bottom - wallH + 0.5);
  }
  if (b.id === "guild") {
    ctx.fillStyle = "#2f5d8a";
    ctx.fillRect(x + 20, bottom - wallH + 20, 18, 34);
    ctx.fillRect(x + w - 38, bottom - wallH + 20, 18, 34);
    ctx.fillStyle = "#e6c36a";
    ctx.beginPath();
    ctx.arc(x + 29, bottom - wallH + 34, 4, 0, Math.PI * 2);
    ctx.arc(x + w - 29, bottom - wallH + 34, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- characters ----------
export function drawCharacter(ctx: Ctx, x: number, y: number, dir: Dir, walk: number, look: Look, attacking = 0, hurt = 0) {
  const px = x * S;
  const py = y * S;
  const step = Math.sin(walk * 11);
  const bob = Math.abs(step) * 1.5;
  shadow(ctx, px, py, 10, 4, 0.35);
  // legs
  ctx.fillStyle = "#2a2430";
  ctx.fillRect(px - 5, py - 9 + (step > 0 ? -1 : 0), 4, 9 - (step > 0 ? 1 : 0) + step * 1.5);
  ctx.fillRect(px + 1, py - 9 + (step < 0 ? -1 : 0), 4, 9 + (step < 0 ? 0 : 0) - step * 1.5);
  // cloak / body
  const by = py - 10 - bob;
  ctx.fillStyle = hurt > 0 ? "#ff6a6a" : look.cloak;
  ctx.beginPath();
  ctx.moveTo(px - 9, by + 2);
  ctx.quadraticCurveTo(px - 10, by - 14, px, by - 16);
  ctx.quadraticCurveTo(px + 10, by - 14, px + 9, by + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.trim;
  ctx.fillRect(px - 8, by - 4, 16, 2);
  if (dir === 0) ctx.fillRect(px - 1, by - 14, 2, 10);
  // arms
  ctx.fillStyle = look.cloak;
  const armSwing = step * 3;
  if (dir !== 2) ctx.fillRect(px - 11, by - 13 + armSwing, 4, 10);
  if (dir !== 1) ctx.fillRect(px + 7, by - 13 - armSwing, 4, 10);
  // head
  const hy = by - 23;
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(px, hy, 8, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  if (dir === 3) {
    ctx.arc(px, hy, 8.6, 0, Math.PI * 2);
    if (look.hairStyle === "long") ctx.fillRect(px - 7, hy - 1, 14, 12);
  } else {
    ctx.arc(px, hy - 1, 8.8, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(px + 9, hy + 2);
    ctx.quadraticCurveTo(px + (dir === 1 ? 8 : 4), hy - 4, px, hy - 4);
    ctx.quadraticCurveTo(px - (dir === 2 ? 8 : 4), hy - 4, px - 9, hy + 2);
    if (look.hairStyle === "long") { ctx.lineTo(px - 7, hy + 8); ctx.lineTo(px + 7, hy + 8); }
    if (look.hairStyle === "spiky") { ctx.lineTo(px + 5, hy - 10); ctx.lineTo(px + 1, hy - 6); ctx.lineTo(px - 2, hy - 11); ctx.lineTo(px - 5, hy - 6); }
  }
  ctx.fill();
  if (look.hairStyle === "ponytail" && dir !== 3) {
    ctx.beginPath(); ctx.moveTo(px - 5, hy + 2); ctx.quadraticCurveTo(px - 12, hy + 7, px - 8, hy + 13); ctx.lineTo(px - 3, hy + 7); ctx.fill();
  }
  if (dir !== 3) {
    ctx.fillStyle = "#1a1a2a";
    const ex = dir === 1 ? -3 : dir === 2 ? 3 : 0;
    if (dir === 0 || dir === 1) ctx.fillRect(px - 4 + ex, hy, 2, 3);
    if (dir === 0 || dir === 2) ctx.fillRect(px + 2 + ex, hy, 2, 3);
  }
  // sword
  if (attacking > 0) {
    const ang = [Math.PI / 2, Math.PI, 0, -Math.PI / 2][dir];
    const sweep = (1 - attacking) * 2.2 - 1.1;
    ctx.save();
    ctx.translate(px, by - 8);
    ctx.rotate(ang + sweep);
    ctx.fillStyle = "#e8eef8";
    ctx.fillRect(6, -1.5, 22, 3);
    ctx.fillStyle = "#e6c36a";
    ctx.fillRect(4, -4, 3, 8);
    ctx.restore();
    ctx.strokeStyle = `rgba(255,255,255,${attacking * 0.7})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, by - 8, 26, ang - 1.1, ang + 1.1);
    ctx.stroke();
  }
}

export function drawMonster(ctx: Ctx, kind: MonsterKind, x: number, y: number, t: number, hurt: number, hpFrac: number, size: number) {
  const px = x * S;
  const py = y * S;
  const R = size * S;
  shadow(ctx, px, py, R * 0.8, R * 0.3, 0.35);
  const flash = hurt > 0;
  switch (kind) {
    case "slime": {
      const sq = Math.sin(t * 6) * 0.12;
      ctx.fillStyle = flash ? "#ffffff" : "rgba(110,200,90,0.9)";
      ctx.beginPath();
      ctx.ellipse(px, py - R * 0.5, R * (0.8 + sq), R * (0.6 - sq), 0, Math.PI, 0);
      ctx.lineTo(px + R * (0.8 + sq), py);
      ctx.lineTo(px - R * (0.8 + sq), py);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(px - R * 0.3, py - R * 0.75, R * 0.18, R * 0.1, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a2a1a";
      ctx.fillRect(px - 5, py - R * 0.5, 3, 4);
      ctx.fillRect(px + 2, py - R * 0.5, 3, 4);
      break;
    }
    case "wolf":
    case "shade": {
      const shade = kind === "shade";
      const leg = Math.sin(t * 10) * 3;
      ctx.globalAlpha = shade ? 0.82 : 1;
      ctx.fillStyle = flash ? "#ffffff" : shade ? "#1a1024" : "#7a7a84";
      ctx.beginPath();
      ctx.ellipse(px, py - R * 0.6, R * 0.95, R * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px + R * 0.75, py - R * 0.95, R * 0.38, R * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + R * 0.6, py - R * 1.2);
      ctx.lineTo(px + R * 0.7, py - R * 1.5);
      ctx.lineTo(px + R * 0.85, py - R * 1.2);
      ctx.fill();
      ctx.fillRect(px - R * 0.6, py - R * 0.3, 4, R * 0.3 + leg);
      ctx.fillRect(px + R * 0.4, py - R * 0.3, 4, R * 0.3 - leg);
      ctx.fillStyle = shade ? "#ff3a5a" : "#f0d040";
      ctx.fillRect(px + R * 0.85, py - R * 1.02, 3, 3);
      if (shade) {
        ctx.fillStyle = "rgba(120,60,180,0.25)";
        ctx.beginPath();
        ctx.arc(px, py - R * 0.7, R * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "spiderling":
    case "cave_spider": {
      ctx.strokeStyle = flash ? "#fff" : "#2a1a2a";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const l = Math.sin(t * 12 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(px, py - R * 0.5);
        ctx.lineTo(px - R - 2, py - R * 0.3 + i * 4 + l);
        ctx.moveTo(px, py - R * 0.5);
        ctx.lineTo(px + R + 2, py - R * 0.3 + i * 4 - l);
        ctx.stroke();
      }
      blob(ctx, px, py - R * 0.6, R * 0.6, flash ? "#fff" : kind === "cave_spider" ? "#436a78" : "#9a4ab0", "#3a1a4a");
      ctx.fillStyle = "#ff5050";
      ctx.fillRect(px - 4, py - R * 0.8, 2, 2);
      ctx.fillRect(px + 2, py - R * 0.8, 2, 2);
      break;
    }
    case "vinecrawler": {
      ctx.strokeStyle = flash ? "#fff" : "#2f6a2a";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.sin(t * 2) * 0.3;
        ctx.beginPath();
        ctx.moveTo(px, py - R * 0.4);
        ctx.quadraticCurveTo(px + Math.cos(a) * R, py - R * 0.4 + Math.sin(a) * R * 0.3 - 10, px + Math.cos(a) * R * 1.2, py - R * 0.2 + Math.sin(a) * R * 0.4);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      blob(ctx, px, py - R * 0.6, R * 0.5, flash ? "#fff" : "#d050a0", "#5a1a4a");
      break;
    }
    case "golem": {
      ctx.fillStyle = flash ? "#fff" : "#8a8478";
      ctx.fillRect(px - R * 0.7, py - R * 1.6, R * 1.4, R * 1.2);
      ctx.fillRect(px - R * 0.5, py - R * 2.1, R, R * 0.55);
      ctx.fillRect(px - R * 1.05, py - R * 1.5, R * 0.35, R * 1.1);
      ctx.fillRect(px + R * 0.7, py - R * 1.5, R * 0.35, R * 1.1);
      ctx.fillRect(px - R * 0.55, py - R * 0.4, R * 0.4, R * 0.4);
      ctx.fillRect(px + R * 0.15, py - R * 0.4, R * 0.4, R * 0.4);
      ctx.fillStyle = `rgba(110,220,255,${0.6 + Math.sin(t * 3) * 0.3})`;
      ctx.fillRect(px - R * 0.3, py - R * 1.9, R * 0.6, 4);
      ctx.fillRect(px - 3, py - R * 1.2, 6, 10);
      break;
    }
    case "goblin":
    case "shadow_goblin": {
      const bob = Math.sin(t * 7) * 2;
      ctx.fillStyle = flash ? "#fff" : kind === "shadow_goblin" ? "#342b48" : "#65934c";
      ctx.beginPath(); ctx.ellipse(px, py - R * 1.0 + bob, R * 0.55, R * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : kind === "shadow_goblin" ? "#55456c" : "#8bb85b";
      ctx.beginPath(); ctx.arc(px, py - R * 1.8 + bob, R * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7b4d2d"; ctx.beginPath(); ctx.moveTo(px - R * 0.35, py - R * 2.0 + bob); ctx.lineTo(px - R * 0.95, py - R * 2.5 + bob); ctx.lineTo(px - R * 0.65, py - R * 1.75 + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + R * 0.35, py - R * 2.0 + bob); ctx.lineTo(px + R * 0.95, py - R * 2.5 + bob); ctx.lineTo(px + R * 0.65, py - R * 1.75 + bob); ctx.fill();
      ctx.fillStyle = "#f6df7b"; ctx.fillRect(px - 6, py - R * 1.9 + bob, 3, 3); ctx.fillRect(px + 3, py - R * 1.9 + bob, 3, 3);
      ctx.fillStyle = "#6b4530"; ctx.fillRect(px - R * 0.42, py - R * 0.55, R * 0.84, R * 0.22);
      break;
    }
    case "boar": {
      const charge = Math.sin(t * 11) * 2;
      ctx.fillStyle = flash ? "#fff" : "#80513b";
      ctx.beginPath(); ctx.ellipse(px, py - R * 0.62, R * 1.0, R * 0.56, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = flash ? "#fff" : "#9b6b4b";
      ctx.beginPath(); ctx.ellipse(px + R * 0.65 + charge, py - R * 0.82, R * 0.45, R * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f3e7cb"; ctx.beginPath(); ctx.moveTo(px + R * 0.72 + charge, py - R * 0.55); ctx.lineTo(px + R * 1.0 + charge, py - R * 0.2); ctx.lineTo(px + R * 0.85 + charge, py - R * 0.6); ctx.fill();
      ctx.fillStyle = "#201a18"; ctx.fillRect(px + R * 0.82 + charge, py - R * 0.95, 3, 3);
      ctx.fillStyle = "#503323"; ctx.fillRect(px - R * 0.6, py - R * 0.25, 5, R * 0.32); ctx.fillRect(px + R * 0.3, py - R * 0.25, 5, R * 0.32);
      break;
    }
    case "treant":
    case "root_guardian": {
      const sway = Math.sin(t * 1.7) * 3;
      ctx.fillStyle = flash ? "#fff" : kind === "root_guardian" ? "#3d5960" : "#60432b"; ctx.fillRect(px - R * 0.42, py - R * 1.55, R * 0.84, R * 1.5);
      ctx.fillStyle = flash ? "#fff" : kind === "root_guardian" ? "#2c6b68" : "#4c7838";
      ctx.beginPath(); ctx.arc(px + sway, py - R * 1.85, R * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px - R * 0.45 + sway, py - R * 2.2, R * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + R * 0.45 + sway, py - R * 2.18, R * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = flash ? "#fff" : kind === "root_guardian" ? "#3d5960" : "#60432b"; ctx.lineWidth = Math.max(3, R * 0.22);
      ctx.beginPath(); ctx.moveTo(px - R * 0.25, py - R * 1.35); ctx.lineTo(px - R * 0.9, py - R * 0.8 + sway); ctx.moveTo(px + R * 0.25, py - R * 1.35); ctx.lineTo(px + R * 0.9, py - R * 0.8 - sway); ctx.stroke();
      ctx.fillStyle = "#d8b95f"; ctx.fillRect(px - 7, py - R * 2.0, 4, 4); ctx.fillRect(px + 3, py - R * 2.0, 4, 4);
      break;
    }
    case "hollowroot_guardian": {
      const pulse = 0.7 + Math.sin(t * 2.4) * 0.18;
      ctx.fillStyle = flash ? "#fff" : "#344c48";
      ctx.beginPath(); ctx.moveTo(px - R * 0.85, py); ctx.lineTo(px - R * 0.55, py - R * 1.7); ctx.lineTo(px - R * 0.2, py - R * 2.2); ctx.lineTo(px + R * 0.45, py - R * 1.8); ctx.lineTo(px + R * 0.9, py); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = flash ? "#fff" : "#594936"; ctx.lineWidth = Math.max(4, R * 0.22);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(px + i * R * 0.35, py - R * 1.5); ctx.lineTo(px + i * R * 1.05, py - R * (0.7 + Math.sin(t * 2 + i) * 0.1)); ctx.stroke(); }
      ctx.fillStyle = `rgba(49,230,205,${pulse})`; ctx.shadowColor = "#31e6cd"; ctx.shadowBlur = 18;
      ctx.fillRect(px - R * 0.34, py - R * 1.8, R * 0.18, R * 0.1); ctx.fillRect(px + R * 0.16, py - R * 1.8, R * 0.18, R * 0.1);
      ctx.shadowBlur = 0; ctx.fillStyle = "#80b9aa"; ctx.beginPath(); ctx.arc(px, py - R * 1.4, R * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "skeleton":
    case "ancient_skeleton":
    case "hollow_king":
    case "dungeon_wraith": {
      const king = kind === "hollow_king";
      if (kind === "dungeon_wraith") {
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = flash ? "#fff" : "#253d66";
        ctx.beginPath(); ctx.moveTo(px, py - R * 2.5); ctx.quadraticCurveTo(px + R, py - R * 1.4, px + R * 0.6, py); ctx.lineTo(px - R * 0.6, py); ctx.quadraticCurveTo(px - R, py - R * 1.4, px, py - R * 2.5); ctx.fill();
        ctx.fillStyle = "#6df6ff"; ctx.fillRect(px - 6, py - R * 1.9, 4, 4); ctx.fillRect(px + 2, py - R * 1.9, 4, 4); ctx.globalAlpha = 1;
      }
      const sw = Math.sin(t * 8) * 2;
      if (king) {
        ctx.fillStyle = "rgba(140,60,200,0.25)";
        ctx.beginPath();
        ctx.arc(px, py - R, R * 1.4 + Math.sin(t * 2) * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flash ? "#fff" : "#2a1838";
        ctx.beginPath();
        ctx.moveTo(px - R * 0.8, py);
        ctx.lineTo(px - R * 0.5, py - R * 1.4);
        ctx.lineTo(px + R * 0.5, py - R * 1.4);
        ctx.lineTo(px + R * 0.8, py);
        ctx.fill();
      }
      const bone = flash ? "#ffffff" : king ? "#d8cfe8" : "#e8e2d0";
      ctx.fillStyle = bone;
      const u = king ? R * 0.45 : R * 0.55;
      ctx.fillRect(px - u * 0.15, py - u * 2.6, u * 0.3, u * 1.6);
      for (let i = 0; i < 3; i++) ctx.fillRect(px - u * 0.5, py - u * 2.4 + i * u * 0.35, u, u * 0.15);
      ctx.fillRect(px - u * 0.45 + sw, py - u * 1, u * 0.2, u);
      ctx.fillRect(px + u * 0.25 - sw, py - u * 1, u * 0.2, u);
      ctx.beginPath();
      ctx.arc(px, py - u * 3.1, u * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = king ? "#ff3a6a" : "#5ad0ff";
      ctx.fillRect(px - u * 0.3, py - u * 3.2, u * 0.2, u * 0.2);
      ctx.fillRect(px + u * 0.1, py - u * 3.2, u * 0.2, u * 0.2);
      if (king) {
        ctx.fillStyle = "#e6c36a";
        ctx.beginPath();
        ctx.moveTo(px - u * 0.6, py - u * 3.5);
        ctx.lineTo(px - u * 0.6, py - u * 4.1);
        ctx.lineTo(px - u * 0.3, py - u * 3.75);
        ctx.lineTo(px, py - u * 4.3);
        ctx.lineTo(px + u * 0.3, py - u * 3.75);
        ctx.lineTo(px + u * 0.6, py - u * 4.1);
        ctx.lineTo(px + u * 0.6, py - u * 3.5);
        ctx.fill();
      }
      ctx.fillStyle = "#a0a8b8";
      ctx.fillRect(px + u * 0.6, py - u * 2.6 + sw, 3, u * 1.6);
      break;
    }
  }
  if (hpFrac < 1) {
    const w = Math.max(26, R * 1.6);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(px - w / 2, py - R * 2.4 - 8, w, 5);
    ctx.fillStyle = (kind === "hollow_king" || kind === "hollowroot_guardian") ? "#40d8bd" : "#e04848";
    ctx.fillRect(px - w / 2 + 1, py - R * 2.4 - 7, (w - 2) * hpFrac, 3);
  }
}
