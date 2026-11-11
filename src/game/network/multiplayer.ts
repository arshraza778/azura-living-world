import { game, save, emit } from "../state/store";
import type { SceneId } from "../core/types";
import type { EquipmentSlot } from "../data/items";

type RemotePlayer = { id: string; name: string; scene: SceneId; x: number; y: number; dir?: number; moving?: boolean; hp?: number; maxHp?: number; action?: string | null; rx?: number; ry?: number; appearance: { outfit: string; hairStyle: "short" | "long" | "ponytail" | "spiky"; hairColor: string } };
type ChatMessage = { id: string; name: string; text: string; scene: string; at: number };
type Party = { id: string; leader: string; members: string[]; invites: { userId: string; from: string }[] } | null;
type MarketListing = { id: string; seller: string; sellerType: "village" | "player"; itemId: string; quantity: number; unitPrice: number; createdAt: number };
type SharedGuild = { id: string; name: string; role: "leader" | "officer" | "member"; members: { id: string; name: string; role: string }[]; messages: { id: string; author: string; text: string; createdAt: number }[] } | null;
type GuildSummary = { id: string; name: string; leader: string; members: number };
export type MultiplayerState = { status: "offline" | "connecting" | "online" | "error"; username: string | null; players: RemotePlayer[]; messages: ChatMessage[]; party: Party; invitation: { partyId: string; from: string } | null; marketListings: MarketListing[]; guilds: GuildSummary[]; guild: SharedGuild; error: string | null; latency: number | null; notice: string | null };
const initial: MultiplayerState = { status: "offline", username: null, players: [], messages: [], party: null, invitation: null, marketListings: [], guilds: [], guild: null, error: null, latency: null, notice: null };
let state: MultiplayerState = { ...initial };
let socket: WebSocket | null = null;
const listeners = new Set<() => void>();
const TOKEN_KEY = "azura.multiplayer.token";
const baseUrl = () => (import.meta.env["VITE_AZURA_SERVER_URL"] || "http://localhost:8787").replace(/\/$/, "");
function update(patch: Partial<MultiplayerState>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }
export function getMultiplayerState() { return state; }
export function subscribeMultiplayer(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
// Smoothed render positions, eased toward the latest server position each frame.
const smooth = new Map<string, { x: number; y: number }>();
export function getRemotePlayers(scene: string, dt = 0) {
  const k = 1 - Math.exp(-12 * dt);
  return state.players.filter(p => p.scene === scene).map(p => {
    let s = smooth.get(p.id);
    if (!s || Math.hypot(s.x - p.x, s.y - p.y) > 6) { s = { x: p.x, y: p.y }; smooth.set(p.id, s); }
    else { s.x += (p.x - s.x) * k; s.y += (p.y - s.y) * k; }
    return { ...p, rx: s.x, ry: s.y };
  });
}
let reconnectTimer: ReturnType<typeof setTimeout> | null = null; let retries = 0; let pingTimer: ReturnType<typeof setInterval> | null = null;
function scheduleReconnect() {
  const token = localStorage.getItem(TOKEN_KEY); if (!token || reconnectTimer) return;
  const delay = Math.min(15000, 1000 * 2 ** retries++);
  update({ notice: `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s…` });
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connectWithToken(token, state.username); }, delay);
}
export function listSharedMarketItem(itemId: string, quantity: number, unitPrice: number) { sendNetwork({ type: "market:list", itemId, quantity, unitPrice }); }
export function buySharedMarketItem(listingId: string, quantity = 1) { sendNetwork({ type: "market:buy", listingId, quantity }); }
export function cancelSharedMarketItem(listingId: string) { sendNetwork({ type: "market:cancel", listingId }); }
export function createSharedGuild(name: string) { sendNetwork({ type: "guild:create", name }); }
export function joinSharedGuild(guildId: string) { sendNetwork({ type: "guild:join", guildId }); }
export function leaveSharedGuild() { sendNetwork({ type: "guild:leave" }); }
export function postSharedGuildMessage(text: string) { sendNetwork({ type: "guild:message", text }); }
export function sendNetwork(message: unknown) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }

