// Agent 6 負責 — src/inventory/data/items.ts
import type { ItemDef } from '@/types'
import { t } from '@/core/i18n'

export const ITEMS: Record<string, ItemDef> = {
  // ── 原料 ─────────────────────────────────────────────────────
  wood:        { id: 'wood',        name: '木材',   icon: '🪵', maxStack: 999, sellPrice: 0.5  },
  stone:       { id: 'stone',       name: '石頭',   icon: '🪨', maxStack: 999, sellPrice: 0.5  },
  iron:        { id: 'iron',        name: '鐵礦',   icon: '⬛', maxStack: 999, sellPrice: 2  },
  gold:        { id: 'gold',        name: '金礦',   icon: '🟨', maxStack: 999, sellPrice: 5  },
  crystal:     { id: 'crystal',     name: '水晶',   icon: '💎', maxStack: 99,  sellPrice: 20 },
  bone:        { id: 'bone',        name: '骨頭',   icon: '🦴', maxStack: 99,  sellPrice: 1  },
  // ── 加工品 ───────────────────────────────────────────────────
  plank:       { id: 'plank',       name: '木板',   icon: '🪵', maxStack: 999, sellPrice: 1  },
  ingot:       { id: 'ingot',       name: '鐵錠',   icon: '🔩', maxStack: 99,  sellPrice: 8  },
  gold_ingot:  { id: 'gold_ingot',  name: '金錠',   icon: '🏅', maxStack: 99,  sellPrice: 25 },
  // ── 工具 ─────────────────────────────────────────────────────
  pickaxe:     { id: 'pickaxe',     name: '石鎬',   icon: '⛏️', maxStack: 1,   sellPrice: 15 },
  iron_pick:   { id: 'iron_pick',   name: '鐵鎬',   icon: '⛏️', maxStack: 1,   sellPrice: 50 },
  axe:         { id: 'axe',         name: '斧頭',   icon: '🪓', maxStack: 1,   sellPrice: 12 },
  // ── 武器 ─────────────────────────────────────────────────────
  stone_sword: { id: 'stone_sword', name: '石劍',   icon: '🗡️', maxStack: 1,   sellPrice: 20 },
  iron_sword:  { id: 'iron_sword',  name: '鐵劍',   icon: '⚔️', maxStack: 1,   sellPrice: 60 },
  gold_sword:  { id: 'gold_sword',  name: '金劍',   icon: '✨', maxStack: 1,   sellPrice: 150 },
  magic_sword: { id: 'magic_sword', name: '魔法劍', icon: '🌟', maxStack: 1,   sellPrice: 400 },
  mithril_sword: { id: 'mithril_sword', name: '秘銀劍', icon: '⚡', maxStack: 1, sellPrice: 800 },
  // ── 弓箭 ──────────────────────────────────────────────────────
  wood_bow:    { id: 'wood_bow',    name: '木弓',   icon: '🏹', maxStack: 1,   sellPrice: 30 },
  iron_bow:    { id: 'iron_bow',    name: '鐵弓',   icon: '🏹', maxStack: 1,   sellPrice: 80 },
  magic_bow:   { id: 'magic_bow',   name: '魔法弓', icon: '✨', maxStack: 1,   sellPrice: 300 },
  arrow:       { id: 'arrow',       name: '箭矢',   icon: '→', maxStack: 999, sellPrice: 0.1 },
  fire_arrow:  { id: 'fire_arrow',  name: '火箭',   icon: '→🔥', maxStack: 999, sellPrice: 0.3 },
  ice_arrow:   { id: 'ice_arrow',   name: '冰箭',   icon: '→❄️', maxStack: 999, sellPrice: 0.3 },
  // ── 食物 ───────────────────────────────────────────────────────
  berry:       { id: 'berry',       name: '漿果',   icon: '🍓', maxStack: 99, sellPrice: 1 },
  tomato:      { id: 'tomato',      name: '番茄',   icon: 'T', maxStack: 99, sellPrice: 1 },
  purple_grape:{ id: 'purple_grape',name: '紫色葡萄', icon: 'G', maxStack: 99, sellPrice: 1 },
  onion:       { id: 'onion',       name: '洋蔥',   icon: 'O', maxStack: 99, sellPrice: 1 },
  carrot:      { id: 'carrot',      name: '蘿蔔',   icon: 'C', maxStack: 99, sellPrice: 1 },
  pumpkin:     { id: 'pumpkin',     name: '南瓜',   icon: 'P', maxStack: 99, sellPrice: 1 },
  watermelon:  { id: 'watermelon',  name: '西瓜',   icon: 'W', maxStack: 99, sellPrice: 1 },
  bread:       { id: 'bread',       name: '麵包',   icon: '🍞', maxStack: 99, sellPrice: 5 },
  meat:        { id: 'meat',        name: '肉類',   icon: '🥩', maxStack: 99, sellPrice: 10 },
  cooked_meat: { id: 'cooked_meat', name: '烤肉',   icon: '🍖', maxStack: 99, sellPrice: 20 },
  gourmet:     { id: 'gourmet',     name: '下午茶套餐', icon: '🍲', maxStack: 99, sellPrice: 50 },
  // ── 防具 ───────────────────────────────────────────────────────
  leather_armor: { id: 'leather_armor', name: '皮甲', icon: '🥾', maxStack: 1, sellPrice: 40 },
  iron_armor:    { id: 'iron_armor',    name: '鐵甲', icon: '⚔️', maxStack: 1, sellPrice: 100 },
  gold_armor:    { id: 'gold_armor',    name: '黃金甲', icon: '👑', maxStack: 1, sellPrice: 250 },
  crystal_armor: { id: 'crystal_armor', name: '晶體甲', icon: '💎', maxStack: 1, sellPrice: 600 },
  shield:        { id: 'shield',        name: '盾牌', icon: '🛡️', maxStack: 1, sellPrice: 60 },
  // ── 陷阱 ───────────────────────────────────────────────────────
  spike_trap:  { id: 'spike_trap',  name: '刺製陷阱', icon: '🔪', maxStack: 99, sellPrice: 10 },
  fire_trap:   { id: 'fire_trap',   name: '火焰陷阱', icon: '🔥', maxStack: 99, sellPrice: 15 },
  ice_trap:    { id: 'ice_trap',    name: '冰凍陷阱', icon: '❄️', maxStack: 99, sellPrice: 25 },
  // ── 資源 ───────────────────────────────────────────────────────
  leather:     { id: 'leather',     name: '皮革',   icon: '🧥', maxStack: 99, sellPrice: 5 },
  feather:     { id: 'feather',     name: '羽毛',   icon: '🪶', maxStack: 99, sellPrice: 3 },
  spice:       { id: 'spice',       name: '香料',   icon: '🌶️', maxStack: 99, sellPrice: 8 },
  seasoning:   { id: 'seasoning',   name: '調味料', icon: '🧂', maxStack: 99, sellPrice: 4 },
  fire_essence: { id: 'fire_essence', name: '火焰精華', icon: '🔥', maxStack: 99, sellPrice: 50 },
  ice_essence:  { id: 'ice_essence',  name: '冰凍精華', icon: '❄️', maxStack: 99, sellPrice: 50 },
  ancient_crystal: { id: 'ancient_crystal', name: '遠古結晶', icon: '✨', maxStack: 10, sellPrice: 500 },
  // ── 後期裝備 ──────────────────────────────────────────────────
  laser_orb:   { id: 'laser_orb',  name: '魔法球', icon: '🔮', maxStack: 1,  sellPrice: 600 },
  // ── 設計圖（遺跡掉落，目前無配方用途，保留備用） ──────────────
  blueprint:   { id: 'blueprint',   name: '設計圖',         icon: '📜', maxStack: 10, sellPrice: 50 },
  // ── 設計圖（分級，解鎖進階武器/建築，遺跡或 Boss 掉落） ───────
  blueprint_1: { id: 'blueprint_1', name: '設計圖I（雷射槍）',  icon: '📘', maxStack: 3, sellPrice: 10000 },
  blueprint_2: { id: 'blueprint_2', name: '設計圖II（雷射塔）', icon: '📗', maxStack: 3, sellPrice: 10000 },
  blueprint_3: { id: 'blueprint_3', name: '設計圖III（加農砲）',icon: '📙', maxStack: 3, sellPrice: 10000 },
  blueprint_4: { id: 'blueprint_4', name: '設計圖IV（手榴彈）', icon: '📕', maxStack: 3, sellPrice: 10000 },
  blueprint_5: { id: 'blueprint_5', name: '設計圖V（旋風槌）',  icon: '📓', maxStack: 3, sellPrice: 10000 },
  dungeon_map:   { id: 'dungeon_map',   name: '遺跡地圖',   icon: '🗺️', maxStack: 9, sellPrice: 0 },
  // ── 進階武器（需設計圖解鎖） ──────────────────────────────────
  laser_gun:        { id: 'laser_gun',        name: '雷射槍', icon: '🔵', maxStack: 1, sellPrice: 1000  },
  whirlwind_hammer: { id: 'whirlwind_hammer', name: '旋風槌', icon: '🔨', maxStack: 1, sellPrice: 1500  },
  // ── 消耗品武器 ─────────────────────────────────────────────────
  grenade:     { id: 'grenade',     name: '手榴彈', icon: '💣', maxStack: 99, sellPrice: 30 },
  // ── 背包（皮革製作，可存放物品） ───────────────────────────────
  bag_small: { id: 'bag_small', name: '小背包', icon: '🎒', maxStack: 1, sellPrice: 100 },
  bag_large: { id: 'bag_large', name: '大背包', icon: '🧳', maxStack: 1, sellPrice: 500 },
  // ── 道具 ─────────────────────────────────────────────────────
  flashlight: { id: 'flashlight', name: '手電筒', icon: '🔦', maxStack: 1, sellPrice: 80 },
  bed:        { id: 'bed',        name: '床',     icon: '🛏️', maxStack: 1, sellPrice: 30 },
  // ── 建築材料（不可製作，只生成於地圖） ──────────────────────
  furnace:      { id: 'furnace',      name: '熔爐',   icon: '🔥', maxStack: 1, sellPrice: 40 },
  // ── 進階防禦塔（配方製作後放置） ────────────────────────────
  laser_tower:  { id: 'laser_tower',  name: '雷射塔', icon: '🔭', maxStack: 1, sellPrice: 0 },
  cannon_tower: { id: 'cannon_tower', name: '加農砲', icon: '💣', maxStack: 1, sellPrice: 0 },
}

