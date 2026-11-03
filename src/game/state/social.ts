import { ITEMS } from "../data/items";
import { emit, game, save, toast } from "./store";

const clampInt = (n: number, min: number, max: number) => Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : min;

// Phase 6: the starter cottage is owned by the player and its chest is persistent.
export function storeAtHome(itemId: string, quantity: number) {
  const d = game.data;
  const count = clampInt(quantity, 1, 999);
  if (!d.housing.ownedHomeId || !ITEMS[itemId] || Object.values(d.equipment ?? {}).includes(itemId) || (d.inventory[itemId] ?? 0) < count) return toast("You do not have that many items to store.", "bad");
  d.inventory[itemId] -= count;
  if (!d.inventory[itemId]) delete d.inventory[itemId];
  d.housing.storage[itemId] = (d.housing.storage[itemId] ?? 0) + count;
  save(); emit(); toast(`Stored ${count}× ${ITEMS[itemId].name}.`, "good");
}

export function retrieveFromHome(itemId: string, quantity: number) {
  const d = game.data;
  const count = clampInt(quantity, 1, 999);
  if (!d.housing.ownedHomeId || (d.housing.storage[itemId] ?? 0) < count || !ITEMS[itemId]) return toast("That item is not in your home storage.", "bad");
  d.housing.storage[itemId] -= count;
  if (!d.housing.storage[itemId]) delete d.housing.storage[itemId];
  d.inventory[itemId] = (d.inventory[itemId] ?? 0) + count;
  save(); emit(); toast(`Retrieved ${count}× ${ITEMS[itemId].name}.`, "good");
}

export function renameHome(name: string) {
  const clean = name.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 28);
  if (!clean || !game.data.housing.ownedHomeId) return toast("Enter a valid home name.", "bad");
  game.data.housing.homeName = clean; save(); emit(); toast(`Home renamed to ${clean}.`, "good");
}

// Phase 7: local prototype marketplace. Listings are browser-local until Phase 9 server sync.
export function createMarketListing(itemId: string, quantity: number, unitPrice: number) {
  const d = game.data, count = clampInt(quantity, 1, 999), price = clampInt(unitPrice, 1, 100000);
  const item = ITEMS[itemId];
  if (!item || (d.inventory[itemId] ?? 0) < count) return toast("You do not have enough items to list.", "bad");
  if (d.equipment && Object.values(d.equipment).includes(itemId)) return toast("Unequip this item before listing it.", "bad");
  d.inventory[itemId] -= count; if (!d.inventory[itemId]) delete d.inventory[itemId];
  d.marketListings.unshift({ id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, seller: d.name, sellerType: "player", itemId, quantity: count, unitPrice: price, createdAt: Date.now() });
  save(); emit(); toast(`${count}× ${item.name} listed for ${price} gold each.`, "good");
}

export function buyMarketListing(listingId: string, quantity = 1) {
  const d = game.data, listing = d.marketListings.find((x) => x.id === listingId);
  if (!listing) return toast("This listing is no longer available.", "bad");
  if (listing.sellerType === "player" && listing.seller === d.name) return toast("You cannot buy your own listing.", "bad");
  const count = clampInt(quantity, 1, listing.quantity), total = count * listing.unitPrice;
  if (d.gold < total) return toast("Not enough gold.", "bad");
  d.gold -= total; d.inventory[listing.itemId] = (d.inventory[listing.itemId] ?? 0) + count;
  listing.quantity -= count;
  if (listing.quantity <= 0) d.marketListings = d.marketListings.filter((x) => x.id !== listingId);
  save(); emit(); toast(`Purchased ${count}× ${ITEMS[listing.itemId].name} for ${total} gold.`, "good");
}

export function cancelMarketListing(listingId: string) {
  const d = game.data, listing = d.marketListings.find((x) => x.id === listingId);
  if (!listing || listing.sellerType !== "player" || listing.seller !== d.name) return toast("You cannot cancel this listing.", "bad");
  d.inventory[listing.itemId] = (d.inventory[listing.itemId] ?? 0) + listing.quantity;
  d.marketListings = d.marketListings.filter((x) => x.id !== listingId);
  save(); emit(); toast("Listing cancelled; items returned to inventory.", "good");
}

// Phase 8: guild management and message board, stored locally until shared-world sync.
const OPEN_GUILDS = [
  { id: "verdant-wardens", name: "Verdant Wardens", leader: "Captain Rhea", members: ["Tomas", "Sela", "Kael"] },
  { id: "rootwatch", name: "Rootwatch Company", leader: "Dorn", members: ["Wren", "Imre"] },
];
export const availableGuilds = OPEN_GUILDS;

export function createPlayerGuild(name: string) {
  const d = game.data, clean = name.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 28);
  if (d.guild.id) return toast("Leave your current guild first.", "bad");
  if (!clean) return toast("Enter a guild name.", "bad");
  if (d.gold < 100) return toast("Creating a guild costs 100 gold.", "bad");
  d.gold -= 100;
  const id = `guild-${Date.now()}`;
  d.guild = { id, name: clean, role: "leader", members: [{ id: "player", name: d.name, role: "leader" }], messages: [] };
  save(); emit(); toast(`${clean} has been founded.`, "gold");
}

export function joinAvailableGuild(id: string) {
  const d = game.data, guild = OPEN_GUILDS.find((g) => g.id === id);
  if (!guild) return toast("That guild is unavailable.", "bad");
  if (d.guild.id) return toast("Leave your current guild first.", "bad");
  d.guild = { id: guild.id, name: guild.name, role: "member", members: [{ id: "npc-leader", name: guild.leader, role: "leader" }, ...guild.members.map((name, i) => ({ id: `npc-${i}`, name, role: "member" as const })), { id: "player", name: d.name, role: "member" }], messages: [] };
  save(); emit(); toast(`You joined ${guild.name}.`, "good");
}

export function leavePlayerGuild() {
  if (!game.data.guild.id) return;
  game.data.guild = { id: null, name: null, role: null, members: [], messages: [] };
  save(); emit(); toast("You left your guild.", "info");
}

export function postGuildMessage(text: string) {
  const d = game.data, clean = text.trim().replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, 240);
  if (!d.guild.id || !clean) return;
  d.guild.messages.push({ id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, author: d.name, text: clean, createdAt: Date.now() });
  d.guild.messages = d.guild.messages.slice(-50);
  save(); emit();
}
