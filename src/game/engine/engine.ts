import type { Dir, MonsterKind, NPC, Scene, SceneId, Trigger } from "../core/types";
import { MONSTERS } from "../data/monsters";
import { PLAYER_LOOK, POIS } from "../data/places";
import { REGIONS, TILE } from "../data/regions";
import { ITEMS } from "../data/items";
import { CHUNK, drawCharacter, drawDecor, drawMonster, drawTraps, drawWaterFx, getChunk, trapUp } from "../render/draw";
import { getScene } from "../world/scenes";
import { addItem, addXp, checkMissionReadiness, emit, game, openDialogue, openPanel, save, toast } from "../state/store";

interface Monster { kind: MonsterKind; x: number; y: number; hx: number; hy: number; hp: number; cd: number; hurt: number; dead: number; t: number; wx: number; wy: number }

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
  tint = { dark: 0 };
  target: { npc?: NPC; trig?: Trigger } | null = null;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    const p = game.data.pos;
    this.enter(p.scene, p.x, p.y, true);
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
  }
  kd = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === "escape") return openPanel(null);
    if (k === "m") return openPanel("map");
    if (k === "i") return openPanel("inventory");
    if (k === "c") return openPanel("character");
    if (k === "j" || k === "q") return openPanel("quests");
    if (game.ui.panel) return;
    if (k === "e") this.interact();
    if (k === " ") this.attack();
    this.keys.add(k);
  };
  ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  enter(id: SceneId, x: number, y: number, initial = false) {
    this.scene = getScene(id);
    if (x < 0) ({ x, y } = this.scene.spawn);
    game.data.pos = { scene: id, x, y };
    if (!this.monsters.has(id))
      this.monsters.set(id, this.scene.spawns.map((s) => ({ kind: s.kind, x: s.x, y: s.y, hx: s.x, hy: s.y, hp: MONSTERS[s.kind].hp, cd: 0, hurt: 0, dead: 0, t: 0, wx: s.x, wy: s.y })));
    game.ui.sceneName = this.scene.name;
    if (id === "dungeon1") this.discoverPoi("hollowroot_depths", "Hollowroot Depths");
    if (id !== "overworld") game.ui.banner = { title: this.scene.name, sub: id === "guild" ? "Eldergrove" : "Hollowroot Dungeon", danger: id === "guild" ? 1 : 4, key: Date.now() };
    if (!initial) { game.ui.fade = 1; save(); }
    emit();
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
    toast(`Discovered: ${name}`, "gold");
    addXp(10);
    checkMissionReadiness();
    save();
  }

  interact() {
    const tg = this.target;
    if (!tg) return;
    if (tg.npc) {
      const n = tg.npc;
      openDialogue({ name: n.name, title: n.title, lines: n.lines, role: n.role });
      return;
    }
    const a = tg.trig!.action;
    if (a.type === "scene") this.enter(a.to, a.x, a.y);
    else if (a.type === "board") openPanel("guild");
    else if (a.type === "inspect" || a.type === "locked") openDialogue({ name: a.title, lines: [a.text], role: "info" });
    else if (a.type === "chest") {
      if (game.data.openedChests.includes(a.id)) return toast("It's empty now.");
      game.data.openedChests.push(a.id);
      for (const [k, n] of Object.entries(a.loot)) addItem(k, n);
      game.data.gold += a.gold;
      toast(`Found ${Object.entries(a.loot).map(([k, n]) => `${n}× ${ITEMS[k]?.name}`).join(", ")}${a.gold ? ` and ${a.gold} gold` : ""}`, "gold");
      save(); emit();
    }
  }

  attack() {
    const d = game.data;
    if (this.atkCd > 0 || d.stamina < 6) return;
    d.stamina -= 6;
    this.atk = 1;
    this.atkCd = 0.38;
    const p = d.pos;
    const [fx, fy] = [[0, 1], [-1, 0], [1, 0], [0, -1]][this.dir];
    for (const m of this.monsters.get(this.scene.id) ?? []) {
      if (m.dead > 0) continue;
      const def = MONSTERS[m.kind];
      const dx = m.x - (p.x + fx * 0.6), dy = m.y - (p.y + fy * 0.6);
      if (Math.hypot(dx, dy) > 1.1 + def.size) continue;
      m.hp -= 8 + d.level * 3;
      m.hurt = 0.15;
      m.x += fx * 0.4; m.y += fy * 0.4;
      if (this.blocked(m.x, m.y)) { m.x -= fx * 0.4; m.y -= fy * 0.4; }
      if (m.hp <= 0) {
        m.dead = def.respawn;
        d.kills[m.kind] = (d.kills[m.kind] ?? 0) + 1;
        addXp(def.xp);
        d.gold += def.gold;
        addItem(def.drop);
        toast(`${def.name} defeated · +${def.xp} XP · ${ITEMS[def.drop].name}`, def.boss ? "gold" : "good");
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
    if (game.ui.fade > 0) game.ui.fade = Math.max(0, game.ui.fade - dt * 2);
    this.atk = Math.max(0, this.atk - dt * 4);
    this.atkCd -= dt; this.hurt -= dt; this.trapCd -= dt;
    if (!paused) {
      let vx = 0, vy = 0;
      const k = this.keys;
      if (k.has("a") || k.has("arrowleft")) vx--;
      if (k.has("d") || k.has("arrowright")) vx++;
      if (k.has("w") || k.has("arrowup")) vy--;
      if (k.has("s") || k.has("arrowdown")) vy++;
      const moving = vx || vy;
      const sprint = k.has("shift") && d.stamina > 1 && moving;
      if (moving) {
        const l = Math.hypot(vx, vy);
        const sp = 4.2 * (sprint ? 1.6 : 1) * dt;
        const nx = p.x + (vx / l) * sp, ny = p.y + (vy / l) * sp;
        if (!this.blocked(nx, p.y)) p.x = nx;
        if (!this.blocked(p.x, ny)) p.y = ny;
        this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : vy < 0 ? 3 : 0;
        this.walk += dt * (sprint ? 1.5 : 1);
      }
      d.stamina = sprint ? Math.max(0, d.stamina - 25 * dt) : Math.min(d.maxStamina, d.stamina + 14 * dt);
      d.hunger = Math.max(0, d.hunger - 0.18 * dt);
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
      // npcs
      for (const n of s.npcs) {
        if (!n.wander) continue;
        n.wait -= dt;
        if (n.wait <= 0 && n.tx === undefined) { n.tx = n.homeX + (Math.random() - 0.5) * 6; n.ty = n.homeY + (Math.random() - 0.5) * 4; }
        if (n.tx !== undefined && n.ty !== undefined) {
          const dx = n.tx - n.x, dy = n.ty - n.y, l = Math.hypot(dx, dy);
          if (l < 0.1) { n.tx = undefined; n.wait = 2 + Math.random() * 3; }
          else {
            const nx = n.x + (dx / l) * 1.3 * dt, ny = n.y + (dy / l) * 1.3 * dt;
            if (this.blocked(nx, ny)) { n.tx = undefined; n.wait = 1; } else { n.x = nx; n.y = ny; n.walk += dt; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; }
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
        if (dist < def.size + 0.45 && m.cd <= 0) { d.hp -= def.dmg; m.cd = 1.1; this.hurt = 0.2; }
      }
      // interaction target
      let best: Engine["target"] = null, bd = 1.7;
      for (const n of s.npcs) { const dd = Math.hypot(n.x - p.x, n.y - p.y); if (dd < bd) { bd = dd; best = { npc: n }; } }
      if (!best) for (const tr of s.triggers) if (p.x >= tr.x && p.x <= tr.x + tr.w && p.y >= tr.y && p.y <= tr.y + tr.h) { best = { trig: tr }; break; }
      this.target = best;
      const prompt = best ? (best.npc ? `Talk to ${best.npc.name}` : best.trig!.label) : null;
      if (prompt !== game.ui.prompt) { game.ui.prompt = prompt; emit(); }
      // death
      if (d.hp <= 0) {
        d.hp = Math.round(d.maxHp * 0.5); d.hunger = Math.max(d.hunger, 40);
        d.gold = Math.floor(d.gold * 0.9);
        toast("You collapsed… and woke in Eldergrove.", "bad");
        this.enter("overworld", 106, 77);
      }
    }
    const targetDark = this.scene.region ? REGIONS.find((r) => r.id === game.ui.regionId)?.ambient.dark ?? 0 : this.scene.dark;
    this.tint.dark += (targetDark - this.tint.dark) * Math.min(1, dt * 2);
    this.emitT += dt; this.saveT += dt;
    if (this.emitT > 0.12) { this.emitT = 0; emit(); }
    if (this.saveT > 4) { this.saveT = 0; save(); }
  }

  draw() {
    const c = this.canvas, ctx = this.ctx, s = this.scene, p = game.data.pos;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const zoom = Math.max(1.1, Math.min(2.2, H / (17 * TILE)));
    const vw = W / zoom, vh = H / zoom;
    let cx = p.x * TILE - vw / 2, cy = p.y * TILE - vh / 2;
    const ww = s.w * TILE, wh = s.h * TILE;
    cx = ww < vw ? (ww - vw) / 2 : Math.max(0, Math.min(ww - vw, cx));
    cy = wh < vh ? (wh - vh) / 2 : Math.max(0, Math.min(wh - vh, cy));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = s.region ? "#174268" : "#0b0b10";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, -cx * zoom * dpr, -cy * zoom * dpr);
    const CS = CHUNK * TILE;
    for (let y = Math.floor(cy / CS); y <= Math.floor((cy + vh) / CS); y++)
      for (let x = Math.floor(cx / CS); x <= Math.floor((cx + vw) / CS); x++) {
        if (x < 0 || y < 0 || x * CHUNK >= s.w || y * CHUNK >= s.h) continue;
        ctx.drawImage(getChunk(s, x, y), x * CS, y * CS);
      }
    const x0 = Math.floor(cx / TILE) - 1, y0 = Math.floor(cy / TILE) - 1, x1 = Math.ceil((cx + vw) / TILE) + 1, y1 = Math.ceil((cy + vh) / TILE) + 1;
    drawWaterFx(ctx, s, x0, y0, x1, y1, this.t);
    drawTraps(ctx, s, this.t);
    const items: { y: number; f: () => void }[] = [];
    for (const d of s.decor) {
      const big = d.kind === "building" ? (d.w ?? 1) + 2 : 4;
      if (d.x < x0 - big || d.x > x1 + big || d.y < y0 - 1 || d.y > y1 + big + 2) continue;
      items.push({ y: d.y, f: () => drawDecor(ctx, d, this.t) });
    }
    for (const n of s.npcs) items.push({ y: n.y, f: () => drawCharacter(ctx, n.x, n.y, n.dir, n.walk, n.look) });
    for (const m of this.monsters.get(s.id) ?? []) if (m.dead <= 0) items.push({ y: m.y, f: () => drawMonster(ctx, m.kind, m.x, m.y, m.t, m.hurt, m.hp / MONSTERS[m.kind].hp, MONSTERS[m.kind].size) });
    items.push({ y: p.y, f: () => drawCharacter(ctx, p.x, p.y, this.dir, this.walk, PLAYER_LOOK, this.atk, this.hurt) });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.f());
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
    if (game.ui.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${game.ui.fade})`; ctx.fillRect(0, 0, W, H); }
  }
}
