export type ItemKind = "food" | "potion" | "material" | "relic" | "gear";

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  icon: string;
  value: number;
  use?: { hp?: number; hunger?: number; stamina?: number };
  /** Bonus attack while carried (gear). */
  attack?: number;
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
  wooden_sword: { id: "wooden_sword", name: "Wooden Sword", icon: "🗡️", description: "A sturdy practice blade from Kael's training yard. +4 attack while carried.", kind: "gear", value: 4, attack: 4 },
  forest_fiber: { id: "forest_fiber", name: "Forest Fiber", icon: "🪢", description: "Tough woven bark strands gathered in the Verdant Wilds. Crafting material.", kind: "material", value: 2 },
  slime_gel: { id: "slime_gel", name: "Slime Gel", icon: "🟢", description: "Wobbly and faintly luminous.", kind: "material", value: 3 },
  wolf_pelt: { id: "wolf_pelt", name: "Wolf Pelt", icon: "🐺", description: "Thick grey fur from the Verdant thickets.", kind: "material", value: 6 },
  venom_sac: { id: "venom_sac", name: "Venom Sac", icon: "🟣", description: "Thornveil poison — prized by alchemists.", kind: "material", value: 8 },
  rare_herb: { id: "rare_herb", name: "Venomblossom", icon: "🌸", description: "A rare violet flower. Potion ingredient.", kind: "material", value: 12 },
  ancient_shard: { id: "ancient_shard", name: "Ancient Shard", icon: "🔷", description: "Rune-etched stone from the First Kingdom.", kind: "relic", value: 15 },
  bone_dust: { id: "bone_dust", name: "Bone Dust", icon: "🦴", description: "Remains of Hollowroot's restless guards.", kind: "material", value: 5 },
  umbral_essence: { id: "umbral_essence", name: "Umbral Essence", icon: "🌑", description: "Cold shadow, bottled. Hums in your pack.", kind: "relic", value: 25 },
  kings_sigil: { id: "kings_sigil", name: "Sigil of the Hollow King", icon: "👑", description: "Proof of the Hollow King's defeat. The sealed altar reacts to it…", kind: "relic", value: 100 },
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
