// 寶箱掉落配置 — 機率表
// 結構：{ 等級: { 機率%, 掉落物陣列 } }

import { t } from '@/core/i18n'

export type LootRarity = 'common' | 'rare' | 'epic'

export interface LootTableEntry {
  itemId: string
  amountMin: number
  amountMax: number
}

export interface TreasureChestConfig {
  common: {
    chance: number  // 機率百分比
    loot: LootTableEntry[]
  }
  rare: {
    chance: number
    loot: LootTableEntry[]
  }
  epic: {
    chance: number
    loot: LootTableEntry[]
  }
}

/**
 * 寶箱掉落配置
 * 機率合計應該 = 100%
 */
export const TREASURE_CHEST_CONFIG: TreasureChestConfig = {
  // ── 普通（70%）─────────────────────────────────
  common: {
    chance: 70,
    loot: [
      { itemId: 'wood',    amountMin: 2, amountMax: 5 },
      { itemId: 'stone',   amountMin: 1, amountMax: 3 },
      { itemId: 'iron',    amountMin: 0, amountMax: 1 },
    ],
  },

  // ── 稀有（25%）─────────────────────────────────
  rare: {
    chance: 25,
    loot: [
      { itemId: 'iron',    amountMin: 1, amountMax: 2 },
      { itemId: 'gold',    amountMin: 1, amountMax: 1 },
      { itemId: 'crystal', amountMin: 0, amountMax: 1 },
    ],
  },

  // ── 最高級（5%）───────────────────────────────
  epic: {
    chance: 5,
    loot: [
      { itemId: 'blueprint', amountMin: 1, amountMax: 1 },  // 設計圖
      { itemId: 'gold_ingot', amountMin: 1, amountMax: 2 },
      { itemId: 'crystal',   amountMin: 1, amountMax: 2 },
    ],
  },
}

// ── 工具函數 ────────────────────────────────────

/**
 * 根據機率選擇掉落等級
 * @returns 'common' | 'rare' | 'epic'
 */
export function rollLootRarity(): LootRarity {
  const roll = Math.random() * 100
  if (roll < TREASURE_CHEST_CONFIG.common.chance) return 'common'
  if (roll < TREASURE_CHEST_CONFIG.common.chance + TREASURE_CHEST_CONFIG.rare.chance) return 'rare'
  return 'epic'
}

/**
 * 根據掉落等級取得掉落表
 */
export function getLootTable(rarity: LootRarity): LootTableEntry[] {
  return TREASURE_CHEST_CONFIG[rarity].loot
}

/**
 * 取得稀有度的本地化顯示名稱
 * @param rarity 稀有度等級
 * @param fallback 找不到翻譯時的備援字串（預設使用英文 key）
 * @returns 本地化字串，例如「普通」、「稀有」、「史詩」
 */
export function getRarityLabel(rarity: LootRarity, fallback?: string): string {
  return t(`treasure.rarity.${rarity}`, undefined, fallback ?? rarity)
}

/**
 * 取得寶箱類型的本地化顯示名稱
 * @param rarity 稀有度等級
 * @returns 本地化字串，例如「普通寶箱」、「稀有寶箱」、「史詩寶箱」
 */
export function getChestLabel(rarity: LootRarity): string {
  return t(`treasure.chest.${rarity}`, undefined, `${rarity} Chest`)
}

/**
 * 生成掉落物品陣列
 * @returns 掉落的 { itemId, amount } 陣列
 */
export function generateLoot(rarity: LootRarity): Array<{ itemId: string; amount: number }> {
  const lootTable = getLootTable(rarity)
  const result: Array<{ itemId: string; amount: number }> = []

  for (const entry of lootTable) {
    const amount = Math.floor(Math.random() * (entry.amountMax - entry.amountMin + 1)) + entry.amountMin
    if (amount > 0) {
      result.push({ itemId: entry.itemId, amount })
    }
  }

  return result
}
