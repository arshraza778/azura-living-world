import type { NPC } from "../core/types";
import type { NpcDef } from "../data/places";

export function makeNpc(d: NpcDef): NPC {
  return {
    id: d.id,
    name: d.name,
    title: d.title,
    x: d.x,
    y: d.y,
    homeX: d.x,
    homeY: d.y,
    dir: 0,
    look: d.look,
    lines: d.lines,
    role: d.role,
    wander: !!d.wander,
    wait: 1,
    pathI: 0,
    ...(d.path ? { path: d.path } : {}),
    ...(d.activity ? { activity: d.activity } : {}),
    walk: 0,
  };
}
