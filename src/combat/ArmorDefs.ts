// src/combat/ArmorDefs.ts — 防具定義

import { t } from '@/core/i18n'

export interface ArmorDef {
  itemId:  string
  name:    string
  defPct:  number   // 傷害減免 0.0~1.0
  icon:    string
}

export const ARMOR_DEFS: Record<string, ArmorDef> = {
  leather_armor: { itemId: 'leather_armor', name: '皮甲',   defPct: 0.10, icon: '🥾' },
  iron_armor:    { itemId: 'iron_armor',    name: '鐵甲',   defPct: 0.18, icon: '⚔️' },
  gold_armor:    { itemId: 'gold_armor',    name: '黃金甲', defPct: 0.25, icon: '👑' },
  crystal_armor: { itemId: 'crystal_armor', name: '晶體甲', defPct: 0.35, icon: '💎' },
  shield:        { itemId: 'shield',        name: '盾牌',   defPct: 0.08, icon: '🛡️' },
}

export function getArmorDef(itemId: string | undefined): ArmorDef | null {
  if (!itemId) return null
  return ARMOR_DEFS[itemId] ?? null
}

/** 取得防具的本地化名稱，name 欄位作為 fallback */
export function getArmorName(itemId: string): string {
  const def = ARMOR_DEFS[itemId]
  return t(`armor.${itemId}.name`, undefined, def?.name ?? itemId)
}
