export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: "food" | "potion" | "material" | "relic";
  value: number;
  use?: { hp?: number; hunger?: number; stamina?: number };
}

export const ITEMS: Record<string, ItemDef> = {
  bread: { id: "bread", name: "Honey Bread", description: "Fresh from the Eldergrove ovens. Restores 35 hunger.", kind: "food", value: 2, use: { hunger: 35 } },
  herb: { id: "herb", name: "Healing Herb", description: "A bitter leaf that closes wounds. Restores 25 health.", kind: "potion", value: 3, use: { hp: 25 } },
  azure_potion: { id: "azure_potion", name: "Azure Draught", description: "Shimmering blue tonic. Restores 70 health and 50 stamina.", kind: "potion", value: 10, use: { hp: 70, stamina: 50 } },
  slime_gel: { id: "slime_gel", name: "Slime Gel", description: "Wobbly and faintly luminous.", kind: "material", value: 3 },
  wolf_pelt: { id: "wolf_pelt", name: "Wolf Pelt", description: "Thick grey fur from the Verdant thickets.", kind: "material", value: 6 },
  venom_sac: { id: "venom_sac", name: "Venom Sac", description: "Thornveil poison — prized by alchemists.", kind: "material", value: 8 },
  rare_herb: { id: "rare_herb", name: "Venomblossom", description: "A rare violet flower. Potion ingredient.", kind: "material", value: 12 },
  ancient_shard: { id: "ancient_shard", name: "Ancient Shard", description: "Rune-etched stone from the First Kingdom.", kind: "relic", value: 15 },
  bone_dust: { id: "bone_dust", name: "Bone Dust", description: "Remains of Hollowroot's restless guards.", kind: "material", value: 5 },
  umbral_essence: { id: "umbral_essence", name: "Umbral Essence", description: "Cold shadow, bottled. Hums in your pack.", kind: "relic", value: 25 },
  kings_sigil: { id: "kings_sigil", name: "Sigil of the Hollow King", description: "Proof of the Hollow King's defeat. The sealed altar reacts to it…", kind: "relic", value: 100 },
};

export const SHOP_STOCK: { id: string; price: number }[] = [
  { id: "bread", price: 5 },
  { id: "herb", price: 8 },
  { id: "azure_potion", price: 25 },
];

export const REST_PRICE = 10;
