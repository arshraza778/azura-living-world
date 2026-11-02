import type { Look, NpcRole, RegionId } from "../core/types";

export type PoiKind = "town" | "landmark" | "cave" | "dungeon" | "ruin" | "boss" | "mythic" | "waterfall" | "structure";

export interface PoiDef {
  id: string;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  kind: PoiKind;
  description: string;
  /** what happens when the player presses E at this place */
  interact?:
    | { type: "inspect"; text: string }
    | { type: "chest"; text: string; loot: Record<string, number>; gold: number }
    | { type: "locked"; text: string }
    | { type: "dungeon" };
  hidden?: boolean; // not shown on map until discovered
}

export const POIS: PoiDef[] = [
  { id: "eldergrove", name: "Eldergrove", region: "eldergrove", x: 106, y: 80, kind: "town", description: "The main village and heart of Azura's frontier." },
  { id: "mirrorlake", name: "Mirrorlake", region: "verdant", x: 62, y: 81, kind: "landmark", description: "A perfectly still lake that reflects stars even at noon.", interact: { type: "inspect", text: "The water shows the sky — but the stars in it are arranged differently. A map of somewhere else?" } },
  { id: "whispering_falls", name: "Whispering Falls", region: "forgotten", x: 158, y: 48, kind: "waterfall", description: "The Sunfall River tumbles from an old cliff with a voice like a choir.", interact: { type: "inspect", text: "Within the roar you hear a melody… a fragment of a song in the First Kingdom's tongue." } },
  { id: "moss_cave", name: "Mossback Hollow", region: "verdant", x: 72, y: 31, kind: "cave", description: "A small cave breathing cool air. Something glints inside.", interact: { type: "chest", text: "Beneath a curtain of moss you find an old adventurer's satchel.", loot: { herb: 3, azure_potion: 1 }, gold: 20 } },
  { id: "hunters_cabin", name: "Abandoned Hunter's Cabin", region: "verdant", x: 62, y: 53, kind: "structure", description: "A cabin left in a hurry. The door hangs open.", hidden: true, interact: { type: "chest", text: "A dusty trunk under the bed. The hunter's journal ends mid-sentence: 'The pines to the north grow darker each night—'", loot: { bread: 3, wolf_pelt: 2 }, gold: 15 } },
  { id: "hollowroot_gate", name: "Hollowroot Gate", region: "hollowroot", x: 38, y: 103, kind: "dungeon", description: "An ancient stone gate devoured by roots. Stairs lead down into darkness.", interact: { type: "dungeon" } },
  { id: "venom_glade", name: "Venomblossom Glade", region: "thornveil", x: 173, y: 96, kind: "landmark", description: "A hidden clearing carpeted with rare violet blooms.", hidden: true, interact: { type: "chest", text: "You carefully harvest the rarest blossoms without touching their thorns.", loot: { rare_herb: 3, venom_sac: 1 }, gold: 0 } },
  { id: "emerald_lagoon", name: "Emerald Lagoon", region: "thornveil", x: 170, y: 114, kind: "landmark", description: "Warm green water ringed by giant ferns.", interact: { type: "inspect", text: "Glowing fish circle beneath the surface. Something larger stirs further out." } },
  { id: "sunken_obelisk", name: "Sunken Obelisk", region: "forgotten", x: 150, y: 22, kind: "ruin", description: "A half-buried obelisk covered in luminous inscriptions.", interact: { type: "inspect", text: "The runes read, haltingly: 'Six lands bound by one river of stars. When the seventh opens, the crown returns.'" } },
  { id: "astral_ring", name: "Astral Ring", region: "forgotten", x: 175, y: 34, kind: "ruin", description: "A circle of standing pillars aligned with the constellations.", interact: { type: "chest", text: "At the ring's center, a stone drawer slides open with a sigh of ancient dust.", loot: { ancient_shard: 2 }, gold: 40 } },
  { id: "old_watchtower", name: "Old Watchtower", region: "eldergrove", x: 128, y: 58, kind: "ruin", description: "A crumbling watchtower overlooking the Ruin Road.", interact: { type: "inspect", text: "From here you can see the Forgotten Reach glinting gold to the north-east, and the black canopy of Blackwood far to the west." } },
  { id: "heart_blackwood", name: "Heart of Blackwood", region: "blackwood", x: 24, y: 19, kind: "boss", description: "A vast crater where the trees bow inward. World-boss lair.", interact: { type: "locked", text: "A colossal presence slumbers beneath the black earth. The ground breathes. (World-boss encounter — sealed in this prototype.)" } },
  { id: "shattered_shrine", name: "Shattered Shrine", region: "blackwood", x: 44, y: 42, kind: "mythic", description: "A broken shrine radiating something older than the forest.", hidden: true, interact: { type: "locked", text: "An inscription glows faintly: 'Here rests what no hand may claim — until the age of myth returns.' (Mythical item location — future.)" } },
];

