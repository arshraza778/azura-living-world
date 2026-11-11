import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.AZURA_PORT || 8787);
const DATA_DIR = path.resolve(process.env.AZURA_DATA_DIR || './data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const ALLOWED_SCENES = new Set(['overworld', 'guild', 'inn', 'cottage', 'home', 'dungeon1', 'dungeon2']);
const SCENE_TRANSITIONS = { overworld: new Set(['guild','inn','cottage','home','dungeon1']), guild: new Set(['overworld']), inn: new Set(['overworld']), cottage: new Set(['overworld']), home: new Set(['overworld']), dungeon1: new Set(['overworld','dungeon2']), dungeon2: new Set(['dungeon1']) };
const TRANSITION_POSITIONS = {
  'overworld>guild': [11.5,11.5], 'overworld>inn': [9.5,7.5], 'overworld>cottage': [5.5,4.5], 'overworld>home': [6.5,5.5], 'overworld>dungeon1': [2.5,1.5],
  'guild>overworld': [106,76.5], 'inn>overworld': [117.5,80.2], 'cottage>overworld': [115.5,88.3], 'home>overworld': [103.5,92.2], 'dungeon1>overworld': [38.5,105.5],
  'dungeon1>dungeon2': [2.5,1.5], 'dungeon2>dungeon1': [28.5,12.5]
};
const SESSIONS_FILE_NAME = 'sessions.json';
const sessions = new Map();
const sockets = new Map();
const parties = new Map();
let accounts = readJson(ACCOUNTS_FILE, {});
let world = readJson(WORLD_FILE, { players: {} });
world.players ??= {}; world.characters ??= {}; world.guilds ??= {};
world.marketListings ??= [
  { id: 'village-apple-1', seller: 'Mira the Merchant', sellerType: 'village', itemId: 'apple', quantity: 8, unitPrice: 2, createdAt: 0 },
  { id: 'village-bread-1', seller: 'Bram the Innkeeper', sellerType: 'village', itemId: 'bread', quantity: 5, unitPrice: 5, createdAt: 0 },
  { id: 'village-herb-1', seller: 'Sylvi the Alchemist', sellerType: 'village', itemId: 'herb', quantity: 6, unitPrice: 7, createdAt: 0 },
  { id: 'village-potion-1', seller: 'Sylvi the Alchemist', sellerType: 'village', itemId: 'healing_potion', quantity: 3, unitPrice: 14, createdAt: 0 }
];
const ALLOWED_ITEMS = new Set(['apple','bread','healing_potion','herb','azure_potion','wooden_sword','forest_fiber','slime_gel','wolf_pelt','goblin_token','boar_tusk','heartwood_core','venom_sac','rare_herb','ancient_shard','bone_dust','umbral_essence','kings_sigil','cave_silk','shadow_ember','ancient_bone','root_shard','wraith_dust','guardian_core','iron_sword','rootbound_helm','deepwarden_mail','cavegrip_gloves','rootrunner_boots','crystal_charm','wood','branch','stone','iron_ore','copper_ore','mushroom','cooked_fish','wheat','carrot','potato','herb_seeds','wheat_seeds','carrot_seeds','potato_seeds','axe','pickaxe','gathering_knife','fishing_rod','watering_can','stamina_potion','river_fish','golden_trout','root_key']);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function persistSessions() { const now = Date.now(); writeJson(path.join(DATA_DIR, SESSIONS_FILE_NAME), Object.fromEntries([...sessions].filter(([, v]) => v.expires > now))); }
function loadSessions() { const saved = readJson(path.join(DATA_DIR, SESSIONS_FILE_NAME), {}); for (const [k, v] of Object.entries(saved)) if (v && typeof v.user === 'string' && v.expires > Date.now()) sessions.set(k, v); }
function persistWorld() { writeJson(WORLD_FILE, world); }
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 16_384) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function cleanName(value) { return typeof value === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(value) ? value : null; }
function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function validPassword(password, record) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return false;
  const actual = crypto.scryptSync(password, record.salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(record.hash, 'hex'));
}
function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  persistSessions();
  return token;
}
function authenticate(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) return null;
  return { token, username: session.user };
}
function wsFrame(value) {
  const data = Buffer.from(JSON.stringify(value));
  if (data.length < 126) return Buffer.concat([Buffer.from([0x81, data.length]), data]);
  if (data.length < 65_536) { const h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(data.length, 2); return Buffer.concat([h, data]); }
  throw new Error('WebSocket message too large');
}
function send(client, value) { if (!client.closed) client.socket.write(wsFrame(value)); }
function broadcast(scene, value, except) { for (const c of sockets.values()) if (c !== except && c.player?.scene === scene) send(c, value); }
function playerSnapshot(scene, exceptId) {
  return [...sockets.values()].filter(c => c.player && (!scene || c.player.scene === scene) && c.player.id !== exceptId).map(c => ({ id: c.player.id, name: c.player.name, scene: c.player.scene, x: c.player.x, y: c.player.y, dir: c.player.dir || 0, moving: !!c.player.moving, hp: c.player.hp ?? 100, maxHp: c.player.maxHp ?? 100, action: c.player.action || null, appearance: c.player.appearance }));
}
function playerView(p) { return { id: p.id, name: p.name, scene: p.scene, x: p.x, y: p.y, dir: p.dir || 0, moving: !!p.moving, hp: p.hp ?? 100, maxHp: p.maxHp ?? 100, action: p.action || null, appearance: p.appearance }; }
function applyStatus(p, m) {
  if ([0, 1, 2, 3].includes(m.dir)) p.dir = m.dir;
  p.moving = m.moving === true;
  const maxHp = Number(m.maxHp), hp = Number(m.hp);
  if (Number.isFinite(maxHp) && maxHp >= 1 && maxHp <= 5000) p.maxHp = Math.round(maxHp);
  if (Number.isFinite(hp)) p.hp = Math.max(0, Math.min(p.maxHp ?? 100, Math.round(hp)));
  p.action = ['attack', 'dodge', 'hurt', 'dead'].includes(m.action) ? m.action : null;
}
function updatePresence(client) {
  send(client, { type: 'presence', players: playerSnapshot(client.player.scene, client.player.id) });
  broadcast(client.player.scene, { type: 'presence', players: playerSnapshot(client.player.scene) }, client);
}
function closeClient(client) {
  if (client.closed) return;
  client.closed = true;
  sockets.delete(client.player?.id);
  if (client.player) {
    const saved = world.players[client.player.username] || {};
    world.players[client.player.username] = { ...saved, scene: client.player.scene, x: client.player.x, y: client.player.y, appearance: client.player.appearance, lastSeen: Date.now() };
    persistWorld();
    broadcast(client.player.scene, { type: 'player-left', id: client.player.id, name: client.player.name });
  }
}
function parseFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const b0 = client.buffer[0], b1 = client.buffer[1];
    const opcode = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, offset = 2;
    if (len === 126) { if (client.buffer.length < 4) return; len = client.buffer.readUInt16BE(2); offset = 4; }
    else if (len === 127) { closeClient(client); client.socket.destroy(); return; }
    if (!masked || len > 8192) { closeClient(client); client.socket.destroy(); return; }
    if (client.buffer.length < offset + 4 + len) return;
    const mask = client.buffer.subarray(offset, offset + 4); offset += 4;
    const payload = Buffer.from(client.buffer.subarray(offset, offset + len));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    client.buffer = client.buffer.subarray(offset + len);
    if (opcode === 0x8) { client.socket.end(); closeClient(client); return; }
    if (opcode === 0x9) { client.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
    if (opcode !== 0x1) continue;
    let message; try { message = JSON.parse(payload.toString('utf8')); } catch { send(client, { type: 'error', message: 'Invalid message.' }); continue; }
    handleMessage(client, message);
  }
}
function handleMessage(client, message) {
  if (!client.player || !message || typeof message.type !== 'string') return;
  if (message.type.startsWith('character:') || message.type.startsWith('market:') || message.type.startsWith('guild:')) return handleSocialMessage(client, message);
  if (message.type === 'move') {
    const scene = ALLOWED_SCENES.has(message.scene) ? message.scene : client.player.scene;
    if (scene !== client.player.scene && !SCENE_TRANSITIONS[client.player.scene]?.has(scene)) { send(client, { type: 'position', scene: client.player.scene, x: client.player.x, y: client.player.y }); return; }
    const x = Number(message.x), y = Number(message.y), now = Date.now();
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 300 || Math.abs(y) > 300) return;
    const elapsed = Math.max(0.05, Math.min(1, (now - client.lastMove) / 1000));
    const distance = Math.hypot(x - client.player.x, y - client.player.y);
    if (scene === client.player.scene && distance > 8.5 * elapsed + 0.35) { send(client, { type: 'position', scene: client.player.scene, x: client.player.x, y: client.player.y }); return; }
    const previousScene = client.player.scene;
    if (scene !== previousScene) {
      const spawn = TRANSITION_POSITIONS[`${previousScene}>${scene}`];
      if (!spawn) return;
      client.player.scene = scene; client.player.x = spawn[0]; client.player.y = spawn[1];
      send(client, { type: 'position', scene, x: spawn[0], y: spawn[1] });
    } else { client.player.x = x; client.player.y = y; }
    client.lastMove = now;
    applyStatus(client.player, message);
    if (previousScene !== scene) {
      broadcast(previousScene, { type: 'player-left', id: client.player.id, name: client.player.name });
      updatePresence(client);
    } else broadcast(scene, { type: 'player-moved', player: playerView(client.player) }, client);
    if (now - client.lastPersist > 5000) { client.lastPersist = now; const saved = world.players[client.player.username] || {}; world.players[client.player.username] = { ...saved, scene, x, y, appearance: client.player.appearance, lastSeen: now }; persistWorld(); }
    return;
  }
  if (message.type === 'ping') { send(client, { type: 'pong', t: Number(message.t) || 0 }); return; }
  if (message.type === 'appearance') {
    const a = message.appearance || {};
    const outfit = ['wanderer','ranger','crimson','scholar','ashen'].includes(a.outfit) ? a.outfit : 'wanderer';
    const hairStyle = ['short','long','ponytail','spiky'].includes(a.hairStyle) ? a.hairStyle : 'short';
    const hairColor = typeof a.hairColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(a.hairColor) ? a.hairColor : '#2a3a5a';
    client.player.appearance = { outfit, hairStyle, hairColor }; updatePresence(client); return;
  }
  if (message.type === 'chat') {
    const text = typeof message.text === 'string' ? message.text.trim().replace(/[\u0000-\u001f]/g, '').slice(0, 240) : '';
    if (!text || Date.now() - (client.lastChat || 0) < 700) return;
    client.lastChat = Date.now();
    const payload = { type: 'chat', id: crypto.randomUUID(), name: client.player.name, text, scene: client.player.scene, at: Date.now() };
    broadcast(client.player.scene, payload); send(client, payload); return;
  }
  if (message.type === 'party:create') {
    for (const party of parties.values()) if (party.leader === client.player.id || party.members.includes(client.player.id)) return send(client, { type: 'error', message: 'You are already in a party.' });
    const party = { id: crypto.randomUUID(), leader: client.player.id, members: [client.player.id], invites: [] };
    parties.set(party.id, party); send(client, { type: 'party', party }); return;
  }
  if (message.type === 'party:invite') {
    const target = [...sockets.values()].find(c => c.player?.id === message.targetId);
    const party = [...parties.values()].find(p => p.leader === client.player.id);
    if (!target || !party || target.player.scene !== client.player.scene) return send(client, { type: 'error', message: 'Invite a nearby online player while leading a party.' });
    party.invites.push({ userId: target.player.id, from: client.player.name });
    send(target, { type: 'party-invite', partyId: party.id, from: client.player.name }); return;
  }
  if (message.type === 'party:accept') {
    const party = parties.get(message.partyId);
    if (!party || !party.invites.some(i => i.userId === client.player.id)) return send(client, { type: 'error', message: 'That party invitation has expired.' });
    if (party.members.length >= 5) return send(client, { type: 'error', message: 'That party is full.' });
    party.invites = party.invites.filter(i => i.userId !== client.player.id); party.members.push(client.player.id);
    for (const c of sockets.values()) if (party.members.includes(c.player?.id)) send(c, { type: 'party', party }); return;
  }
  if (message.type === 'party:leave') {
    for (const [id, party] of parties) if (party.members.includes(client.player.id)) {
      party.members = party.members.filter(x => x !== client.player.id);
      if (party.leader === client.player.id || !party.members.length) parties.delete(id);
      else for (const c of sockets.values()) if (party.members.includes(c.player?.id)) send(c, { type: 'party', party });
    }
    send(client, { type: 'party', party: null });
  }
}


