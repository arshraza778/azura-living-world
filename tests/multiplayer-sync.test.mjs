import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';

const port = 18000 + Math.floor(Math.random() * 1000), base = `http://127.0.0.1:${port}`;
const start = dir => spawn(process.execPath, ['server/multiplayer.mjs'], { env: { ...process.env, AZURA_PORT: String(port), AZURA_DATA_DIR: dir }, stdio: 'ignore' });
async function ready() { for (let i = 0; i < 80; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error('not ready'); }
const stop = c => new Promise(r => { c.once('exit', r); c.kill('SIGTERM'); });
function next(ws, pred) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), 3000); ws.addEventListener('message', function on(e) { const m = JSON.parse(String(e.data)); if (pred(m)) { clearTimeout(t); ws.removeEventListener('message', on); res(m); } }); }); }
const reg = async u => (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: 'secure-pass-123' }) })).json();
const open = async token => { const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`); await next(ws, m => m.type === 'welcome'); return ws; };

test('facing, health and action sync; health is clamped; logins survive restart; ping', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'azura-sync-'));
  let srv = start(dir); await ready();
  const a = await reg('sync_a'), b = await reg('sync_b');
  const wa = await open(a.token), wb = await open(b.token);
  const moved = next(wa, m => m.type === 'player-moved' && m.player.name === 'sync_b');
  wb.send(JSON.stringify({ type: 'move', scene: 'overworld', x: 106.3, y: 77, dir: 2, moving: true, hp: 9999, maxHp: 140, action: 'attack' }));
  const p = (await moved).player;
  assert.equal(p.dir, 2); assert.equal(p.moving, true); assert.equal(p.hp, 140); assert.equal(p.action, 'attack');
  wb.send(JSON.stringify({ type: 'ping', t: 42 }));
  assert.equal((await next(wb, m => m.type === 'pong')).t, 42);
  wa.close(); wb.close(); await stop(srv);
  srv = start(dir); await ready();
  const again = await open(a.token); again.close();
  await stop(srv); await rm(dir, { recursive: true, force: true });
});
