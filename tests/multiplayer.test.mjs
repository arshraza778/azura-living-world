import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitFor(url, child) {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error('Multiplayer server exited before becoming ready.');
    try { const response = await fetch(url); if (response.ok) return; } catch { /* wait */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Multiplayer server did not become ready.');
}
function nextMessage(ws, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const seen = [];
    const timer = setTimeout(() => { ws.removeEventListener('message', onMessage); reject(new Error(`Timed out waiting for WebSocket message. Seen: ${seen.join(',')}`)); }, 3500);
    const onMessage = event => {
      const value = JSON.parse(String(event.data)); seen.push(JSON.stringify(value));
      if (!predicate(value)) return;
      clearTimeout(timer); ws.removeEventListener('message', onMessage); resolve(value);
    };
    ws.addEventListener('message', onMessage);
  });
}
async function register(base, username) {
  const response = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: 'secure-pass-123' }) });
  assert.equal(response.status, 200);
  return response.json();
}
async function connect(port, token) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
  const welcome = await nextMessage(ws, m => m.type === 'welcome');
  return { ws, welcome };
}

test('multiplayer accounts, presence, chat, parties, shared market and guild persistence', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'azura-mp-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/multiplayer.mjs'], { cwd: process.cwd(), env: { ...process.env, AZURA_PORT: String(port), AZURA_DATA_DIR: dir }, stdio: 'ignore' });
  const clients = [];
  t.after(async () => { for (const ws of clients) try { ws.close(); } catch {} child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); await rm(dir, { recursive: true, force: true }); });
  await waitFor(`${base}/api/health`, child);
  const first = await register(base, 'tester_one');
  const duplicate = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester_one', password: 'secure-pass-123' }) });
  assert.equal(duplicate.status, 409);
  const badLogin = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester_one', password: 'wrong-password' }) });
  assert.equal(badLogin.status, 401);
  const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'tester_one', password: 'secure-pass-123' }) });
  assert.equal(login.status, 200);
  const firstClient = await connect(port, first.token); clients.push(firstClient.ws);
  firstClient.ws.send(JSON.stringify({ type: 'character:seed', gold: 100, inventory: { wolf_pelt: 3 }, equipment: {} }));
  await nextMessage(firstClient.ws, m => m.type === 'character');
  firstClient.ws.send(JSON.stringify({ type: 'chat', text: 'Hello Azura' }));
  const chat = await nextMessage(firstClient.ws, m => m.type === 'chat');
  assert.equal(chat.text, 'Hello Azura');
  firstClient.ws.send(JSON.stringify({ type: 'party:create' }));
  const party = await nextMessage(firstClient.ws, m => m.type === 'party');
  assert.equal(party.party.members.length, 1);

  const second = await register(base, 'tester_two');
  const presencePromise = nextMessage(firstClient.ws, m => m.type === 'presence' && m.players.some(p => p.name === 'tester_two'));
  const secondClient = await connect(port, second.token); clients.push(secondClient.ws);
  secondClient.ws.send(JSON.stringify({ type: 'character:seed', gold: 50, inventory: {}, equipment: {} }));
  await nextMessage(secondClient.ws, m => m.type === 'character');
  const presence = await presencePromise;
  assert.ok(presence.players.some(p => p.name === 'tester_two'));
  const invitePromise = nextMessage(secondClient.ws, m => m.type === 'party-invite');
  firstClient.ws.send(JSON.stringify({ type: 'party:invite', targetId: secondClient.welcome.player.id }));
  const invite = await invitePromise;
  const leaderPartyPromise = nextMessage(firstClient.ws, m => m.type === 'party' && m.party?.members.length === 2);
  const memberPartyPromise = nextMessage(secondClient.ws, m => m.type === 'party' && m.party?.members.length === 2);
  secondClient.ws.send(JSON.stringify({ type: 'party:accept', partyId: invite.partyId }));
  const [leaderParty, memberParty] = await Promise.all([leaderPartyPromise, memberPartyPromise]);
  assert.equal(leaderParty.party.members.length, 2); assert.equal(memberParty.party.members.length, 2);
  await new Promise(resolve => setTimeout(resolve, 750));
  const sharedChatPromise = nextMessage(secondClient.ws, m => m.type === 'chat' && m.text === 'See you in the forest.');
  firstClient.ws.send(JSON.stringify({ type: 'chat', text: 'See you in the forest.' }));
  assert.equal((await sharedChatPromise).name, 'tester_one');

  const movementPromise = nextMessage(firstClient.ws, m => m.type === 'player-moved' && m.player.name === 'tester_two');
  secondClient.ws.send(JSON.stringify({ type: 'move', scene: 'overworld', x: 106.5, y: 77 }));
  const moved = await movementPromise;
  assert.equal(moved.player.x, 106.5);
  const correctionPromise = nextMessage(secondClient.ws, m => m.type === 'position');
  secondClient.ws.send(JSON.stringify({ type: 'move', scene: 'overworld', x: 180, y: 120 }));
  const correction = await correctionPromise;
  assert.equal(correction.x, 106.5);
  const transitionPromise = nextMessage(secondClient.ws, m => m.type === 'position' && m.scene === 'guild');
  secondClient.ws.send(JSON.stringify({ type: 'move', scene: 'guild', x: 200, y: 200 }));
  const transition = await transitionPromise;
  assert.deepEqual([transition.x, transition.y], [11.5, 11.5]);
  const returnPromise = nextMessage(secondClient.ws, m => m.type === 'position' && m.scene === 'overworld');
  secondClient.ws.send(JSON.stringify({ type: 'move', scene: 'overworld', x: 180, y: 120 }));
  await returnPromise;

  firstClient.ws.send(JSON.stringify({ type: 'character:sync', gold: 100, inventory: { wolf_pelt: 3 }, equipment: {} }));
  const secondMarketPromise = nextMessage(secondClient.ws, m => m.type === 'market-state' && m.listings.some(x => x.seller === 'tester_one' && x.itemId === 'wolf_pelt'));
  firstClient.ws.send(JSON.stringify({ type: 'market:list', itemId: 'wolf_pelt', quantity: 2, unitPrice: 5 }));
  await nextMessage(firstClient.ws, m => m.type === 'market-state' && m.listings.some(x => x.seller === 'tester_one' && x.itemId === 'wolf_pelt'));
  // The second player purchases from the first player's server-owned listing.
  const marketState = await secondMarketPromise;
  assert.ok(marketState);
  const playerListing = marketState.listings.find(x => x.seller === 'tester_one' && x.itemId === 'wolf_pelt');
  const buyerCharacterPromise = nextMessage(secondClient.ws, m => m.type === 'character' && m.character.inventory?.wolf_pelt === 1);
  const sellerCharacterPromise = nextMessage(firstClient.ws, m => m.type === 'character' && m.character.gold === 105);
  secondClient.ws.send(JSON.stringify({ type: 'market:buy', listingId: playerListing.id, quantity: 1 }));
  const buyerCharacter = await buyerCharacterPromise;
  assert.equal(buyerCharacter.character.gold, 45);
  const sellerCharacter = await sellerCharacterPromise;
  assert.equal(sellerCharacter.character.inventory.wolf_pelt, 1);

  const guildCreatePromise = nextMessage(firstClient.ws, m => m.type === 'guild-state' && m.guild?.name === 'Forest Stars');
  firstClient.ws.send(JSON.stringify({ type: 'guild:create', name: 'Forest Stars' }));
  const guildState = await guildCreatePromise;
  assert.equal(guildState.guild.role, 'leader');
  const joinPromise = nextMessage(secondClient.ws, m => m.type === 'guild-state' && m.guild?.name === 'Forest Stars');
  secondClient.ws.send(JSON.stringify({ type: 'guild:join', guildId: guildState.guild.id }));
  const joined = await joinPromise;
  assert.equal(joined.guild.members.length, 2);
  const messagePromise = nextMessage(firstClient.ws, m => m.type === 'guild-state' && m.guild?.messages.some(x => x.text === 'Ready for the forest?'));
  secondClient.ws.send(JSON.stringify({ type: 'guild:message', text: 'Ready for the forest?' }));
  const guildMessage = await messagePromise;
  assert.ok(guildMessage.guild.messages.length);

  firstClient.ws.close(); secondClient.ws.close(); await new Promise(resolve => setTimeout(resolve, 150));
  const accounts = JSON.parse(await readFile(path.join(dir, 'accounts.json'), 'utf8'));
  const world = JSON.parse(await readFile(path.join(dir, 'world.json'), 'utf8'));
  assert.ok(accounts.tester_one.hash && accounts.tester_two.hash);
  assert.notEqual(accounts.tester_one.hash, 'secure-pass-123');
  assert.equal(world.characters.tester_two.gold, 45);
  assert.equal(world.guilds[guildState.guild.id].members.length, 2);
  assert.ok(world.players.tester_one && world.players.tester_two, 'last known player positions persist on disconnect');
  assert.equal(world.marketListings.find(x => x.seller === 'tester_one' && x.itemId === 'wolf_pelt').quantity, 1);
});
