import type { MonsterKind, RegionId } from "../core/types";

export type MissionCategory = "hunt" | "explore" | "dungeon";

export type MissionGoal =
  | { type: "kill"; monster: MonsterKind; count: number }
  | { type: "collect"; item: string; count: number }
  | { type: "poi"; poi: string }
  | { type: "region"; region: RegionId };

export interface MissionDef {
  id: string;
  category: MissionCategory;
  rank: "E" | "D" | "C" | "B" | "A";
  title: string;
  giver: string;
  description: string;
  goal: MissionGoal;
  reward: { xp: number; gold: number; items?: Record<string, number> };
}

export const MISSIONS: MissionDef[] = [
  { id: "hunt_slime", category: "hunt", rank: "E", title: "Slime Culling", giver: "Farmer Odo", description: "Moss slimes are spoiling the berry patches at the edge of the Verdant Wilds. Thin their numbers.", goal: { type: "kill", monster: "slime", count: 3 }, reward: { xp: 40, gold: 25, items: { bread: 2 } } },
  { id: "hunt_goblin_items", category: "hunt", rank: "E", title: "Scout Proof", giver: "Guild Receptionist", description: "Recover three carved tokens dropped by goblin scouts in the Verdant Wilds.", goal: { type: "collect", item: "goblin_token", count: 3 }, reward: { xp: 55, gold: 35, items: { healing_potion: 1 } } },
  { id: "hunt_wolf", category: "hunt", rank: "D", title: "Wolves at the Treeline", giver: "Captain Rhea", description: "A thicket wolf pack has been seen near the North Road. Drive them back.", goal: { type: "kill", monster: "wolf", count: 2 }, reward: { xp: 70, gold: 40, items: { herb: 2 } } },
  { id: "hunt_spider", category: "hunt", rank: "C", title: "Thornveil Venom", giver: "Alchemist Wen", description: "Bring down spiderlings in Thornveil Jungle. Their venom sacs make fine antidotes.", goal: { type: "kill", monster: "spiderling", count: 4 }, reward: { xp: 120, gold: 70, items: { azure_potion: 1 } } },
  { id: "hunt_golem", category: "hunt", rank: "B", title: "Stone That Walks", giver: "Scholar Imre", description: "Topple two Ruin Golems in the Forgotten Reach so our scholars can study the obelisks.", goal: { type: "kill", monster: "golem", count: 2 }, reward: { xp: 160, gold: 90 } },
  { id: "exp_lake", category: "explore", rank: "E", title: "Echoes of Mirrorlake", giver: "Guild", description: "Walk the Hollow Path west and survey Mirrorlake. Report what you see in its still water.", goal: { type: "poi", poi: "mirrorlake" }, reward: { xp: 30, gold: 15 } },
  { id: "exp_falls", category: "explore", rank: "D", title: "The Waterfall's Whisper", giver: "Bard Silas", description: "Find the Whispering Falls along the Sunfall River and listen to its song.", goal: { type: "poi", poi: "whispering_falls" }, reward: { xp: 50, gold: 25 } },
  { id: "exp_reach", category: "explore", rank: "C", title: "Survey the Forgotten Reach", giver: "Scholar Imre", description: "Follow the Ruin Road to the Forgotten Reach and locate the Sunken Obelisk.", goal: { type: "poi", poi: "sunken_obelisk" }, reward: { xp: 90, gold: 45 } },
  { id: "exp_blackwood", category: "explore", rank: "A", title: "Into the Lightless", giver: "Guildmaster", description: "Only the bold. Enter the Blackwood Expanse and return alive.", goal: { type: "region", region: "blackwood" }, reward: { xp: 150, gold: 80 } },
  { id: "dun_gate", category: "dungeon", rank: "C", title: "The Hollowroot Gate", giver: "Guild", description: "Locate the ancient dungeon gate swallowed by roots in the Hollowroot woods and descend.", goal: { type: "poi", poi: "hollowroot_depths" }, reward: { xp: 80, gold: 40 } },
  { id: "dun_sentinels", category: "dungeon", rank: "C", title: "Silence the Sentinels", giver: "Captain Rhea", description: "Destroy six Hollow Sentinels patrolling the dungeon halls.", goal: { type: "kill", monster: "skeleton", count: 6 }, reward: { xp: 140, gold: 70 } },
  { id: "dun_king", category: "dungeon", rank: "A", title: "The Hollow King", giver: "Guildmaster", description: "An old record mentions a crowned skeleton in the deep halls. The story may have changed since then.", goal: { type: "kill", monster: "hollow_king", count: 1 }, reward: { xp: 400, gold: 250 } },
  { id: "dun_explore", category: "dungeon", rank: "C", title: "Beneath the Hollow Roots", giver: "Lyra", description: "Explore the two known depths of Hollowroot and report the inscriptions and hidden passages.", goal: { type: "poi", poi: "hollowroot_depths" }, reward: { xp: 100, gold: 55, items: { healing_potion: 2 } } },
  { id: "dun_delver", category: "dungeon", rank: "B", title: "Clear the Deep Halls", giver: "Captain Rhea", description: "Defeat four monsters that haunt Hollowroot's ancient chambers.", goal: { type: "kill", monster: "ancient_skeleton", count: 4 }, reward: { xp: 180, gold: 110, items: { iron_sword: 1 } } },
  { id: "dun_guardian", category: "dungeon", rank: "A", title: "The Hollowroot Guardian", giver: "Guildmaster", description: "Reach the throne chamber and defeat the ancient root-and-stone guardian. Return with its core.", goal: { type: "kill", monster: "hollowroot_guardian", count: 1 }, reward: { xp: 600, gold: 300, items: { deepwarden_mail: 1, crystal_charm: 1 } } },
];

export const MAX_ACTIVE_MISSIONS = 4;
