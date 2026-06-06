export type HeldItemKind =
  | 'none'
  | 'sword'
  | 'pickaxe'
  | 'axe'
  | 'bow'
  | 'armor'
  | 'tool'
  | 'weapon'
  | 'food'
  | 'building'
  | 'resource'
  | 'other'

const PICKAXE_IDS = new Set(['pickaxe', 'iron_pick'])
const AXE_IDS = new Set(['axe'])
const BOW_IDS = new Set(['wood_bow', 'iron_bow', 'magic_bow'])
const ARMOR_IDS = new Set(['leather_armor', 'iron_armor', 'gold_armor', 'crystal_armor', 'shield'])
const TOOL_IDS = new Set(['flashlight'])
const WEAPON_IDS = new Set(['laser_orb', 'laser_gun', 'whirlwind_hammer', 'grenade'])
const FOOD_IDS = new Set([
  'berry', 'tomato', 'purple_grape', 'onion', 'carrot', 'pumpkin', 'watermelon',
  'bread', 'meat', 'cooked_meat', 'gourmet',
])
const BUILDING_IDS = new Set([
  'furnace',
  'spike_trap',
  'fire_trap',
  'ice_trap',
  'laser_tower',
  'cannon_tower',
  'bed',
])
const RESOURCE_IDS = new Set([
  'wood',
  'stone',
  'iron',
  'gold',
  'crystal',
  'bone',
  'plank',
  'ingot',
  'gold_ingot',
  'arrow',
  'fire_arrow',
  'ice_arrow',
  'leather',
  'feather',
  'spice',
  'seasoning',
  'fire_essence',
  'ice_essence',
  'ancient_crystal',
  'blueprint',
  'blueprint_1',
  'blueprint_2',
  'blueprint_3',
  'blueprint_4',
  'blueprint_5',
  'dungeon_map',
])

export function getHeldItemKind(itemId: string | null | undefined): HeldItemKind {
  if (!itemId) return 'none'
  if (PICKAXE_IDS.has(itemId) || itemId.endsWith('_pick')) return 'pickaxe'
  if (AXE_IDS.has(itemId)) return 'axe'
  if (itemId.endsWith('_sword')) return 'sword'
  if (BOW_IDS.has(itemId) || itemId.endsWith('_bow')) return 'bow'
  if (ARMOR_IDS.has(itemId) || itemId.endsWith('_armor')) return 'armor'
  if (TOOL_IDS.has(itemId)) return 'tool'
  if (WEAPON_IDS.has(itemId)) return 'weapon'
  if (FOOD_IDS.has(itemId)) return 'food'
  if (BUILDING_IDS.has(itemId)) return 'building'
  if (RESOURCE_IDS.has(itemId)) return 'resource'
  return 'other'
}

export function isHeldItemKind(itemId: string | null | undefined, kind: HeldItemKind): boolean {
  return getHeldItemKind(itemId) === kind
}