export async function authenticateMultiplayer(username: string, password: string, register: boolean) {
  update({ status: "connecting", error: null });
  try {
    const response = await fetch(`${baseUrl()}/api/${register ? "register" : "login"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Authentication failed.");
    localStorage.setItem(TOKEN_KEY, payload.token);
    connectWithToken(payload.token, payload.username);
  } catch (error) { update({ status: "error", error: error instanceof Error ? error.message : "Could not reach the Azura server." }); }
}

export function reconnectMultiplayer() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) connectWithToken(token, null);
}
function connectWithToken(token: string, username: string | null) {
  const previous = socket; socket = null; previous?.close(); update({ status: "connecting", username: username ?? state.username, error: null, players: [], messages: [], party: null });
  const wsUrl = `${baseUrl().replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`;
  const current = new WebSocket(wsUrl); socket = current;
  current.onopen = () => {
    if (retries > 0) update({ notice: "Reconnected to Azura." }); retries = 0;
    update({ status: "online" });
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => sendNetwork({ type: "ping", t: performance.now() }), 5000); sendNetwork({ type: "ping", t: performance.now() });
    sendNetwork({ type: "appearance", appearance: game.data.appearance });
  };
  current.onmessage = event => {
    try {
      const message = JSON.parse(String(event.data));
      if (message.type === "welcome") {
        update({ username: message.player?.name ?? state.username, players: message.players ?? [], marketListings: message.listings ?? [], guilds: message.guilds ?? [], guild: message.guild ?? null });
        if (message.character) applyServerCharacter(message.character);
        else sendNetwork({ type: "character:seed", inventory: game.data.inventory, gold: game.data.gold, equipment: game.data.equipment });
        if (message.player?.scene && Number.isFinite(message.player.x) && Number.isFinite(message.player.y)) {
          game.data.pos = { scene: message.player.scene, x: message.player.x, y: message.player.y }; save();
          window.dispatchEvent(new CustomEvent("azura:network-position", { detail: game.data.pos }));
        }
        sendNetwork({ type: "appearance", appearance: game.data.appearance });
      }
      else if (message.type === "position") {
        game.data.pos = { scene: message.scene, x: message.x, y: message.y }; save();
        window.dispatchEvent(new CustomEvent("azura:network-position", { detail: game.data.pos }));
      }
      else if (message.type === "character") applyServerCharacter(message.character);
      else if (message.type === "market-state") update({ marketListings: message.listings ?? [] });
      else if (message.type === "guild-list") update({ guilds: message.guilds ?? [] });
      else if (message.type === "guild-state") update({ guild: message.guild ?? null });
      else if (message.type === "presence") update({ players: message.players ?? [] });
      else if (message.type === "player-moved") update({ players: [...state.players.filter(p => p.id !== message.player.id), message.player] });
      else if (message.type === "player-left") { smooth.delete(message.id); update({ players: state.players.filter(p => p.id !== message.id), notice: message.name ? `${message.name} left the area.` : state.notice }); }
      else if (message.type === "chat") update({ messages: [...state.messages, message].slice(-60) });
      else if (message.type === "party") update({ party: message.party ?? null, invitation: null });
      else if (message.type === "party-invite") update({ invitation: { partyId: message.partyId, from: message.from } });
      else if (message.type === "pong") update({ latency: Math.round(performance.now() - Number(message.t)) });
      else if (message.type === "notice") update({ notice: String(message.text || "") });
      else if (message.type === "error") update({ error: message.message || "Multiplayer action failed." });
    } catch { update({ error: "Received an invalid multiplayer message." }); }
  };
  current.onerror = () => { if (socket === current) update({ status: "error", error: "Connection failed. Check that the multiplayer server is running." }); };
  current.onclose = () => { if (socket !== current) return; if (pingTimer) clearInterval(pingTimer); smooth.clear(); update({ status: "offline", players: [], party: null, latency: null }); scheduleReconnect(); };
}
function applyServerCharacter(character: { gold?: number; inventory?: Record<string, number>; equipment?: Partial<Record<EquipmentSlot, string>> }) {
  if (!character || typeof character !== "object") return;
  if (Number.isFinite(character.gold)) game.data.gold = Math.max(0, Math.floor(character.gold!));
  if (character.inventory && typeof character.inventory === "object") game.data.inventory = { ...character.inventory };
  if (character.equipment && typeof character.equipment === "object") game.data.equipment = { ...character.equipment };
  save();
  // notify React's existing game store without replacing character progression
  emit();
}
let lastSent = "";
export function publishPosition(status: { dir?: number; moving?: boolean; action?: string | null } = {}) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  const d = game.data; const msg = { type: "move", scene: d.pos.scene, x: Math.round(d.pos.x * 100) / 100, y: Math.round(d.pos.y * 100) / 100, dir: status.dir ?? 0, moving: !!status.moving, hp: Math.round(d.hp), maxHp: d.maxHp, action: status.action ?? null };
  const key = JSON.stringify(msg); if (key === lastSent) return; lastSent = key; // skip idle updates
  sendNetwork(msg);
}
export function disconnectMultiplayer() {
  localStorage.removeItem(TOKEN_KEY); if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = null; if (pingTimer) clearInterval(pingTimer); const s = socket; socket = null; s?.close(); smooth.clear();
  update({ ...initial });
}
