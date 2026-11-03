import { beforeEach, describe, expect, it } from "vitest";
import { defaultData, game } from "../game/state/store";
import {
  buyMarketListing, cancelMarketListing, createMarketListing, createPlayerGuild,
  joinAvailableGuild, leavePlayerGuild, postGuildMessage, renameHome,
  retrieveFromHome, storeAtHome,
} from "../game/state/social";

beforeEach(() => {
  game.data = defaultData();
  game.data.gold = 500;
  localStorage.clear();
});

describe("Phase 6 housing", () => {
  it("moves items to and from persistent home storage and renames the home", () => {
    const before = game.data.inventory["apple"];
    storeAtHome("apple", 2);
    expect(game.data.inventory["apple"]).toBe(before - 2);
    expect(game.data.housing.storage["apple"]).toBe(2);
    retrieveFromHome("apple", 1);
    expect(game.data.inventory["apple"]).toBe(before - 1);
    renameHome("Moonlit Cottage");
    expect(game.data.housing.homeName).toBe("Moonlit Cottage");
  });
  it("does not allow storing equipped gear", () => {
    const before = game.data.inventory["wooden_sword"];
    storeAtHome("wooden_sword", 1);
    expect(game.data.inventory["wooden_sword"]).toBe(before);
    expect(game.data.housing.storage["wooden_sword"]).toBeUndefined();
  });
});

describe("Phase 7 marketplace", () => {
  it("escrows player listings, prevents self-purchase, and restores cancelled items", () => {
    game.data.inventory["wolf_pelt"] = 2;
    createMarketListing("wolf_pelt", 1, 9);
    const listing = game.data.marketListings.find(x => x.sellerType === "player")!;
    expect(game.data.inventory["wolf_pelt"]).toBe(1);
    buyMarketListing(listing.id, 1);
    expect(game.data.inventory["wolf_pelt"]).toBe(1);
    cancelMarketListing(listing.id);
    expect(game.data.inventory["wolf_pelt"]).toBe(2);
  });
  it("settles a village purchase against gold and inventory", () => {
    const gold = game.data.gold;
    buyMarketListing("village-apple-1", 2);
    expect(game.data.gold).toBe(gold - 4);
    expect(game.data.inventory["apple"]).toBe(6);
  });
});

describe("Phase 8 guilds", () => {
  it("creates a guild, posts a message, and leaves cleanly", () => {
    createPlayerGuild("Forest Stars");
    expect(game.data.guild.name).toBe("Forest Stars");
    expect(game.data.guild.role).toBe("leader");
    postGuildMessage("Meet at the Guild hall.");
    expect(game.data.guild.messages[0].text).toBe("Meet at the Guild hall.");
    leavePlayerGuild();
    expect(game.data.guild.id).toBeNull();
  });
  it("joins an existing frontier guild", () => {
    joinAvailableGuild("verdant-wardens");
    expect(game.data.guild.name).toBe("Verdant Wardens");
    expect(game.data.guild.members.some(m => m.id === "player")).toBe(true);
  });
});
