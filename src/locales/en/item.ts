const item: Record<string, any> = {
  // ── Raw Materials ────────────────────────────────────────────
  wood:             { name: 'Wood' },
  stone:            { name: 'Stone' },
  iron:             { name: 'Iron Ore' },
  gold:             { name: 'Gold Ore' },
  crystal:          { name: 'Crystal' },
  bone:             { name: 'Bone' },
  // ── Processed Materials ──────────────────────────────────────
  plank:            { name: 'Plank' },
  ingot:            { name: 'Iron Ingot' },
  gold_ingot:       { name: 'Gold Ingot' },
  // ── Tools ────────────────────────────────────────────────────
  pickaxe:          { name: 'Stone Pickaxe' },
  iron_pick:        { name: 'Iron Pickaxe' },
  axe:              { name: 'Axe' },
  // ── Swords ───────────────────────────────────────────────────
  stone_sword:      { name: 'Stone Sword' },
  iron_sword:       { name: 'Iron Sword' },
  gold_sword:       { name: 'Gold Sword' },
  magic_sword:      { name: 'Magic Sword' },
  mithril_sword:    { name: 'Mithril Sword' },
  // ── Bows & Arrows ────────────────────────────────────────────
  wood_bow:         { name: 'Wood Bow' },
  iron_bow:         { name: 'Iron Bow' },
  magic_bow:        { name: 'Magic Bow' },
  arrow:            { name: 'Arrow' },
  fire_arrow:       { name: 'Fire Arrow' },
  ice_arrow:        { name: 'Ice Arrow' },
  // ── Food ─────────────────────────────────────────────────────
  berry:            { name: 'Berry' },
  tomato:           { name: 'Tomato' },
  purple_grape:     { name: 'Purple Grape' },
  onion:            { name: 'Onion' },
  carrot:           { name: 'Carrot' },
  pumpkin:          { name: 'Pumpkin' },
  watermelon:       { name: 'Watermelon' },
  bread:            { name: 'Bread' },
  meat:             { name: 'Meat' },
  cooked_meat:      { name: 'Cooked Meat' },
  gourmet:          { name: 'Afternoon Tea Set' },
  // ── Armor ────────────────────────────────────────────────────
  leather_armor:    { name: 'Leather Armor' },
  iron_armor:       { name: 'Iron Armor' },
  gold_armor:       { name: 'Gold Armor' },
  crystal_armor:    { name: 'Crystal Armor' },
  shield:           { name: 'Shield' },
  // ── Traps ────────────────────────────────────────────────────
  spike_trap:       { name: 'Spike Trap' },
  fire_trap:        { name: 'Fire Trap' },
  ice_trap:         { name: 'Ice Trap' },
  // ── Resources ────────────────────────────────────────────────
  leather:          { name: 'Leather' },
  feather:          { name: 'Feather' },
  spice:            { name: 'Spice' },
  seasoning:        { name: 'Seasoning' },
  fire_essence:     { name: 'Fire Essence' },
  ice_essence:      { name: 'Ice Essence' },
  ancient_crystal:  { name: 'Ancient Crystal' },
  // ── Late-game Equipment ──────────────────────────────────────
  laser_orb:        { name: 'Magic Orb' },
  // ── Blueprints ───────────────────────────────────────────────
  blueprint:        { name: 'Blueprint' },
  blueprint_1:      { name: 'Blueprint I (Laser Gun)' },
  blueprint_2:      { name: 'Blueprint II (Laser Tower)' },
  blueprint_3:      { name: 'Blueprint III (Cannon Tower)' },
  blueprint_4:      { name: 'Blueprint IV (Grenade)' },
  blueprint_5:      { name: 'Blueprint V (Whirlwind Hammer)' },
  dungeon_map:      { name: 'Dungeon Map' },
  // ── Advanced Weapons ─────────────────────────────────────────
  laser_gun:        { name: 'Laser Gun' },
  whirlwind_hammer: { name: 'Whirlwind Hammer' },
  // ── Consumable Weapons ───────────────────────────────────────
  grenade:          { name: 'Grenade' },
  // ── Bags ─────────────────────────────────────────────────────
  bag_small:        { name: 'Small Bag' },
  bag_large:        { name: 'Large Bag' },
  // ── Utility ──────────────────────────────────────────────────
  flashlight:       { name: 'Flashlight' },
  bed:              { name: 'Bed' },
  // ── Building Materials ───────────────────────────────────────
  furnace:          { name: 'Furnace' },
  // ── Advanced Towers ──────────────────────────────────────────
  laser_tower:      { name: 'Laser Tower' },
  cannon_tower:     { name: 'Cannon Tower' },
  // ── Rarity Labels ────────────────────────────────────────────
  rarity: {
    common:    'Common',
    uncommon:  'Uncommon',
    rare:      'Rare',
    epic:      'Epic',
    legendary: 'Legendary',
  },
}
export default item