export interface BuildingDef {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
  wall: string;
  sign?: boolean;
  enter?: "guild";
  lockedText?: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: "guild", name: "Adventurers' Guild", x: 101, y: 67, w: 10, h: 8, roof: "#2f5d8a", wall: "#d8c7a4", sign: true, enter: "guild" },
  { id: "inn", name: "The Sleeping Stag", x: 114, y: 73, w: 7, h: 6, roof: "#8a3b2f", wall: "#e1d2b2", sign: true, lockedText: "The inn's common room is closed for renovation. Bram the innkeeper waits outside." },
  { id: "shop", name: "Merchant's Row", x: 92, y: 75, w: 6, h: 5, roof: "#7a5a2a", wall: "#d9c9a8", sign: true, lockedText: "Goods are sold at the stall out front." },
  { id: "smithy", name: "Emberforge Smithy", x: 94, y: 84, w: 5, h: 4, roof: "#4a4a52", wall: "#b8a88a", sign: true, lockedText: "The forge is cold today. The smith is off gathering ore." },
  { id: "house1", name: "Cottage", x: 113, y: 84, w: 5, h: 4, roof: "#9a4a3a", wall: "#e6d8bc", lockedText: "It's locked. Someone is humming inside." },
  { id: "house2", name: "Cottage", x: 101, y: 88, w: 5, h: 4, roof: "#5a7a3a", wall: "#e2d4b6", lockedText: "It's locked." },
  { id: "house3", name: "Cottage", x: 121, y: 82, w: 4, h: 4, roof: "#8a5a3a", wall: "#dccdb0", lockedText: "It's locked." },
  { id: "house4", name: "Cottage", x: 88, y: 69, w: 5, h: 4, roof: "#3f6a7a", wall: "#e4d6b8", lockedText: "It's locked." },
  { id: "house5", name: "Elder's House", x: 117, y: 63, w: 6, h: 5, roof: "#6a3a5a", wall: "#e8dcc2", lockedText: "The elder is resting. Come back later." },
];

export interface NpcDef {
  id: string;
  name: string;
  title?: string;
  x: number;
  y: number;
  role: NpcRole;
  wander?: boolean;
  look: Look;
  lines: string[];
}

export const OVERWORLD_NPCS: NpcDef[] = [
  { id: "mira", name: "Mira", title: "Merchant", x: 95, y: 81.5, role: "merchant", look: { skin: "#f1c9a5", hair: "#c0582a", cloak: "#2f6a5a", trim: "#e6c36a" }, lines: ["Welcome to Merchant's Row! Bread, herbs and Azure Draughts — the essentials for any adventurer.", "I'll also buy any materials you haul back from the wilds."] },
  { id: "bram", name: "Bram", title: "Innkeeper", x: 117.5, y: 80, role: "innkeeper", look: { skin: "#e0b48c", hair: "#6a4a2a", cloak: "#7a3a2a", trim: "#f0d090" }, lines: ["The Sleeping Stag never sleeps! Well — you can. Ten gold for a warm bed and a hot meal."] },
  { id: "kael", name: "Kael", title: "Weapons Trainer", x: 86, y: 80, role: "trainer", look: { skin: "#c99a74", hair: "#2a2a30", cloak: "#5a2a2a", trim: "#c0c0c8" }, lines: ["Swing with SPACE. Face your foe — your strike arcs in front of you.", "Sprinting with SHIFT burns stamina. Run out mid-fight and you'll be wolf food.", "Eat when you're hungry. An empty stomach slowly drains your health."] },
  { id: "elda", name: "Old Elda", title: "Villager", x: 104, y: 83, role: "villager", wander: true, look: { skin: "#f0d0b0", hair: "#dcdcdc", cloak: "#6a5a8a", trim: "#d0c0e0" }, lines: ["Eldergrove sits where all the roads meet. North to the Wilds, east to the Reach, south-east to Thornveil, west to the Hollowroot.", "Never go into the Blackwood at night. Never go in at all, if you're wise."] },
  { id: "pip", name: "Pip", title: "Village Child", x: 109, y: 85, role: "villager", wander: true, look: { skin: "#f5d2b0", hair: "#e0b040", cloak: "#3a7ac0", trim: "#ffffff" }, lines: ["Did you know there's a cabin hidden off the trail in the forest? My brother says a ghost lives there!"] },
  { id: "rhea", name: "Captain Rhea", title: "Village Guard", x: 103.5, y: 63, role: "villager", look: { skin: "#d9a886", hair: "#8a2a2a", cloak: "#3a4a6a", trim: "#c8c8d0" }, lines: ["The North Road leads into the Verdant Wilds. Wolves have been bold lately.", "Check the Guild's mission board if you want coin for your trouble."] },
  { id: "imre", name: "Scholar Imre", title: "Wandering Scholar", x: 147, y: 26, role: "villager", look: { skin: "#e8c0a0", hair: "#4a3a2a", cloak: "#8a6a2a", trim: "#f0e0a0" }, lines: ["Remarkable! These inscriptions predate Eldergrove by three thousand years.", "The obelisks speak of six lands… and a seventh that is sealed."] },
];

export const PLAYER_LOOK: Look = { skin: "#f2cfae", hair: "#2a3a5a", cloak: "#2f5d8a", trim: "#e6c36a" };
