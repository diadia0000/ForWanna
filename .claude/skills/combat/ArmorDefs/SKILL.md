---
name: combat-armor-defs
description: 重建 ARMOR_DEFS 防具資料表（傷害減免百分比 defPct、icon）與 getArmorDef/getArmorName 查詢函式時查這裡。
---

# combat/ArmorDefs.ts

> 模組：combat｜角色：防具減傷屬性的資料來源。純資料 + 查詢函式，無狀態。

## 公開 API

- `interface ArmorDef`
- `ARMOR_DEFS: Record<string, ArmorDef>` — 5 種防具
- `getArmorDef(itemId: string | undefined): ArmorDef | null` — 找不到回傳 **null**（與 WeaponDefs 退回 fist 不同）
- `getArmorName(itemId: string): string` — `t(\`armor.${itemId}.name\`, undefined, def?.name ?? itemId)`

## 核心邏輯

### 介面 + 完整資料表

`defPct` 是 0.0~1.0 的傷害減免比例。

```typescript
export interface ArmorDef {
  itemId: string; name: string
  defPct: number   // 傷害減免 0.0~1.0
  icon: string
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

export function getArmorName(itemId: string): string {
  const def = ARMOR_DEFS[itemId]
  return t(`armor.${itemId}.name`, undefined, def?.name ?? itemId)
}
```

## EventBus 互動

- 無。

## 依賴

- `@/core/i18n` 的 `t` — 防具名稱本地化

## 重建提示

- `getArmorDef` 回傳 **null**（不像 `getWeaponDef` 退回 fist），呼叫端必須處理「無防具」分支。
- defPct 階梯：shield 0.08 < leather 0.10 < iron 0.18 < gold 0.25 < crystal 0.35。盾牌最低、晶體甲最高。
- icon 是 emoji 字串，重建時保留實際表情符號。
- `getArmorName` fallback 鏈：i18n key → def.name → itemId 原字串。
