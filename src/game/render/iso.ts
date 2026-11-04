import type { Dir } from "../core/types";
import { TILE } from "../data/regions";

/**
 * 2:1 isometric projection. Gameplay stays in world tile coordinates;
 * only rendering projects. ISO_A scales world pixels to screen pixels.
 *   screenX = (wx - wy) * TILE * ISO_A
 *   screenY = (wx + wy) * TILE * ISO_A / 2
 */
export const ISO_A = 0.8;
export const TW = TILE * ISO_A * 2; // diamond width
export const TH = TW / 2; // diamond height

export function toIso(wx: number, wy: number): [number, number] {
  return [(wx - wy) * TILE * ISO_A, ((wx + wy) * TILE * ISO_A) / 2];
}

export function fromIso(sx: number, sy: number): [number, number] {
  const u = sx / (TILE * ISO_A), v = (2 * sy) / (TILE * ISO_A);
  return [(u + v) / 2, (v - u) / 2];
}

/** Screen-space input direction -> normalised world-space vector. */
export function screenToWorldDir(sx: number, sy: number): [number, number] {
  const wx = sy + sx / 2, wy = sy - sx / 2;
  const l = Math.hypot(wx, wy) || 1;
  return [wx / l, wy / l];
}

/** Pick a 4-way sprite facing from a screen-space vector. */
export function facing(sx: number, sy: number): Dir {
  return Math.abs(sx) > Math.abs(sy) * 1.2 ? (sx < 0 ? 1 : 2) : sy < 0 ? 3 : 0;
}

const WV: [number, number][] = [[0, 1], [-1, 0], [1, 0], [0, -1]];
/** Convert a world-space facing to a screen-space sprite facing. */
export function isoFacing(worldDir: Dir): Dir {
  const [dx, dy] = WV[worldDir];
  return facing(dx - dy, (dx + dy) / 2);
}

/** Depth key: larger = closer to camera. */
export const depth = (wx: number, wy: number) => wx + wy;
