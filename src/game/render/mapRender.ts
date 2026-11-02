import { REGIONS } from "../data/regions";
import { T, TILE_COLORS } from "../data/tiles";
import { getScene } from "../world/scenes";

export const MAP_SCALE = 4;
let cached: HTMLCanvasElement | null = null;

/** Painted overview of the overworld (built once). */
export function getMapCanvas(): HTMLCanvasElement {
  if (cached) return cached;
  const s = getScene("overworld");
  const c = document.createElement("canvas");
  c.width = s.w * MAP_SCALE;
  c.height = s.h * MAP_SCALE;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      const g = s.ground[i];
      ctx.fillStyle = TILE_COLORS[g]?.[0] ?? "#000";
      ctx.fillRect(x * MAP_SCALE, y * MAP_SCALE, MAP_SCALE, MAP_SCALE);
      if (s.solid[i] && g !== T.WATER && g !== T.DEEP) {
        ctx.fillStyle = "rgba(10,30,15,0.45)";
        ctx.beginPath();
        ctx.arc(x * MAP_SCALE + 2, y * MAP_SCALE + 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      const r = s.region![i];
      if (x + 1 < s.w && s.region![i + 1] !== r && g !== T.DEEP) {
        ctx.fillStyle = "rgba(40,20,10,0.55)";
        ctx.fillRect(x * MAP_SCALE + 3, y * MAP_SCALE, 1, MAP_SCALE);
      }
      if (y + 1 < s.h && s.region![i + s.w] !== r && g !== T.DEEP) {
        ctx.fillStyle = "rgba(40,20,10,0.55)";
        ctx.fillRect(x * MAP_SCALE, y * MAP_SCALE + 3, MAP_SCALE, 1);
      }
    }
  cached = c;
  return c;
}

export function fogCanvas(discovered: string[]): HTMLCanvasElement {
  const s = getScene("overworld");
  const c = document.createElement("canvas");
  c.width = s.w;
  c.height = s.h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(s.w, s.h);
  for (let i = 0; i < s.w * s.h; i++) {
    const hidden = !discovered.includes(REGIONS[s.region![i]].id) && s.ground[i] !== T.DEEP;
    img.data[i * 4] = 214; img.data[i * 4 + 1] = 196; img.data[i * 4 + 2] = 150;
    img.data[i * 4 + 3] = hidden ? 200 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
