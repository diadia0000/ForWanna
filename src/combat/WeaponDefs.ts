// src/combat/WeaponDefs.ts
// 武器定義：每種可裝備物品的戰鬥屬性

import { t } from '@/core/i18n'

export interface WeaponDef {
  itemId:    string
  name:      string
  damage:    number    // 對怪物傷害
  resDmg:    number    // 對資源節點傷害（鎬子高）
  range:     number    // 攻擊範圍（格數）
  cooldown:  number    // 攻擊冷卻（毫秒）
  arc:       number    // 攻擊弧度（度，以面向方向為中心）
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  // ── 徒手 ────────────────────────────────────────────────
  // tree 5hp ÷ 0.5 = 10 hits @1/s = 10s；rock 8hp ÷ 0.25 = 32 hits（只能採莓果）
  fist: {
    itemId: 'fist', name: '徒手',
    damage: 1, resDmg: 0.5, range: 1, cooldown: 800, arc: 180,
  },
  // ── 石系 ────────────────────────────────────────────────
  stone_sword: {
    itemId: 'stone_sword', name: '石劍',
    damage: 2, resDmg: 0.5, range: 1, cooldown: 600, arc: 180,
  },
  // 石鎬：挖礦 5 hits @rock, 4 hits @iron, 5 hits @gold 等
  pickaxe: {
    itemId: 'pickaxe', name: '石鎬',
    damage: 1, resDmg: 3, range: 1, cooldown: 800, arc: 90,
  },
  // 斧頭：砍樹 3 hits （tree 5÷2=3），採石很慢（8÷2=4 hits）
  axe: {
    itemId: 'axe', name: '斧頭',
    damage: 1, resDmg: 2, range: 1, cooldown: 700, arc: 90,
  },
  // ── 鐵系 ────────────────────────────────────────────────
  iron_sword: {
    itemId: 'iron_sword', name: '鐵劍',
    damage: 4, resDmg: 0.5, range: 2, cooldown: 500, arc: 180,
  },
  // 鐵鎬：鐵礦 2 hits（10÷5），晶體 4 hits（20÷5）快了一倍
  iron_pick: {
    itemId: 'iron_pick', name: '鐵鎬',
    damage: 2, resDmg: 5, range: 2, cooldown: 600, arc: 90,
  },
  // ── 金系 ────────────────────────────────────────────────
  gold_sword: {
    itemId: 'gold_sword', name: '金劍',
    damage: 8, resDmg: 0.5, range: 3, cooldown: 400, arc: 220,
  },
  // ── 後期 ────────────────────────────────────────────────
  // 魔法泡泡：裝備後自動採集周圍 3 格內的資源，無需手動操作
  magic_sword: {
    itemId: 'magic_sword', name: '魔法劍',
    damage: 80, resDmg: 0.5, range: 3, cooldown: 500, arc: 200,
  },
  mithril_sword: {
    itemId: 'mithril_sword', name: '秘銀劍',
    damage: 25, resDmg: 0.5, range: 3, cooldown: 400, arc: 220,
  },
  laser_orb: {
    itemId: 'laser_orb', name: '魔法泡泡',
    damage: 5, resDmg: 10, range: 3, cooldown: 250, arc: 360,
  },
  // ── 設計圖解鎖武器 ─────────────────────────────────────
  laser_gun: {
    itemId: 'laser_gun', name: '雷射槍',
    damage: 3, resDmg: 3, range: 10, cooldown: 333, arc: 30,
  },
  whirlwind_hammer: {
    itemId: 'whirlwind_hammer', name: '旋風槌',
    damage: 30, resDmg: 8, range: 2, cooldown: 1500, arc: 360,
  },
}

export const FIST_DEF = WEAPON_DEFS.fist

/** 依物品 ID 取得武器定義，沒有配對時回傳徒手 */
export function getWeaponDef(itemId: string | undefined): WeaponDef {
  if (!itemId) return FIST_DEF
  return WEAPON_DEFS[itemId] ?? FIST_DEF
}

/** 取得武器的本地化名稱，name 欄位作為 fallback */
export function getWeaponName(itemId: string): string {
  const def = WEAPON_DEFS[itemId]
  return t(`weapon.${itemId}.name`, undefined, def?.name ?? itemId)
}
