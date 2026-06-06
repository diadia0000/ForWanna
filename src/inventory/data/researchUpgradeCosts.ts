// src/inventory/data/researchUpgradeCosts.ts — 研究所升級成本配置表

import type { ItemId } from '@/types'
import { t } from '@/core/i18n'

export interface ResearchUpgradeCost {
  level: number           // 升級到此等級
  materials: Array<{ itemId: ItemId; amount: number }>
  gold: number
  durationSecs: number    // 升級需時（秒）
  unlocksDescription: string
}

/** 用 getter 讓 unlocksDescription 在讀取時才呼叫 t()，避免模組載入時 i18n 尚未初始化 */
function makeEntry(
  base: Omit<ResearchUpgradeCost, 'unlocksDescription'>,
  key: string,
  fallback: string,
): ResearchUpgradeCost {
  return Object.defineProperty({ ...base }, 'unlocksDescription', {
    get() { return t(key, undefined, fallback) },
    enumerable: true,
    configurable: true,
  }) as ResearchUpgradeCost
}

export const RESEARCH_UPGRADE_COSTS: ResearchUpgradeCost[] = [
  // Lv 1 → Lv 2
  makeEntry(
    { level: 2, materials: [{ itemId: 'stone', amount: 20 }], gold: 500, durationSecs: 5 },
    'research.lv2.unlocks', '市場 + 食物配方',
  ),
  // Lv 2 → Lv 3
  makeEntry(
    { level: 3, materials: [{ itemId: 'ingot', amount: 5 }], gold: 1000, durationSecs: 10 },
    'research.lv3.unlocks', '工具升級配方',
  ),
  // Lv 3 → Lv 4
  makeEntry(
    { level: 4, materials: [{ itemId: 'gold_ingot', amount: 10 }], gold: 3000, durationSecs: 20 },
    'research.lv4.unlocks', '武器配方 + 弓箭',
  ),
  // Lv 4 → Lv 5
  makeEntry(
    { level: 5, materials: [{ itemId: 'crystal', amount: 5 }], gold: 5000, durationSecs: 30 },
    'research.lv5.unlocks', '防具配方',
  ),
  // Lv 5 → Lv 6
  makeEntry(
    { level: 6, materials: [{ itemId: 'crystal', amount: 10 }, { itemId: 'blueprint_1', amount: 1 }], gold: 10000, durationSecs: 60 },
    'research.lv6.unlocks', '防禦陷阱配方',
  ),
  // Lv 6 → Lv 7
  makeEntry(
    { level: 7, materials: [{ itemId: 'crystal', amount: 20 }, { itemId: 'blueprint_2', amount: 1 }], gold: 20000, durationSecs: 120 },
    'research.lv7.unlocks', '守城兵器升級',
  ),
  // Lv 7 → Lv 8
  makeEntry(
    { level: 8, materials: [{ itemId: 'crystal', amount: 50 }, { itemId: 'blueprint_3', amount: 1 }], gold: 50000, durationSecs: 180 },
    'research.lv8.unlocks', '進階魔法配方',
  ),
  // Lv 8 → Lv 9
  makeEntry(
    { level: 9, materials: [{ itemId: 'ancient_crystal', amount: 5 }], gold: 100000, durationSecs: 300 },
    'research.lv9.unlocks', '終極裝備配方',
  ),
  // Lv 9 → Lv 10
  makeEntry(
    { level: 10, materials: [{ itemId: 'ancient_crystal', amount: 10 }, { itemId: 'blueprint_5', amount: 1 }], gold: 200000, durationSecs: 600 },
    'research.lv10.unlocks', '傳說級配方',
  ),
]

export function getResearchUpgradeCost(toLevel: number): ResearchUpgradeCost | undefined {
  return RESEARCH_UPGRADE_COSTS.find(c => c.level === toLevel)
}
