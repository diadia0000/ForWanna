---
name: combat-weapon-defs
description: 重建 WEAPON_DEFS 武器資料表（傷害/資源傷害/範圍/冷卻/攻擊弧度）與 getWeaponDef/getWeaponName 查詢函式時查這裡。
---

# combat/WeaponDefs.ts

> 模組：combat｜角色：武器戰鬥屬性的唯一資料來源（source of truth）。crafting UI 為避免循環相依會自己留一份本地副本——combat 不被 @/inventory import。

## 公開 API

- `interface WeaponDef`
- `WEAPON_DEFS: Record<string, WeaponDef>` — 13 把武器
- `FIST_DEF = WEAPON_DEFS.fist` — 徒手 fallback
- `getWeaponDef(itemId: string | undefined): WeaponDef` — 找不到回傳 FIST_DEF
- `getWeaponName(itemId: string): string` — `t(\`weapon.${itemId}.name\`, undefined, def?.name ?? itemId)`

## 核心邏輯

### 介面 + 完整資料表

`resDmg` 是對資源節點（樹/礦）的傷害，鎬斧高；`arc` 是以面向方向為中心的攻擊弧度（度），laser_orb/whirlwind_hammer 為 360 全方位。

```typescript
export interface WeaponDef {
  itemId: string; name: string
  damage: number    // 對怪物傷害
  resDmg: number    // 對資源節點傷害
  range: number     // 攻擊範圍（格數）
  cooldown: number  // 冷卻（ms）
  arc: number       // 攻擊弧度（度）
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  // 徒手
  fist:             { itemId: 'fist',             name: '徒手',   damage: 1,  resDmg: 0.5, range: 1,  cooldown: 800,  arc: 180 },
  // 石系
  stone_sword:      { itemId: 'stone_sword',      name: '石劍',   damage: 2,  resDmg: 0.5, range: 1,  cooldown: 600,  arc: 180 },
  pickaxe:          { itemId: 'pickaxe',          name: '石鎬',   damage: 1,  resDmg: 3,   range: 1,  cooldown: 800,  arc: 90  },
  axe:              { itemId: 'axe',              name: '斧頭',   damage: 1,  resDmg: 2,   range: 1,  cooldown: 700,  arc: 90  },
  // 鐵系
  iron_sword:       { itemId: 'iron_sword',       name: '鐵劍',   damage: 4,  resDmg: 0.5, range: 2,  cooldown: 500,  arc: 180 },
  iron_pick:        { itemId: 'iron_pick',        name: '鐵鎬',   damage: 2,  resDmg: 5,   range: 2,  cooldown: 600,  arc: 90  },
  // 金系
  gold_sword:       { itemId: 'gold_sword',       name: '金劍',   damage: 8,  resDmg: 0.5, range: 3,  cooldown: 400,  arc: 220 },
  // 後期
  magic_sword:      { itemId: 'magic_sword',      name: '魔法劍', damage: 80, resDmg: 0.5, range: 3,  cooldown: 500,  arc: 200 },
  mithril_sword:    { itemId: 'mithril_sword',    name: '秘銀劍', damage: 25, resDmg: 0.5, range: 3,  cooldown: 400,  arc: 220 },
  laser_orb:        { itemId: 'laser_orb',        name: '魔法泡泡', damage: 5,  resDmg: 10,  range: 3,  cooldown: 250,  arc: 360 },
  // 設計圖解鎖
  laser_gun:        { itemId: 'laser_gun',        name: '雷射槍', damage: 3,  resDmg: 3,   range: 10, cooldown: 333,  arc: 30  },
  whirlwind_hammer: { itemId: 'whirlwind_hammer', name: '旋風槌', damage: 30, resDmg: 8,   range: 2,  cooldown: 1500, arc: 360 },
}

export const FIST_DEF = WEAPON_DEFS.fist

export function getWeaponDef(itemId: string | undefined): WeaponDef {
  if (!itemId) return FIST_DEF
  return WEAPON_DEFS[itemId] ?? FIST_DEF
}

export function getWeaponName(itemId: string): string {
  const def = WEAPON_DEFS[itemId]
  return t(`weapon.${itemId}.name`, undefined, def?.name ?? itemId)
}
```

## EventBus 互動

- 無。純資料 + 查詢函式。

## 依賴

- `@/core/i18n` 的 `t` — 武器名稱本地化（name 欄位作 fallback）

## 重建提示

- 這是武器屬性的「唯一真相」；inventory/crafting 端有獨立副本，**不可**設計成被 `@/inventory` import（會循環相依）。
- `getWeaponDef` 永遠不回 null：未知 itemId 與 undefined 都退回 `FIST_DEF`。
- `laser_orb`（魔法泡泡）arc 360 + range 3，設計是自動採集周圍 3 格；`laser_gun` range 10 但 arc 只有 30（窄遠程）。
- `magic_sword` damage 80 是全表最高，注意別與 mithril(25) 搞反。
- 數值精確度要緊：cooldown 全為整數 ms，resDmg 有 0.5 的小數。