// ── 品級/稀有度系統 ──────────────────────────────────────────────────────────

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const ITEM_RARITY: Record<string, ItemRarity> = {
  // Common
  wood: 'common', stone: 'common', iron: 'common', bone: 'common',
  feather: 'common', arrow: 'common', plank: 'common', berry: 'common',
  tomato: 'common', purple_grape: 'common', onion: 'common',
  carrot: 'common', pumpkin: 'common', watermelon: 'common', bread: 'common',
  // Uncommon
  gold: 'uncommon', leather: 'uncommon', meat: 'uncommon', cooked_meat: 'uncommon',
  ingot: 'uncommon', fire_arrow: 'uncommon', ice_arrow: 'uncommon',
  spice: 'uncommon', seasoning: 'uncommon', axe: 'uncommon', pickaxe: 'uncommon',
  stone_sword: 'uncommon', wood_bow: 'uncommon', grenade: 'uncommon',
  // Rare
  crystal: 'rare', gold_ingot: 'rare', gourmet: 'rare', iron_sword: 'rare',
  iron_bow: 'rare', iron_pick: 'rare', leather_armor: 'rare', iron_armor: 'rare',
  shield: 'rare', spike_trap: 'rare', fire_trap: 'rare', ice_trap: 'rare',
  fire_essence: 'rare', ice_essence: 'rare', bag_small: 'rare',
  flashlight: 'rare', bed: 'rare', blueprint: 'rare',
  // Epic
  gold_sword: 'epic', gold_armor: 'epic', magic_bow: 'epic', magic_sword: 'epic',
  crystal_armor: 'epic', laser_orb: 'epic', bag_large: 'epic',
  blueprint_1: 'epic', blueprint_2: 'epic', blueprint_3: 'epic',
  blueprint_4: 'epic', blueprint_5: 'epic',
  dungeon_map:  'epic',
  laser_gun: 'epic', whirlwind_hammer: 'epic',
  // Legendary
  mithril_sword: 'legendary', ancient_crystal: 'legendary',
}

function rarityEntry(
  key: string, fallback: string, color: string, priceMult: number,
): { label: string; color: string; priceMult: number } {
  return Object.defineProperty({ color, priceMult }, 'label', {
    get() { return t(key, undefined, fallback) },
    enumerable: true,
    configurable: true,
  }) as { label: string; color: string; priceMult: number }
}

export const RARITY_CONFIG: Record<ItemRarity, { label: string; color: string; priceMult: number }> = {
  common:    rarityEntry('item.rarity.common',    '普通', '#aaaaaa', 1.0),
  uncommon:  rarityEntry('item.rarity.uncommon',  '優良', '#4dcc4d', 1.5),
  rare:      rarityEntry('item.rarity.rare',      '稀有', '#4d9fff', 2.5),
  epic:      rarityEntry('item.rarity.epic',      '史詩', '#b04dff', 5.0),
  legendary: rarityEntry('item.rarity.legendary', '傳說', '#ff9900', 10.0),
}
