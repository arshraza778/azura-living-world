export type ItemKind = "food" | "potion" | "material" | "relic" | "gear";

export type ItemRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythical";
export type EquipmentSlot = "weapon" | "helmet" | "chest" | "gloves" | "boots" | "accessory";

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  icon: string;
  value: number;
  use?: { hp?: number; hunger?: number; stamina?: number };
  /** Bonus stats only while equipped. */
  attack?: number;
  defence?: number;
  healthBonus?: number;
  staminaBonus?: number;
  rarity?: ItemRarity;
  slot?: EquipmentSlot;
  upgradeMax?: number;
}

export const CATEGORY_LABEL: Record<ItemKind, string> = {
  food: "Food",
  potion: "Potion",
  material: "Material",
  relic: "Relic",
  gear: "Equipment",
};

export const ITEMS: Record<string, ItemDef> = {
  apple: { id: "apple", name: "Red Apple", icon: "🍎", description: "Crisp orchard apple. Restores 15 hunger and 10 stamina.", kind: "food", value: 1, use: { hunger: 15, stamina: 10 } },
  bread: { id: "bread", name: "Honey Bread", icon: "🍞", description: "Fresh from the Eldergrove ovens. Restores 35 hunger.", kind: "food", value: 2, use: { hunger: 35 } },
  healing_potion: { id: "healing_potion", name: "Basic Healing Potion", icon: "🧪", description: "A red tonic brewed by the village herbalist. Restores 45 health.", kind: "potion", value: 6, use: { hp: 45 } },
  herb: { id: "herb", name: "Healing Herb", icon: "🌿", description: "A bitter leaf that closes wounds. Restores 25 health.", kind: "potion", value: 3, use: { hp: 25 } },
  azure_potion: { id: "azure_potion", name: "Azure Draught", icon: "💧", description: "Shimmering blue tonic. Restores 70 health and 50 stamina.", kind: "potion", value: 10, use: { hp: 70, stamina: 50 } },
  wooden_sword: { id: "wooden_sword", name: "Wooden Sword", icon: "🗡️", description: "A sturdy practice blade from Kael's training yard. +4 attack while carried.", kind: "gear", value: 4, attack: 4, rarity: "Common", slot: "weapon", upgradeMax: 5 },
  forest_fiber: { id: "forest_fiber", name: "Forest Fiber", icon: "🪢", description: "Tough woven bark strands gathered in the Verdant Wilds. Crafting material.", kind: "material", value: 2 },
  slime_gel: { id: "slime_gel", name: "Slime Gel", icon: "🟢", description: "Wobbly and faintly luminous.", kind: "material", value: 3 },
  wolf_pelt: { id: "wolf_pelt", name: "Wolf Pelt", icon: "🐺", description: "Thick grey fur from the Verdant thickets.", kind: "material", value: 6 },
  goblin_token: { id: "goblin_token", name: "Goblin Scout Token", icon: "🪙", description: "A crude carved token carried by goblin scouts. Guild bounty proof.", kind: "material", value: 7 },
  boar_tusk: { id: "boar_tusk", name: "Forest Boar Tusk", icon: "🦷", description: "A sturdy curved tusk, useful for basic crafting.", kind: "material", value: 8 },
  heartwood_core: { id: "heartwood_core", name: "Ancient Heartwood Core", icon: "🌳", description: "A pulsing core from an ancient forest guardian.", kind: "material", value: 22 },
  venom_sac: { id: "venom_sac", name: "Venom Sac", icon: "🟣", description: "Thornveil poison — prized by alchemists.", kind: "material", value: 8 },
  rare_herb: { id: "rare_herb", name: "Venomblossom", icon: "🌸", description: "A rare violet flower. Potion ingredient.", kind: "material", value: 12 },
  ancient_shard: { id: "ancient_shard", name: "Ancient Shard", icon: "🔷", description: "Rune-etched stone from the First Kingdom.", kind: "relic", value: 15 },
  bone_dust: { id: "bone_dust", name: "Bone Dust", icon: "🦴", description: "Remains of Hollowroot's restless guards.", kind: "material", value: 5 },
  umbral_essence: { id: "umbral_essence", name: "Umbral Essence", icon: "🌑", description: "Cold shadow, bottled. Hums in your pack.", kind: "relic", value: 25 },
  kings_sigil: { id: "kings_sigil", name: "Sigil of the Hollow King", icon: "👑", description: "Proof of the Hollow King's defeat. The sealed altar reacts to it…", kind: "relic", value: 100 },
  cave_silk: { id: "cave_silk", name: "Cave Silk", icon: "🕸️", description: "Tough luminous silk spun in the deep halls.", kind: "material", value: 9 },
  shadow_ember: { id: "shadow_ember", name: "Shadow Ember", icon: "🌑", description: "A cold ember left by a shadow goblin.", kind: "relic", value: 12 },
  ancient_bone: { id: "ancient_bone", name: "Ancient Bone", icon: "🦴", description: "Bone from a guardian of the old kingdom.", kind: "material", value: 10 },
  root_shard: { id: "root_shard", name: "Root Shard", icon: "🌿", description: "A hardened fragment of enchanted root.", kind: "material", value: 14 },
  wraith_dust: { id: "wraith_dust", name: "Wraith Dust", icon: "✨", description: "Faintly luminous dust from a dungeon wraith.", kind: "relic", value: 16 },
  guardian_core: { id: "guardian_core", name: "Hollowroot Core", icon: "💠", description: "The awakened heart of the Hollowroot Guardian.", kind: "relic", value: 90 },
  iron_sword: { id: "iron_sword", name: "Ironbark Sword", icon: "⚔️", description: "A balanced sword tempered with forest iron.", kind: "gear", value: 35, attack: 8, rarity: "Rare", slot: "weapon", upgradeMax: 5 },
  rootbound_helm: { id: "rootbound_helm", name: "Rootbound Helm", icon: "🪖", description: "Bark plates protect the brow. +3 defence.", kind: "gear", value: 28, defence: 3, healthBonus: 5, rarity: "Common", slot: "helmet", upgradeMax: 5 },
  deepwarden_mail: { id: "deepwarden_mail", name: "Deepwarden Mail", icon: "🛡️", description: "Stone-linked chest armour from Hollowroot.", kind: "gear", value: 60, defence: 7, healthBonus: 15, rarity: "Epic", slot: "chest", upgradeMax: 5 },
  cavegrip_gloves: { id: "cavegrip_gloves", name: "Cavegrip Gloves", icon: "🧤", description: "Grip rough stone and weapon hilts.", kind: "gear", value: 18, attack: 2, rarity: "Common", slot: "gloves", upgradeMax: 5 },
  rootrunner_boots: { id: "rootrunner_boots", name: "Rootrunner Boots", icon: "🥾", description: "Light boots woven with living roots.", kind: "gear", value: 24, staminaBonus: 10, rarity: "Rare", slot: "boots", upgradeMax: 5 },
  crystal_charm: { id: "crystal_charm", name: "Deepglow Charm", icon: "🔮", description: "A crystal charm that strengthens its bearer.", kind: "gear", value: 45, healthBonus: 10, staminaBonus: 5, rarity: "Rare", slot: "accessory", upgradeMax: 5 },
  mythic_seal: { id: "mythic_seal", name: "Mythical Seal (Locked Future System)", icon: "🔒", description: "Reserved for a future server-backed rarity system. Cannot be obtained or equipped.", kind: "relic", value: 0, rarity: "Mythical" },
  wood: { id: "wood", name: "Hardwood Log", icon: "🪵", description: "Sturdy timber gathered from the Verdant Wilds.", kind: "material", value: 2 },
  branch: { id: "branch", name: "Dry Branch", icon: "🌿", description: "Useful for handles, rods and kindling.", kind: "material", value: 1 },
  stone: { id: "stone", name: "Fieldstone", icon: "🪨", description: "Common stone for tools and construction.", kind: "material", value: 2 },
  iron_ore: { id: "iron_ore", name: "Iron Ore", icon: "⛏️", description: "Raw iron ore from rocky deposits.", kind: "material", value: 5 },
  copper_ore: { id: "copper_ore", name: "Copper Ore", icon: "🟠", description: "Soft copper ore.", kind: "material", value: 4 },
  mushroom: { id: "mushroom", name: "Forest Mushroom", icon: "🍄", description: "A hearty edible mushroom and potion ingredient.", kind: "food", value: 3, use: { hunger: 12 } },
  cooked_fish: { id: "cooked_fish", name: "Pan-seared River Fish", icon: "🍲", description: "A warm meal that restores 50 hunger.", kind: "food", value: 12, use: { hunger: 50, stamina: 10 } },
  wheat: { id: "wheat", name: "Wheat", icon: "🌾", description: "Freshly harvested grain.", kind: "food", value: 2 },
  carrot: { id: "carrot", name: "Carrot", icon: "🥕", description: "A crisp farm vegetable.", kind: "food", value: 3, use: { hunger: 18 } },
  potato: { id: "potato", name: "Potato", icon: "🥔", description: "A filling farm vegetable.", kind: "food", value: 3, use: { hunger: 22 } },
  herb_seeds: { id: "herb_seeds", name: "Herb Seeds", icon: "🌱", description: "Seeds for a small medicinal crop.", kind: "material", value: 2 },
  wheat_seeds: { id: "wheat_seeds", name: "Wheat Seeds", icon: "🌾", description: "Seeds for wheat.", kind: "material", value: 1 },
  carrot_seeds: { id: "carrot_seeds", name: "Carrot Seeds", icon: "🥕", description: "Seeds for carrots.", kind: "material", value: 1 },
  potato_seeds: { id: "potato_seeds", name: "Potato Seeds", icon: "🥔", description: "Seeds for potatoes.", kind: "material", value: 1 },
  axe: { id: "axe", name: "Woodcutter Axe", icon: "🪓", description: "Required to harvest timber.", kind: "gear", value: 8 },
  pickaxe: { id: "pickaxe", name: "Miner's Pickaxe", icon: "⛏️", description: "Required to mine ore and stone.", kind: "gear", value: 10 },
  gathering_knife: { id: "gathering_knife", name: "Gathering Knife", icon: "🔪", description: "A small field knife for herbs and plants.", kind: "gear", value: 5 },
  fishing_rod: { id: "fishing_rod", name: "Fishing Rod", icon: "🎣", description: "A simple rod for fishing at rivers and ponds.", kind: "gear", value: 8 },
  watering_can: { id: "watering_can", name: "Watering Can", icon: "🚿", description: "Water planted crops.", kind: "gear", value: 6 },
  stamina_potion: { id: "stamina_potion", name: "Stamina Tonic", icon: "🧴", description: "Restores 45 stamina.", kind: "potion", value: 12, use: { stamina: 45 } },
  river_fish: { id: "river_fish", name: "River Fish", icon: "🐟", description: "Fresh fish, best cooked at a kitchen.", kind: "food", value: 5, use: { hunger: 28 } },
  golden_trout: { id: "golden_trout", name: "Golden Trout", icon: "🐠", description: "A rare shimmering catch.", kind: "food", value: 25, rarity: "Rare", use: { hunger: 45 } },
  root_key: { id: "root_key", name: "Rootbound Key", icon: "🗝️", description: "An ancient iron key threaded with living roots. Opens a sealed side passage in Hollowroot.", kind: "material", value: 0 },
};

export const SHOP_STOCK: { id: string; price: number }[] = [
  { id: "apple", price: 2 },
  { id: "bread", price: 5 },
  { id: "healing_potion", price: 12 },
  { id: "herb", price: 8 },
  { id: "azure_potion", price: 25 },
  { id: "wooden_sword", price: 20 },
];

export const REST_PRICE = 10;
