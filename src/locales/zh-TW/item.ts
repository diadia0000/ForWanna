const item: Record<string, any> = {
  // ── 原料 ──────────────────────────────────────────────────────
  wood:             { name: '木材' },
  stone:            { name: '石頭' },
  iron:             { name: '鐵礦' },
  gold:             { name: '金礦' },
  crystal:          { name: '水晶' },
  bone:             { name: '骨頭' },
  // ── 加工品 ────────────────────────────────────────────────────
  plank:            { name: '木板' },
  ingot:            { name: '鐵錠' },
  gold_ingot:       { name: '金錠' },
  // ── 工具 ──────────────────────────────────────────────────────
  pickaxe:          { name: '石鎬' },
  iron_pick:        { name: '鐵鎬' },
  axe:              { name: '斧頭' },
  // ── 武器 ──────────────────────────────────────────────────────
  stone_sword:      { name: '石劍' },
  iron_sword:       { name: '鐵劍' },
  gold_sword:       { name: '金劍' },
  magic_sword:      { name: '魔法劍' },
  mithril_sword:    { name: '秘銀劍' },
  // ── 弓箭 ──────────────────────────────────────────────────────
  wood_bow:         { name: '木弓' },
  iron_bow:         { name: '鐵弓' },
  magic_bow:        { name: '魔法弓' },
  arrow:            { name: '箭矢' },
  fire_arrow:       { name: '火箭' },
  ice_arrow:        { name: '冰箭' },
  // ── 食物 ──────────────────────────────────────────────────────
  berry:            { name: '漿果' },
  tomato:           { name: '番茄' },
  purple_grape:     { name: '紫色葡萄' },
  onion:            { name: '洋蔥' },
  carrot:           { name: '蘿蔔' },
  pumpkin:          { name: '南瓜' },
  watermelon:       { name: '西瓜' },
  bread:            { name: '麵包' },
  meat:             { name: '肉類' },
  cooked_meat:      { name: '烤肉' },
  gourmet:          { name: '下午茶套餐' },
  // ── 防具 ──────────────────────────────────────────────────────
  leather_armor:    { name: '皮甲' },
  iron_armor:       { name: '鐵甲' },
  gold_armor:       { name: '黃金甲' },
  crystal_armor:    { name: '晶體甲' },
  shield:           { name: '盾牌' },
  // ── 陷阱 ──────────────────────────────────────────────────────
  spike_trap:       { name: '刺製陷阱' },
  fire_trap:        { name: '火焰陷阱' },
  ice_trap:         { name: '冰凍陷阱' },
  // ── 資源 ──────────────────────────────────────────────────────
  leather:          { name: '皮革' },
  feather:          { name: '羽毛' },
  spice:            { name: '香料' },
  seasoning:        { name: '調味料' },
  fire_essence:     { name: '火焰精華' },
  ice_essence:      { name: '冰凍精華' },
  ancient_crystal:  { name: '遠古結晶' },
  // ── 後期裝備 ────────────────────────────────────────────────
  laser_orb:        { name: '魔法球' },
  // ── 設計圖 ──────────────────────────────────────────────────
  blueprint:        { name: '設計圖' },
  blueprint_1:      { name: '設計圖I（雷射槍）' },
  blueprint_2:      { name: '設計圖II（雷射塔）' },
  blueprint_3:      { name: '設計圖III（加農砲）' },
  blueprint_4:      { name: '設計圖IV（手榴彈）' },
  blueprint_5:      { name: '設計圖V（旋風槌）' },
  dungeon_map:      { name: '遺跡地圖' },
  // ── 進階武器 ────────────────────────────────────────────────
  laser_gun:        { name: '雷射槍' },
  whirlwind_hammer: { name: '旋風槌' },
  // ── 消耗品武器 ──────────────────────────────────────────────
  grenade:          { name: '手榴彈' },
  // ── 背包 ────────────────────────────────────────────────────
  bag_small:        { name: '小背包' },
  bag_large:        { name: '大背包' },
  // ── 道具 ────────────────────────────────────────────────────
  flashlight:       { name: '手電筒' },
  bed:              { name: '床' },
  // ── 建築材料 ────────────────────────────────────────────────
  furnace:          { name: '熔爐' },
  // ── 進階防禦塔 ──────────────────────────────────────────────
  laser_tower:      { name: '雷射塔' },
  cannon_tower:     { name: '加農砲' },
  // ── 品級標籤 ────────────────────────────────────────────────
  rarity: {
    common:    '普通',
    uncommon:  '優良',
    rare:      '稀有',
    epic:      '史詩',
    legendary: '傳說',
  },
}
export default item
