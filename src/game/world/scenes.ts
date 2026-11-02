import type { Scene, SceneId } from "../core/types";
import { buildDungeon1, buildDungeon2, buildGuild } from "./interiors";
import { generateOverworld } from "./overworld";

const cache = new Map<SceneId, Scene>();

const builders: Record<SceneId, () => Scene> = {
  overworld: generateOverworld,
  guild: buildGuild,
  dungeon1: buildDungeon1,
  dungeon2: buildDungeon2,
};

/** Lazily build & cache a scene (never at module scope). */
export function getScene(id: SceneId): Scene {
  let s = cache.get(id);
  if (!s) {
    s = builders[id]();
    cache.set(id, s);
  }
  return s;
}
