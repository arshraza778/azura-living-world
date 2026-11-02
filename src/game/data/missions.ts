import type { MonsterKind, RegionId } from "../core/types";

export type MissionCategory = "hunt" | "explore" | "dungeon";

export type MissionGoal =
  | { type: "kill"; monster: MonsterKind; count: number }
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
  { id: "hunt_slime", category: "hunt", rank: "E", title: "Slime Culling", giver: "Farmer Odo", description: "Moss slimes are spoiling the berry patches at the edge of the Verdant Wilds. Thin their numbers.", goal: { type: "kill", monster: "slime", count: 5 }, reward: { xp: 40, gold: 25, items: { bread: 2 } } },
  { id: "hunt_wolf", category: "hunt", rank: "D", title: "Wolves at the Treeline", giver: "Captain Rhea", description: "A thicket wolf pack has been seen near the North Road. Drive them back.", goal: { type: "kill", monster: "wolf", count: 3 }, reward: { xp: 70, gold: 40, items: { herb: 2 } } },
  { id: "hunt_spider", category: "hunt", rank: "C", title: "Thornveil Venom", giver: "Alchemist Wen", description: "Bring down spiderlings in Thornveil Jungle. Their venom sacs make fine antidotes.", goal: { type: "kill", monster: "spiderling", count: 4 }, reward: { xp: 120, gold: 70, items: { azure_potion: 1 } } },
  { id: "hunt_golem", category: "hunt", rank: "B", title: "Stone That Walks", giver: "Scholar Imre", description: "Topple two Ruin Golems in the Forgotten Reach so our scholars can study the obelisks.", goal: { type: "kill", monster: "golem", count: 2 }, reward: { xp: 160, gold: 90 } },
  { id: "exp_lake", category: "explore", rank: "E", title: "Echoes of Mirrorlake", giver: "Guild", description: "Walk the Hollow Path west and survey Mirrorlake. Report what you see in its still water.", goal: { type: "poi", poi: "mirrorlake" }, reward: { xp: 30, gold: 15 } },
  { id: "exp_falls", category: "explore", rank: "D", title: "The Waterfall's Whisper", giver: "Bard Silas", description: "Find the Whispering Falls along the Sunfall River and listen to its song.", goal: { type: "poi", poi: "whispering_falls" }, reward: { xp: 50, gold: 25 } },
  { id: "exp_reach", category: "explore", rank: "C", title: "Survey the Forgotten Reach", giver: "Scholar Imre", description: "Follow the Ruin Road to the Forgotten Reach and locate the Sunken Obelisk.", goal: { type: "poi", poi: "sunken_obelisk" }, reward: { xp: 90, gold: 45 } },
  { id: "exp_blackwood", category: "explore", rank: "A", title: "Into the Lightless", giver: "Guildmaster", description: "Only the bold. Enter the Blackwood Expanse and return alive.", goal: { type: "region", region: "blackwood" }, reward: { xp: 150, gold: 80 } },
  { id: "dun_gate", category: "dungeon", rank: "C", title: "The Hollowroot Gate", giver: "Guild", description: "Locate the ancient dungeon gate swallowed by roots in the Hollowroot woods and descend.", goal: { type: "poi", poi: "hollowroot_depths" }, reward: { xp: 80, gold: 40 } },
  { id: "dun_sentinels", category: "dungeon", rank: "C", title: "Silence the Sentinels", giver: "Captain Rhea", description: "Destroy six Hollow Sentinels patrolling the dungeon halls.", goal: { type: "kill", monster: "skeleton", count: 6 }, reward: { xp: 140, gold: 70 } },
  { id: "dun_king", category: "dungeon", rank: "A", title: "The Hollow King", giver: "Guildmaster", description: "Descend to the lowest throne and defeat the Hollow King. Beware — his altar is said to guard a Legendary relic.", goal: { type: "kill", monster: "hollow_king", count: 1 }, reward: { xp: 400, gold: 250 } },
];

export const MAX_ACTIVE_MISSIONS = 4;
