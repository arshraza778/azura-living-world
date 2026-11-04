import type { Dir, MonsterKind, NPC, Scene, SceneId, Trigger } from "../core/types";
import { MONSTERS } from "../data/monsters";
import { lookFor, POIS } from "../data/places";
import { REGIONS, TILE } from "../data/regions";
import { ITEMS } from "../data/items";
import { CHUNK, drawCharacter, drawDecor, drawMonster, drawTraps, drawWaterFx, getChunk, trapUp } from "../render/draw";
import { getScene } from "../world/scenes";
import { getRemotePlayers, publishPosition } from "../network/multiplayer";
import { addItem, addXp, attackPower, checkMissionReadiness, emit, game, openDialogue, openPanel, save, toast, gatherResource, addMasteryXp, statEffects, incomingDamage, staminaCost } from "../state/store";

interface Monster { kind: MonsterKind; x: number; y: number; hx: number; hy: number; hp: number; cd: number; hurt: number; dead: number; t: number; wx: number; wy: number }
interface GroundDrop { id: string; x: number; y: number; amount: number; age: number; scene: SceneId }
interface ResourceNode { id: string; item: string; x: number; y: number; icon: string; respawn: number; cooldown: number }

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  keys = new Set<string>();
  scene!: Scene;
  monsters = new Map<SceneId, Monster[]>();
  dir: Dir = 0;
  walk = 0;
  atk = 0;
  atkCd = 0;
  hurt = 0;
  trapCd = 0;
  t = 0;
  last = 0;
  raf = 0;
  emitT = 0;
  saveT = 0;
  networkT = 0;
  tint = { dark: 0 };
  target: { npc?: NPC; trig?: Trigger; drop?: GroundDrop; resource?: ResourceNode } | null = null;
  drops: GroundDrop[] = [];
  resources = new Map<SceneId, ResourceNode[]>();
  gatherTimer = 0;
  gatherTimeout: number | undefined;
  dodge = 0;
  deathTimer = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    const p = game.data.pos;
    this.enter(p.scene, p.x, p.y, true);
    window.addEventListener("azura:network-position", this.networkPosition as EventListener);
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    this.canvas.addEventListener("click", this.mc);
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.gatherTimeout);
    window.removeEventListener("azura:network-position", this.networkPosition as EventListener);
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    this.canvas.removeEventListener("click", this.mc);
  }
  networkPosition = (event: Event) => {
    const detail = (event as CustomEvent<{ scene: SceneId; x: number; y: number }>).detail;
    if (detail && detail.scene && Number.isFinite(detail.x) && Number.isFinite(detail.y)) this.enter(detail.scene, detail.x, detail.y, true);
  };
  kd = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === "escape") return openPanel(null);
    if (k === "m") return openPanel("map");
    if (k === "i") return openPanel("inventory");
    if (k === "c") return openPanel("character");
    if (k === "j" || k === "q") return openPanel("quests");
    if (k === "k") return openPanel("crafting");
    if (k === "v") return openPanel("farming");
    if (game.ui.panel) return;
    if (k === "e") this.interact();
    if (k === " ") this.evade();
    if (k === "f") this.attack();
    this.keys.add(k);
  };
  ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  mc = () => { if (!game.ui.panel && this.scene.id !== "guild" && this.scene.id !== "inn" && this.scene.id !== "cottage") this.attack(); };

  enter(id: SceneId, x: number, y: number, initial = false) {
    this.scene = getScene(id);
    for (const trigger of [...this.scene.triggers]) {
      if (trigger.action.type === "keydoor") {
        const a = trigger.action, marker = `door:${id}:${a.x},${a.y}`;
        if (game.data.openedChests.includes(marker)) {
          this.scene.solid[a.y * this.scene.w + a.x] = 0;
          this.scene.decor = this.scene.decor.filter((deco) => !(deco.kind === "sealeddoor" && Math.floor(deco.x) === a.x && Math.floor(deco.y) === a.y));
          this.scene.triggers = this.scene.triggers.filter((tr) => tr.action !== a);
        }
      }
    }
    if (x < 0) ({ x, y } = this.scene.spawn);
    game.data.pos = { scene: id, x, y };
    if (!this.resources.has(id)) this.resources.set(id, this.makeResources(id));
    if (!this.monsters.has(id))
      this.monsters.set(id, this.scene.spawns.map((s) => ({ kind: s.kind, x: s.x, y: s.y, hx: s.x, hy: s.y, hp: MONSTERS[s.kind].hp, cd: 0, hurt: 0, dead: 0, t: 0, wx: s.x, wy: s.y })));
    game.ui.sceneName = this.scene.name;
    if (id === "dungeon1") this.discoverPoi("hollowroot_depths", "Hollowroot Depths");
    if (id !== "overworld") game.ui.banner = { title: this.scene.name, sub: id === "guild" ? "Eldergrove" : "Hollowroot Dungeon", danger: id === "guild" ? 1 : 4, key: Date.now() };
    if (!initial) { game.ui.fade = 1; save(); }
    emit();
  }

  makeResources(id: SceneId): ResourceNode[] {
    if (id !== "overworld") return [];
    const s = this.scene, nodes: ResourceNode[] = [];
    const types = [
      { item: "wood", icon: "🪵", region: "verdant", count: 10 },
      { item: "stone", icon: "🪨", region: "verdant", count: 5 },
      { item: "iron_ore", icon: "⛏️", region: "thornveil", count: 4 },
      { item: "copper_ore", icon: "🟠", region: "thornveil", count: 3 },
      { item: "herb", icon: "🌿", region: "verdant", count: 7 },
      { item: "mushroom", icon: "🍄", region: "thornveil", count: 5 },
      { item: "rare_herb", icon: "🌸", region: "thornveil", count: 2 },
    ];
    let seed = 731;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const type of types) {
      const ri = REGIONS.findIndex(r => r.id === type.region); let made = 0, tries = 0;
      while (made < type.count && tries++ < 3000) {
        const x = Math.floor(rand() * (s.w - 4)) + 2, y = Math.floor(rand() * (s.h - 4)) + 2;
        if (s.region?.[y * s.w + x] !== ri || this.solidAt(x, y) || Math.hypot(x - game.data.pos.x, y - game.data.pos.y) < 9) continue;
        nodes.push({ id: `${type.item}-${made}-${nodes.length}`, item: type.item, x: x + .5, y: y + .5, icon: type.icon, respawn: 90, cooldown: Math.max(0, ((game.data.growth.resourceReadyAt[`${id}:${type.item}-${made}-${nodes.length}`] ?? 0) - Date.now()) / 1000) }); made++;
      }
    }
    return nodes;
  }

  solidAt(x: number, y: number) {
    const s = this.scene;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) return true;
    return s.solid[ty * s.w + tx] === 1;
  }
  blocked(x: number, y: number, r = 0.28) {
    return this.solidAt(x - r, y - 0.2) || this.solidAt(x + r, y - 0.2) || this.solidAt(x - r, y + 0.05) || this.solidAt(x + r, y + 0.05);
  }

  discoverPoi(id: string, name: string) {
    if (game.data.discoveredPois.includes(id)) return;
    game.data.discoveredPois.push(id);
    if (id === "hollowroot_depths" && !game.data.discoveredRecipes?.includes("iron_sword")) { game.data.discoveredRecipes ??= []; game.data.discoveredRecipes.push("iron_sword"); toast("Recipe discovered: Ironbark Sword.", "gold"); }
    toast(`Discovered: ${name}`, "gold");
    addMasteryXp("exploration", 15);
    addXp(10);
    checkMissionReadiness();
    save();
  }

  interact() {
    const tg = this.target;
    if (!tg) return;
    if ((tg as any).resource) {
      const node = (tg as any).resource as ResourceNode;
      if (node.cooldown > 0) return toast("This resource is regrowing.", "info");
      if (node.item === "wood" || node.item === "branch") {
        if (!game.data.inventory["axe"]) return toast("You need an axe to harvest this tree.", "bad");
      }
      if (["stone", "iron_ore", "copper_ore"].includes(node.item) && !game.data.inventory["pickaxe"]) return toast("You need a pickaxe to mine this deposit.", "bad");
      if (this.gatherTimer > 0) return;
      this.gatherTimer = 0.9 * statEffects(game.data).gatheringTime;
      const nodeRef = node, sceneId = this.scene.id;
      this.gatherTimeout = window.setTimeout(() => {
        this.gatherTimer = 0;
        if (this.scene.id !== sceneId || game.data.hp <= 0 || Math.hypot(game.data.pos.x-nodeRef.x, game.data.pos.y-nodeRef.y) > 2.2) return;
        nodeRef.cooldown = nodeRef.respawn;
        game.data.growth.resourceReadyAt[`${sceneId}:${nodeRef.id}`] = Date.now() + nodeRef.respawn * 1000;
        gatherResource(nodeRef.item, nodeRef.item === "wood" ? 2 : 1);
        this.target = null; game.ui.prompt = null; emit();
      }, this.gatherTimer * 1000);
      toast("Gathering…", "info"); return;
    }
    if (tg.drop) {
      addItem(tg.drop.id, tg.drop.amount);
      this.drops = this.drops.filter((drop) => drop !== tg.drop);
      checkMissionReadiness();
      toast(`Collected ${tg.drop.amount}× ${ITEMS[tg.drop.id]?.name ?? tg.drop.id}.`, "good");
      save(); emit();
      return;
    }
    if (tg.npc) {
      const n = tg.npc;
      openDialogue({ name: n.name, title: n.title, lines: n.lines, role: n.role });
      return;
    }
    const a = tg.trig!.action;
    if (a.type === "scene") this.enter(a.to, a.x, a.y);
    else if (a.type === "board") openPanel("guild");
    else if (a.type === "homeStorage") openPanel("home");
    else if (a.type === "inspect" || a.type === "locked") openDialogue({ name: a.title, lines: [a.text], role: "info" });
    else if (a.type === "keydoor") {
      if (!game.data.inventory[a.key]) return toast("The seal needs a Rootbound Key. Search the treasure chests.", "bad");
      game.data.inventory[a.key]--;
      if (game.data.inventory[a.key] <= 0) delete game.data.inventory[a.key];
      this.scene.solid[a.y * this.scene.w + a.x] = 0;
      game.data.openedChests.push(`door:${this.scene.id}:${a.x},${a.y}`);
      this.scene.decor = this.scene.decor.filter((deco) => !(deco.kind === "sealeddoor" && Math.floor(deco.x) === a.x && Math.floor(deco.y) === a.y));
      this.scene.triggers = this.scene.triggers.filter((tr) => tr.action !== a);
      toast("The Rootbound Key turns. The secret passage opens.", "gold"); save(); emit();
    }
    else if (a.type === "chest") {
      if (game.data.openedChests.includes(a.id)) return toast("It's empty now.");
      game.data.openedChests.push(a.id);
      for (const [k, n] of Object.entries(a.loot)) addItem(k, n);
      game.data.gold += a.gold;
      toast(`Found ${Object.entries(a.loot).map(([k, n]) => `${n}× ${ITEMS[k]?.name}`).join(", ")}${a.gold ? ` and ${a.gold} gold` : ""}`, "gold");
      save(); emit();
    }
  }

  evade() {
    const d = game.data;
    if (this.dodge > 0 || d.stamina < staminaCost(d, 18, true)) return;
    d.stamina -= staminaCost(d, 18, true); this.dodge = 0.28;
    const [fx, fy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.dir];
    const nx = d.pos.x - fx * 1.15, ny = d.pos.y - fy * 1.15;
    if (!this.blocked(nx, d.pos.y)) d.pos.x = nx;
    if (!this.blocked(d.pos.x, ny)) d.pos.y = ny;
    this.hurt = -0.22; save(); emit();
  }

  attack() {
    const d = game.data;
    if (this.atkCd > 0 || d.stamina < staminaCost(d, 6)) return;
    d.stamina -= staminaCost(d, 6);
    this.atk = 1;
    this.atkCd = 0.38 * statEffects(d).attackInterval;
    const p = d.pos;
    const [fx, fy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.dir];
    for (const m of this.monsters.get(this.scene.id) ?? []) {
      if (m.dead > 0) continue;
      const def = MONSTERS[m.kind];
      const dx = m.x - (p.x + fx * 0.6), dy = m.y - (p.y + fy * 0.6);
      if (Math.hypot(dx, dy) > 1.1 + def.size) continue;
      m.hp -= attackPower(d);
      m.hurt = 0.15;
      m.x += fx * 0.4; m.y += fy * 0.4;
      if (this.blocked(m.x, m.y)) { m.x -= fx * 0.4; m.y -= fy * 0.4; }
      if (m.hp <= 0) {
        m.dead = def.respawn;
        d.kills[m.kind] = (d.kills[m.kind] ?? 0) + 1;
        addMasteryXp("combat", Math.max(4, Math.min(25, def.xp)), 3000);
        addXp(def.xp);
        d.gold += def.gold;
        this.drops.push({ id: def.drop, x: m.x, y: m.y, amount: 1, age: 0, scene: this.scene.id });
        if (m.kind === "hollowroot_guardian") {
          this.drops.push({ id: "deepwarden_mail", x: m.x + 0.35, y: m.y + 0.15, amount: 1, age: 0, scene: this.scene.id });
          this.drops.push({ id: "crystal_charm", x: m.x - 0.35, y: m.y + 0.15, amount: 1, age: 0, scene: this.scene.id });
          toast("The Hollowroot Guardian falls! Its core and ancient treasures scatter across the chamber.", "gold");
        }
        if (Math.random() < 0.22) this.drops.push({ id: Math.random() < 0.6 ? "apple" : "healing_potion", x: m.x + 0.35, y: m.y + 0.2, amount: 1, age: 0, scene: this.scene.id });
        toast(`${def.name} defeated · +${def.xp} XP · loot dropped nearby`, def.boss ? "gold" : "good");
        checkMissionReadiness();
        save();
      }
    }
  }

  loop = (now: number) => {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    const d = game.data;
    const p = d.pos;
    const paused = !!game.ui.panel;
    if (this.deathTimer > 0) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      if (this.deathTimer === 0) {
        d.hp = Math.round(d.maxHp * 0.5); d.stamina = d.maxStamina; d.hunger = Math.max(d.hunger, 40);
        d.gold = Math.floor(d.gold * 0.9);
        this.enter("overworld", 106, 77);
        toast("Reincarnated in Eldergrove. Level, experience and inventory preserved; 10% gold lost.", "good");
        save();
      }
    }
    if (game.ui.fade > 0) game.ui.fade = Math.max(0, game.ui.fade - dt * 2);
    this.atk = Math.max(0, this.atk - dt * 4);
    this.atkCd -= dt; this.hurt -= dt; this.trapCd -= dt; this.dodge = Math.max(0, this.dodge - dt);
    if (!paused && this.deathTimer <= 0) {
      let vx = 0, vy = 0;
      const k = this.keys;
      if (k.has("a") || k.has("arrowleft")) vx--;
      if (k.has("d") || k.has("arrowright")) vx++;
      if (k.has("w") || k.has("arrowup")) vy--;
      if (k.has("s") || k.has("arrowdown")) vy++;
      const moving = vx || vy;
      const sprint = k.has("shift") && d.stamina > 1 && moving;
      if (moving) {
        // input is screen-relative; convert to world space for isometric movement
        const [wx, wy] = screenToWorldDir(vx, vy);
        const sp = 4.2 * statEffects(d).movement * (sprint ? 1.6 : 1) * dt;
        const nx = p.x + wx * sp, ny = p.y + wy * sp;
        if (!this.blocked(nx, p.y)) p.x = nx;
        if (!this.blocked(p.x, ny)) p.y = ny;
        this.dir = Math.abs(wx) > Math.abs(wy) ? (wx < 0 ? 1 : 2) : wy < 0 ? 3 : 0;
        this.sdir = facing(vx, vy);
        this.walk += dt * (sprint ? 1.5 : 1);
      }
      d.stamina = sprint ? Math.max(0, d.stamina - staminaCost(d, 25) * dt) : Math.min(d.maxStamina, d.stamina + 14 * dt);
      d.hunger = Math.max(0, d.hunger - 0.18 * statEffects(d).hunger * dt);
      if (d.hunger <= 0) d.hp -= 1 * dt;
      else if (d.hunger > 40) d.hp = Math.min(d.maxHp, d.hp + 0.6 * dt);

      // region
      const s = this.scene;
      if (s.region) {
        const ri = s.region[Math.floor(p.y) * s.w + Math.floor(p.x)];
        const r = REGIONS[ri];
        if (r && r.id !== game.ui.regionId) {
          game.ui.regionId = r.id;
          game.ui.banner = { title: r.name, sub: r.subtitle, danger: r.danger, key: Date.now() };
          if (!d.discoveredRegions.includes(r.id)) {
            d.discoveredRegions.push(r.id);
            toast(`New region discovered: ${r.name}`, "gold");
            addMasteryXp("exploration", 20);
            addXp(25);
            checkMissionReadiness();
            save();
          }
          emit();
        }
        for (const poi of POIS) if (Math.hypot(poi.x - p.x, poi.y - p.y) < 5) this.discoverPoi(poi.id, poi.name);
      }
      // traps
      for (const tr of s.traps)
        if (Math.floor(p.x) === tr.x && Math.floor(p.y) === tr.y && trapUp(tr.x, tr.y, this.t) && this.trapCd <= 0) {
          d.hp -= 8; this.trapCd = 0.8; this.hurt = 0.2; toast("Spike trap!", "bad");
        }
      // NPCs with authored paths patrol them; other wandering villagers roam near home.
      for (const n of s.npcs) {
        n.wait -= dt;
        if (n.path?.length) {
          if (n.tx === undefined && n.wait <= 0) { const [tx, ty] = n.path[n.pathI % n.path.length]; n.tx = tx; n.ty = ty; }
        } else if (n.wander && n.wait <= 0 && n.tx === undefined) {
          n.tx = n.homeX + (Math.random() - 0.5) * 6; n.ty = n.homeY + (Math.random() - 0.5) * 4;
        }
        if (n.tx !== undefined && n.ty !== undefined) {
          const dx = n.tx - n.x, dy = n.ty - n.y, l = Math.hypot(dx, dy);
          if (l < 0.12) {
            n.tx = undefined; n.ty = undefined; n.wait = n.path?.length ? 0.35 : 2 + Math.random() * 3;
            if (n.path?.length) n.pathI = (n.pathI + 1) % n.path.length;
          } else {
            const speed = n.path?.length ? 1.15 : 1.0;
            const nx = n.x + (dx / l) * speed * dt, ny = n.y + (dy / l) * speed * dt;
            if (this.blocked(nx, ny)) { n.tx = undefined; n.ty = undefined; n.wait = 1; if (n.path?.length) n.pathI = (n.pathI + 1) % n.path.length; }
            else { n.x = nx; n.y = ny; n.walk += dt; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; }
          }
        }
      }
      // monsters
      for (const m of this.monsters.get(s.id) ?? []) {
        const def = MONSTERS[m.kind];
        if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) { m.hp = def.hp; m.x = m.hx; m.y = m.hy; } continue; }
        m.hurt -= dt; m.cd -= dt; m.t += dt;
        const dist = Math.hypot(p.x - m.x, p.y - m.y);
        let tx = m.wx, ty = m.wy, sp = def.speed * 0.4;
        if (dist < def.aggro && s.id !== "guild") { tx = p.x; ty = p.y; sp = def.speed; }
        else if (Math.hypot(tx - m.x, ty - m.y) < 0.2) { m.wx = m.hx + (Math.random() - 0.5) * 6; m.wy = m.hy + (Math.random() - 0.5) * 6; }
        const dx = tx - m.x, dy = ty - m.y, l = Math.hypot(dx, dy) || 1;
        if (dist > def.size * 0.9 + 0.3) {
          const nx = m.x + (dx / l) * sp * dt, ny = m.y + (dy / l) * sp * dt;
          if (!this.blocked(nx, m.y, 0.25)) m.x = nx; else m.wx = m.x;
          if (!this.blocked(m.x, ny, 0.25)) m.y = ny; else m.wy = m.y;
        }
        if (dist < def.size + (m.kind === "hollowroot_guardian" ? 0.95 : 0.45) && m.cd <= 0) {
          const phaseTwo = m.kind === "hollowroot_guardian" && m.hp < MONSTERS[m.kind].hp * 0.5;
          const aoe = m.kind === "hollowroot_guardian" && m.hp < MONSTERS[m.kind].hp * 0.72;
          const attackRange = aoe ? 3.1 : def.size + 0.45;
          if (dist < attackRange && this.dodge <= 0) {
            d.hp -= incomingDamage(d, def.dmg);
            this.hurt = 0.2;
            if (phaseTwo && dist < 2.2) { d.hp -= incomingDamage(d, def.dmg * .45, .5); toast("The Guardian's root shockwave hits you!", "bad"); }
          }
          m.cd = m.kind === "hollowroot_guardian" ? (phaseTwo ? 1.55 : 2.0) : 1.1;
        }
      }
      // interaction target
      this.drops.forEach((drop) => { drop.age += dt; });
      let best: Engine["target"] = null, bd = 1.7;
      for (const drop of this.drops) { if (drop.scene !== s.id) continue; const dd = Math.hypot(drop.x - p.x, drop.y - p.y); if (dd < bd) { bd = dd; best = { drop }; } }
      for (const node of this.resources.get(s.id) ?? []) { node.cooldown = Math.max(0, node.cooldown - dt); if (node.cooldown > 0) continue; const dd = Math.hypot(node.x - p.x, node.y - p.y); if (dd < bd) { bd = dd; best = { resource: node } as any; } }
      for (const n of s.npcs) { const dd = Math.hypot(n.x - p.x, n.y - p.y); if (dd < bd) { bd = dd; best = { npc: n }; } }
      if (!best) for (const tr of s.triggers) if (p.x >= tr.x && p.x <= tr.x + tr.w && p.y >= tr.y && p.y <= tr.y + tr.h) { best = { trig: tr }; break; }
      this.target = best;
      const prompt = best ? ((best as any).resource ? `Gather ${ITEMS[(best as any).resource.item]?.name ?? (best as any).resource.item}` : best.drop ? `Collect ${ITEMS[best.drop.id]?.name ?? best.drop.id}` : best.npc ? `Talk to ${best.npc.name}` : best.trig!.label) : null;
      if (prompt !== game.ui.prompt) { game.ui.prompt = prompt; emit(); }
      // death
      if (d.hp <= 0 && this.deathTimer <= 0) {
        this.deathTimer = 1.25;
        this.drops = [];
        toast("You have fallen… reincarnation begins.", "bad");
      }
    }
    const targetDark = this.scene.region ? REGIONS.find((r) => r.id === game.ui.regionId)?.ambient.dark ?? 0 : this.scene.dark;
    this.tint.dark += (targetDark - this.tint.dark) * Math.min(1, dt * 2);
    this.emitT += dt; this.saveT += dt; this.networkT += dt;
    if (this.networkT >= 0.15) { this.networkT = 0; publishPosition(); }
    if (this.emitT > 0.12) { this.emitT = 0; emit(); }
    if (this.saveT > 4) { this.saveT = 0; save(); }
  }

  draw() {
    const c = this.canvas, ctx = this.ctx, s = this.scene, p = game.data.pos;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    // ---- isometric camera ----
    const zoom = Math.max(0.9, Math.min(2.6, H / (17 * TILE))) * this.zoomMul;
    const vw = W / zoom, vh = H / zoom;
    const [px0, py0] = toIso(p.x, p.y);
    let tx = px0 - vw / 2, ty = py0 - 16 - vh / 2;
    // camera bounds: iso bounding box of the scene
    const bx0 = -s.h * TILE * ISO_A, bx1 = s.w * TILE * ISO_A, by0 = -TILE * 2, by1 = ((s.w + s.h) * TILE * ISO_A) / 2;
    tx = bx1 - bx0 < vw ? (bx0 + bx1 - vw) / 2 : Math.max(bx0, Math.min(bx1 - vw, tx));
    ty = by1 - by0 < vh ? (by0 + by1 - vh) / 2 : Math.max(by0, Math.min(by1 - vh, ty));
    if (!this.camInit || this.camScene !== s.id) { this.camX = tx; this.camY = ty; this.camInit = true; this.camScene = s.id; }
    this.camX += (tx - this.camX) * 0.18; this.camY += (ty - this.camY) * 0.18;
    if (Math.abs(tx - this.camX) > vw) this.camX = tx;
    if (Math.abs(ty - this.camY) > vh) this.camY = ty;
    const cx = this.camX, cy = this.camY;
    const scr = (wx: number, wy: number): [number, number] => { const [ix, iy] = toIso(wx, wy); return [(ix - cx) * zoom, (iy - cy) * zoom]; };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = s.region ? "#174268" : "#0b0b10";
    ctx.fillRect(0, 0, c.width, c.height);
    const camM: [number, number, number, number, number, number] = [zoom * dpr, 0, 0, zoom * dpr, -cx * zoom * dpr, -cy * zoom * dpr];
    ctx.setTransform(...camM);
    // visible world-tile range (inverse-project screen corners) for culling
    const corners = [fromIso(cx, cy), fromIso(cx + vw, cy), fromIso(cx, cy + vh), fromIso(cx + vw, cy + vh)];
    const x0 = Math.floor(Math.min(...corners.map((q) => q[0]))) - 2, x1 = Math.ceil(Math.max(...corners.map((q) => q[0]))) + 2;
    const y0 = Math.floor(Math.min(...corners.map((q) => q[1]))) - 2, y1 = Math.ceil(Math.max(...corners.map((q) => q[1]))) + 2;
    const inView = (wx: number, wy: number, m = 0) => { const [ix, iy] = toIso(wx, wy); return ix > cx - 120 - m && ix < cx + vw + 120 + m && iy > cy - 40 - m && iy < cy + vh + 220 + m; };
    // ground plane: affine projection of the pre-painted chunk canvases
    ctx.save();
    ctx.transform(ISO_A, ISO_A / 2, -ISO_A, ISO_A / 2, 0, 0);
    const CS = CHUNK * TILE;
    for (let y = Math.floor(Math.max(0, y0) / CHUNK); y <= Math.floor(y1 / CHUNK); y++)
      for (let x = Math.floor(Math.max(0, x0) / CHUNK); x <= Math.floor(x1 / CHUNK); x++) {
        if (x * CHUNK >= s.w || y * CHUNK >= s.h) continue;
        if (!inView((x + 0.5) * CHUNK, (y + 0.5) * CHUNK, CHUNK * TILE)) continue;
        ctx.drawImage(getChunk(s, x, y), x * CS, y * CS);
      }
    drawWaterFx(ctx, s, Math.max(0, x0), Math.max(0, y0), Math.min(s.w, x1), Math.min(s.h, y1), this.t);
    drawTraps(ctx, s, this.t);
    ctx.restore();
    // upright sprites: each is drawn in its original local space, translated onto its iso ground anchor
    type Item = { k: number; ax: number; ay: number; ix: number; iy: number; f: () => void };
    const items: Item[] = [];
    const add = (wx: number, wy: number, f: () => void, k = depth(wx, wy)) => {
      if (!inView(wx, wy)) return;
      const [ix, iy] = toIso(wx, wy);
      items.push({ k, ax: wx * TILE, ay: wy * TILE, ix, iy, f });
    };
    for (const d of s.decor) {
      if (d.kind === "building") {
        const b = BUILDINGS.find((q) => q.id === d.label);
        if (!b) continue;
        const fx = b.x + b.w / 2, fy = b.y + b.h / 2;
        if (!inView(fx, fy, 200)) continue;
        const [ix, iy] = toIso(fx, fy);
        items.push({ k: depth(fx, fy) + 0.5, ax: fx * TILE, ay: (b.y + b.h) * TILE, ix, iy: iy + ((b.w + b.h) / 4) * TH, f: () => drawDecor(ctx, d, this.t) });
        continue;
      }
      if (d.x < x0 - 4 || d.x > x1 + 4 || d.y < y0 - 4 || d.y > y1 + 4) continue;
      add(d.x, d.y, () => drawDecor(ctx, d, this.t));
    }
    for (const n of s.npcs) add(n.x, n.y, () => drawCharacter(ctx, n.x, n.y, isoFacing(n.dir), n.walk, n.look));
    for (const remote of getRemotePlayers(s.id)) add(remote.x, remote.y, () => { const a = remote.appearance; const outfit = a?.outfit ?? "wanderer"; const hairStyle = a?.hairStyle ?? "short"; const hairColor = a?.hairColor ?? "#2a3a5a"; drawCharacter(ctx, remote.x, remote.y, 0, this.t, lookFor({ outfit, hairStyle, hairColor })); ctx.save(); ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff2c2"; ctx.strokeStyle = "#17151d"; ctx.lineWidth = 3; ctx.strokeText(remote.name, remote.x * TILE, remote.y * TILE - 30); ctx.fillText(remote.name, remote.x * TILE, remote.y * TILE - 30); ctx.restore(); });
    for (const m of this.monsters.get(s.id) ?? []) if (m.dead <= 0) add(m.x, m.y, () => {
      drawMonster(ctx, m.kind, m.x, m.y, m.t, m.hurt, m.hp / MONSTERS[m.kind].hp, MONSTERS[m.kind].size);
      if (m.kind === "hollowroot_guardian" && m.cd > 0 && m.cd < 0.42) {
        ctx.save(); ctx.strokeStyle = `rgba(70,235,210,${0.45 + Math.sin(this.t * 18) * 0.3})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(m.x * TILE, m.y * TILE, TILE * (1.2 + (0.42 - m.cd) * 3), TILE * (0.65 + (0.42 - m.cd) * 2), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    });
    for (const node of this.resources.get(s.id) ?? []) if (node.cooldown <= 0) add(node.x, node.y, () => { ctx.save(); ctx.globalAlpha = .92; ctx.font = "19px sans-serif"; ctx.textAlign = "center"; ctx.shadowColor = "#b6f2a2"; ctx.shadowBlur = 9; ctx.fillText(node.icon, node.x * TILE, node.y * TILE - 8); ctx.restore(); });
    for (const drop of this.drops) if (drop.scene === s.id) add(drop.x, drop.y, () => { const def = ITEMS[drop.id]; ctx.save(); ctx.fillStyle = "rgba(12,18,16,0.72)"; ctx.beginPath(); ctx.ellipse(drop.x * TILE, drop.y * TILE - 5, 13, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.font = "18px sans-serif"; ctx.textAlign = "center"; ctx.fillText(def?.icon ?? "✦", drop.x * TILE, drop.y * TILE - 10 - Math.sin(this.t * 3 + drop.x) * 2); ctx.restore(); }, depth(drop.x, drop.y) + 0.02);
    // player: always drawn, with an occlusion silhouette when behind tall objects
    { const [ix, iy] = toIso(p.x, p.y); items.push({ k: depth(p.x, p.y), ax: p.x * TILE, ay: p.y * TILE, ix, iy, f: () => drawCharacter(ctx, p.x, p.y, this.sdir, this.walk, lookFor(game.data.appearance), this.atk, this.hurt) }); }
    items.sort((a, b) => a.k - b.k);
    for (const it of items) {
      ctx.setTransform(...camM);
      ctx.translate(it.ix - it.ax, it.iy - it.ay);
      it.f();
    }
    ctx.setTransform(...camM);
    // faint player silhouette on top so the hero is never fully hidden by trees/buildings
    { const [ix, iy] = toIso(p.x, p.y); ctx.translate(ix - p.x * TILE, iy - p.y * TILE); ctx.globalAlpha = 0.22; drawCharacter(ctx, p.x, p.y, this.sdir, this.walk, lookFor(game.data.appearance), this.atk, this.hurt); ctx.globalAlpha = 1; }
    // lighting
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = this.tint.dark;
    if (dark > 0.02) {
      const sx = (p.x * TILE - cx) * zoom, sy = (p.y * TILE - 16 - cy) * zoom;
      const g = ctx.createRadialGradient(sx, sy, 30, sx, sy, Math.max(W, H) * 0.45);
      g.addColorStop(0, "rgba(5,5,15,0)");
      g.addColorStop(1, `rgba(5,5,15,${dark})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const l of s.lights) {
        const lx = (l.x * TILE - cx) * zoom, ly = (l.y * TILE - cy) * zoom;
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, l.r * TILE * zoom * 0.6);
        lg.addColorStop(0, "rgba(255,170,80,0.28)");
        lg.addColorStop(1, "rgba(255,170,80,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 300, ly - 300, 600, 600);
      }
    }
    const reg = s.region ? REGIONS.find((r) => r.id === game.ui.regionId) : null;
    if (reg) {
      ctx.globalAlpha = reg.ambient.tintAlpha; ctx.fillStyle = reg.ambient.tint; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      if (reg.ambient.mist > 0) for (let i = 0; i < 6; i++) {
        const mx = ((this.t * 12 + i * 260) % (W + 400)) - 200, my = (i * 173) % H;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        mg.addColorStop(0, `rgba(220,230,240,${reg.ambient.mist * 0.18})`); mg.addColorStop(1, "rgba(220,230,240,0)");
        ctx.fillStyle = mg; ctx.fillRect(mx - 220, my - 220, 440, 440);
      }
      if (reg.ambient.fireflies > 0) for (let i = 0; i < 30 * reg.ambient.fireflies; i++) {
        const fx = (i * 97 + Math.sin(this.t * 0.5 + i) * 60 + W) % W, fy = (i * 61 + Math.cos(this.t * 0.4 + i * 2) * 40 + H) % H;
        ctx.fillStyle = `rgba(255,240,140,${0.4 + Math.sin(this.t * 3 + i) * 0.4})`;
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (this.hurt > 0) { ctx.fillStyle = `rgba(200,20,20,${this.hurt})`; ctx.fillRect(0, 0, W, H); }
    const boss = (this.monsters.get(s.id) ?? []).find((m) => m.kind === "hollowroot_guardian" && m.dead <= 0);
    if (boss) {
      const bw = Math.min(520, W * 0.58), bx = (W - bw) / 2, by = 82;
      ctx.fillStyle = "rgba(8,12,16,0.82)"; ctx.fillRect(bx - 12, by - 26, bw + 24, 46);
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 14px Georgia, serif"; ctx.fillStyle = "#b9eee1"; ctx.fillText("THE HOLLOWROOT GUARDIAN", W / 2, by - 15);
      ctx.fillStyle = "#25302f"; ctx.fillRect(bx, by, bw, 10); ctx.fillStyle = boss.hp < MONSTERS[boss.kind].hp * 0.5 ? "#43d6c0" : "#267e74"; ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, boss.hp / MONSTERS[boss.kind].hp), 8);
    }
    if (this.deathTimer > 0) {
      ctx.fillStyle = `rgba(8,7,16,${Math.min(0.88, 0.62 + (1.25 - this.deathTimer) * 0.18)})`; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8c982"; ctx.font = "bold 30px Georgia, serif"; ctx.fillText("FALLEN IN THE WILDS", W / 2, H / 2 - 22);
      ctx.fillStyle = "#f0e7d2"; ctx.font = "16px Georgia, serif"; ctx.fillText("The spirit returns to Eldergrove…", W / 2, H / 2 + 18);
    }
    if (game.ui.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${game.ui.fade})`; ctx.fillRect(0, 0, W, H); }
  }
}