function guildList() { return Object.values(world.guilds).map(g => ({ id: g.id, name: g.name, leader: g.leader, members: g.members.length })); }
function guildFor(username) { return Object.values(world.guilds).find(g => g.members.some(m => m.username === username)) || null; }
function guildView(guild, username) { return guild ? { id: guild.id, name: guild.name, role: guild.members.find(m => m.username === username)?.role || 'member', members: guild.members.map(m => ({ id: m.username, name: m.username, role: m.role })), messages: guild.messages } : null; }
function sendCharacter(client) { send(client, { type: 'character', character: world.characters[client.player.username] || { gold: 0, inventory: {} } }); }
function sendGuildState(guild) { for (const c of sockets.values()) if (c.player && guild.members.some(m => m.username === c.player.username)) send(c, { type: 'guild-state', guild: guildView(guild, c.player.username) }); }
function sendGuildLists() { for (const c of sockets.values()) send(c, { type: 'guild-list', guilds: guildList() }); }
function broadcastMarket() { for (const c of sockets.values()) send(c, { type: 'market-state', listings: world.marketListings }); }
function sendAllCharacter(username) { for (const c of sockets.values()) if (c.player?.username === username) sendCharacter(c); }
function cleanChat(value, max = 240) { return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f<>]/g, '').slice(0, max) : ''; }
function handleSocialMessage(client, message) {
  const username = client.player.username;
  const character = world.characters[username];
  if (message.type === 'character:sync') {
    if (!character || Date.now() - (client.lastCharacterSync || 0) < 500) return;
    const inventory = {};
    for (const [id, count] of Object.entries(message.inventory || {})) if (ALLOWED_ITEMS.has(id) && Number.isInteger(count) && count > 0) inventory[id] = Math.min(9999, count);
    const equipment = {};
    for (const [slot, id] of Object.entries(message.equipment || {})) if (['weapon','helmet','chest','gloves','boots','accessory'].includes(slot) && ALLOWED_ITEMS.has(id)) equipment[slot] = id;
    character.gold = Math.max(0, Math.min(1000000, Math.floor(Number(message.gold) || 0)));
    character.inventory = inventory; character.equipment = equipment; client.lastCharacterSync = Date.now(); persistWorld(); return;
  }
  if (message.type === 'character:seed') {
    if (!world.characters[username]) {
      const inventory = {};
      for (const [id, count] of Object.entries(message.inventory || {})) if (ALLOWED_ITEMS.has(id) && Number.isInteger(count) && count > 0) inventory[id] = Math.min(9999, count);
      world.characters[username] = { gold: Math.max(0, Math.min(1000000, Math.floor(Number(message.gold) || 0))), inventory, equipment: message.equipment && typeof message.equipment === 'object' ? Object.fromEntries(Object.entries(message.equipment).filter(([slot, id]) => ['weapon','helmet','chest','gloves','boots','accessory'].includes(slot) && ALLOWED_ITEMS.has(id))) : {} };
      persistWorld();
    }
    return sendCharacter(client);
  }
  if (message.type === 'market:list') {
    const itemId = message.itemId, quantity = Math.floor(Number(message.quantity)), price = Math.floor(Number(message.unitPrice));
    if (!character || !ALLOWED_ITEMS.has(itemId) || Object.values(character.equipment || {}).includes(itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 || !Number.isInteger(price) || price < 1 || price > 100000 || (character.inventory[itemId] || 0) < quantity) return send(client, { type: 'error', message: 'Listing is invalid or you do not own enough items.' });
    character.inventory[itemId] -= quantity; if (!character.inventory[itemId]) delete character.inventory[itemId];
    world.marketListings.unshift({ id: crypto.randomUUID(), seller: username, sellerType: 'player', itemId, quantity, unitPrice: price, createdAt: Date.now() });
    persistWorld(); sendCharacter(client); broadcastMarket(); return;
  }
  if (message.type === 'market:buy') {
    const listing = world.marketListings.find(x => x.id === message.listingId), quantity = Math.floor(Number(message.quantity || 1));
    if (!listing || !Number.isInteger(quantity) || quantity < 1 || quantity > listing.quantity || (listing.sellerType === 'player' && listing.seller === username)) return send(client, { type: 'error', message: 'That listing is unavailable.' });
    const total = listing.unitPrice * quantity;
    if (!character || character.gold < total) return send(client, { type: 'error', message: 'Not enough gold.' });
    if ((character.inventory[listing.itemId] || 0) + quantity > 9999) return send(client, { type: 'error', message: 'Your inventory stack is full.' });
    character.gold -= total; character.inventory[listing.itemId] = (character.inventory[listing.itemId] || 0) + quantity;
    if (listing.sellerType === 'player') {
      const seller = world.characters[listing.seller];
      if (!seller) return send(client, { type: 'error', message: 'Seller account is unavailable.' });
      seller.gold = Math.min(1000000, seller.gold + total); sendAllCharacter(listing.seller);
    }
    listing.quantity -= quantity; if (!listing.quantity) world.marketListings = world.marketListings.filter(x => x.id !== listing.id);
    persistWorld(); sendCharacter(client); broadcastMarket(); return;
  }
  if (message.type === 'market:cancel') {
    const listing = world.marketListings.find(x => x.id === message.listingId);
    if (!listing || listing.sellerType !== 'player' || listing.seller !== username) return send(client, { type: 'error', message: 'You cannot cancel that listing.' });
    character.inventory[listing.itemId] = (character.inventory[listing.itemId] || 0) + listing.quantity;
    world.marketListings = world.marketListings.filter(x => x.id !== listing.id); persistWorld(); sendCharacter(client); broadcastMarket(); return;
  }
  if (message.type === 'guild:create') {
    const name = cleanChat(message.name, 28);
    if (!name || !character || character.gold < 100 || guildFor(username)) return send(client, { type: 'error', message: 'Guild creation requires a name, 100 gold, and no existing guild membership.' });
    character.gold -= 100; const id = crypto.randomUUID();
    const guild = { id, name, leader: username, members: [{ username, role: 'leader' }], messages: [] };
    world.guilds[id] = guild; persistWorld(); sendCharacter(client); send(client, { type: 'guild-state', guild: guildView(guild, username) }); sendGuildLists(); return;
  }
  if (message.type === 'guild:join') {
    const guild = world.guilds[message.guildId];
    if (!guild || guildFor(username)) return send(client, { type: 'error', message: 'Guild unavailable or you already belong to a guild.' });
    if (guild.members.length >= 30) return send(client, { type: 'error', message: 'That guild is full.' });
    guild.members.push({ username, role: 'member' }); persistWorld(); sendGuildState(guild); sendGuildLists(); return;
  }
  if (message.type === 'guild:leave') {
    const guild = guildFor(username); if (!guild) return;
    guild.members = guild.members.filter(m => m.username !== username);
    if (!guild.members.length) delete world.guilds[guild.id];
    else if (guild.leader === username) { guild.leader = guild.members[0].username; guild.members[0].role = 'leader'; }
    persistWorld(); send(client, { type: 'guild-state', guild: null }); sendGuildState(guild); sendGuildLists(); return;
  }
  if (message.type === 'guild:message') {
    const guild = guildFor(username), text = cleanChat(message.text);
    if (!guild || !text) return;
    guild.messages.push({ id: crypto.randomUUID(), author: username, text, createdAt: Date.now() }); guild.messages = guild.messages.slice(-50); persistWorld(); sendGuildState(guild); return;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' }); return res.end(); }
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'azura-multiplayer', online: sockets.size });
  if (req.method === 'POST' && ['/api/register', '/api/login'].includes(url.pathname)) {
    try {
      const body = await readBody(req), username = cleanName(body.username), password = body.password;
      if (!username || typeof password !== 'string' || password.length < 8 || password.length > 128) return json(res, 400, { error: 'Use a 3–20 character username (letters, numbers, underscore) and an 8–128 character password.' });
      if (url.pathname === '/api/register') {
        if (accounts[username]) return json(res, 409, { error: 'That username is already registered.' });
        accounts[username] = { ...passwordRecord(password), createdAt: Date.now() }; writeJson(ACCOUNTS_FILE, accounts);
      } else if (!accounts[username] || !validPassword(password, accounts[username])) return json(res, 401, { error: 'Username or password is incorrect.' });
      const token = issueSession(username);
      return json(res, 200, { token, username, player: world.players[username] || { scene: 'overworld', x: 106, y: 77 } });
    } catch (error) { return json(res, 400, { error: error.message || 'Invalid request.' }); }
  }
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const user = authenticate(req); return user ? json(res, 200, { username: user.username }) : json(res, 401, { error: 'Sign in again.' });
  }
  return json(res, 404, { error: 'Not found.' });
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') return socket.destroy();
  const token = url.searchParams.get('token'), session = sessions.get(token);
  if (!session || session.expires < Date.now()) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.destroy();
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const username = session.user, saved = world.players[username] || { scene: 'overworld', x: 106, y: 77 };
  const client = { socket, buffer: Buffer.alloc(0), closed: false, lastMove: Date.now(), lastPersist: 0, player: { id: crypto.randomUUID(), username, name: username, scene: ALLOWED_SCENES.has(saved.scene) ? saved.scene : 'overworld', x: Number(saved.x) || 106, y: Number(saved.y) || 77, appearance: saved.appearance && ['wanderer','ranger','crimson','scholar','ashen'].includes(saved.appearance.outfit) ? saved.appearance : { outfit: 'wanderer', hairStyle: 'short', hairColor: '#2a3a5a' } } };
  sockets.set(client.player.id, client);
  socket.on('data', chunk => parseFrames(client, chunk));
  socket.on('close', () => closeClient(client)); socket.on('error', () => closeClient(client));
  send(client, { type: 'welcome', player: client.player, players: playerSnapshot(client.player.scene, client.player.id), character: world.characters[username] || null, listings: world.marketListings, guilds: guildList(), guild: guildView(guildFor(username), username) });
  updatePresence(client);
  broadcast(client.player.scene, { type: 'notice', text: `${username} entered the area.` }, client);
});

loadSessions();
server.listen(PORT, '0.0.0.0', () => console.log(`Azura multiplayer service listening on http://0.0.0.0:${PORT}`));
process.on('SIGINT', () => { persistWorld(); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { persistWorld(); server.close(() => process.exit(0)); });
