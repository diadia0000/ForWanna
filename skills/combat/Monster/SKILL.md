---
name: combat-monster
description: 重建 MonsterEntity（怪物實體、MONSTER_STATS 屬性表、PixiJS sprite/HP bar、受擊與攻擊動畫、狀態機旗標、狀態效果欄位）時查這裡。
---

# combat/Monster.ts

> 模組：combat｜角色：單一怪物的資料 + 視覺實體（PixiJS Container）。持有 AI 狀態旗標但「不執行」AI 決策（決策在 MonsterSpawner._ai），自身只負責屬性、移動、繪製、動畫、受傷。

## 公開 API

- `class MonsterEntity` — 一隻怪物的實體
  - `constructor(id: string, type: MonsterType, x: number, y: number)` — 從 `MONSTER_STATS[type]` 初始化屬性 + 建 fallback sprite + 非同步載 manifest sprite
  - `takeDamage(dmg: number): void` — 扣血（夾在 0）+ 播 HIT 動畫 + 刷新血條
  - `attackAnim(): void` — 播攻擊動畫（driver 或 fallback 縮放彈跳）
  - `moveTo(x, y): void` — 移動 + 更新朝向（facingDir/facingLeft）+ `sprite.zIndex = y + 20`
  - `update(delta: number): void` — 每幀推進 driver 動畫（依 aiState/攻擊/受傷選播放狀態）
  - `refreshHpBar(): void` — 依血量比例顯示/隱藏血條 + 換色
  - `setVariantVisual(isElite, isBoss): void` — 設旗標 + sprite 縮放/染色
  - `destroy(): void` — 移除 ticker + 銷毀 sprite
  - getter `isAlive: boolean` (`hp > 0`)、`isAttacking: boolean`
- `MONSTER_STATS: Record<MonsterType, MonsterStats>` — 全怪物屬性表（見資料區）
- `getMonsterName(type): string` — `t(\`monster.${type}.name\`, undefined, type)`
- types：`MonsterType`（21 種）、`MonsterStats`、`AIState = 'idle'|'wander'|'chase'|'attack'`、`MonsterKind = 'wild'|'siege'`

## 核心邏輯

### MonsterStats 介面 + 完整屬性表

每隻怪物的基礎數值。掉落欄位是 0~1 的機率。`kind` 預設為 `'siege'`（注意：不是 wild）。

```typescript
export interface MonsterStats {
  type: MonsterType
  hp: number; maxHp: number; damage: number; speed: number
  detectRange: number; attackRange: number; attackCooldown: number
  goldReward: number; xpReward: number
  boneDrop: number; meatDrop: number; leatherDrop: number; featherDrop: number
}

export const MONSTER_STATS: Record<MonsterType, MonsterStats> = {
  slime:              { hp: 4,  damage: 1,  speed: 0.9,  detectRange: 4, attackRange: 1.2, attackCooldown: 1500, goldReward: 2,  xpReward: 5,  boneDrop: 0,    meatDrop: 0.30, leatherDrop: 0,    featherDrop: 0    },
  slime_blue:         { hp: 4,  damage: 1,  speed: 0.9,  detectRange: 4, attackRange: 1.2, attackCooldown: 1500, goldReward: 2,  xpReward: 5,  boneDrop: 0,    meatDrop: 0.20, leatherDrop: 0,    featherDrop: 0.15 },
  giant_slime:        { hp: 18, damage: 3,  speed: 0.75, detectRange: 5, attackRange: 1.4, attackCooldown: 1500, goldReward: 8,  xpReward: 20, boneDrop: 0,    meatDrop: 0.55, leatherDrop: 0,    featherDrop: 0    },
  giant_flame:        { hp: 26, damage: 5,  speed: 0.8,  detectRange: 6, attackRange: 1.5, attackCooldown: 1350, goldReward: 14, xpReward: 32, boneDrop: 0,    meatDrop: 0.30, leatherDrop: 0,    featherDrop: 0    },
  giant_spirit:       { hp: 24, damage: 4,  speed: 1.0,  detectRange: 7, attackRange: 1.5, attackCooldown: 1200, goldReward: 16, xpReward: 36, boneDrop: 0.20, meatDrop: 0,    leatherDrop: 0,    featherDrop: 0.30 },
  giant_frog:         { hp: 14, damage: 2,  speed: 1.35, detectRange: 5, attackRange: 1.3, attackCooldown: 1250, goldReward: 7,  xpReward: 18, boneDrop: 0,    meatDrop: 0.45, leatherDrop: 0.10, featherDrop: 0    },
  giant_frog_2:       { hp: 16, damage: 3,  speed: 1.25, detectRange: 5, attackRange: 1.3, attackCooldown: 1250, goldReward: 8,  xpReward: 20, boneDrop: 0,    meatDrop: 0.45, leatherDrop: 0.15, featherDrop: 0    },
  giant_raccoon:      { hp: 20, damage: 4,  speed: 1.25, detectRange: 6, attackRange: 1.3, attackCooldown: 1100, goldReward: 10, xpReward: 26, boneDrop: 0,    meatDrop: 0.30, leatherDrop: 0.45, featherDrop: 0    },
  giant_raccoon_gold: { hp: 28, damage: 5,  speed: 1.15, detectRange: 6, attackRange: 1.4, attackCooldown: 1050, goldReward: 22, xpReward: 42, boneDrop: 0,    meatDrop: 0.25, leatherDrop: 0.55, featherDrop: 0    },
  goblin:             { hp: 8,  damage: 2,  speed: 1.5,  detectRange: 5, attackRange: 1.2, attackCooldown: 1200, goldReward: 5,  xpReward: 10, boneDrop: 0,    meatDrop: 0.25, leatherDrop: 0.35, featherDrop: 0    },
  goblin_rogue:       { hp: 10, damage: 3,  speed: 1.8,  detectRange: 6, attackRange: 1.2, attackCooldown: 900,  goldReward: 7,  xpReward: 14, boneDrop: 0,    meatDrop: 0.20, leatherDrop: 0.45, featherDrop: 0    },
  goblin_shaman:      { hp: 12, damage: 4,  speed: 1.25, detectRange: 7, attackRange: 1.6, attackCooldown: 1450, goldReward: 9,  xpReward: 18, boneDrop: 0,    meatDrop: 0.15, leatherDrop: 0.35, featherDrop: 0.10 },
  goblin_warrior:     { hp: 18, damage: 4,  speed: 1.25, detectRange: 6, attackRange: 1.3, attackCooldown: 1100, goldReward: 10, xpReward: 22, boneDrop: 0.10, meatDrop: 0.20, leatherDrop: 0.55, featherDrop: 0    },
  skeleton:           { hp: 14, damage: 3,  speed: 1.2,  detectRange: 6, attackRange: 1.3, attackCooldown: 1000, goldReward: 10, xpReward: 18, boneDrop: 0.6,  meatDrop: 0,    leatherDrop: 0,    featherDrop: 0.25 },
  skeleton_mage:      { hp: 16, damage: 5,  speed: 1.05, detectRange: 7, attackRange: 1.6, attackCooldown: 1300, goldReward: 12, xpReward: 24, boneDrop: 0.70, meatDrop: 0,    leatherDrop: 0,    featherDrop: 0.20 },
  skeleton_rogue:     { hp: 15, damage: 4,  speed: 1.65, detectRange: 7, attackRange: 1.2, attackCooldown: 850,  goldReward: 12, xpReward: 24, boneDrop: 0.65, meatDrop: 0,    leatherDrop: 0.10, featherDrop: 0.20 },
  skeleton_warrior:   { hp: 24, damage: 5,  speed: 1.1,  detectRange: 6, attackRange: 1.4, attackCooldown: 1050, goldReward: 15, xpReward: 30, boneDrop: 0.80, meatDrop: 0,    leatherDrop: 0.10, featherDrop: 0.20 },
  tengu_blue:         { hp: 22, damage: 5,  speed: 1.55, detectRange: 8, attackRange: 1.4, attackCooldown: 950,  goldReward: 16, xpReward: 34, boneDrop: 0.10, meatDrop: 0,    leatherDrop: 0.10, featherDrop: 0.75 },
  tengu_red:          { hp: 28, damage: 6,  speed: 1.45, detectRange: 8, attackRange: 1.5, attackCooldown: 900,  goldReward: 20, xpReward: 44, boneDrop: 0.10, meatDrop: 0,    leatherDrop: 0.15, featherDrop: 0.85 },
  giant_blue_samurai: { hp: 42, damage: 8,  speed: 1.05, detectRange: 8, attackRange: 1.6, attackCooldown: 1050, goldReward: 28, xpReward: 60, boneDrop: 0.35, meatDrop: 0,    leatherDrop: 0.45, featherDrop: 0.15 },
  giant_red_samurai:  { hp: 52, damage: 10, speed: 1.0,  detectRange: 8, attackRange: 1.6, attackCooldown: 950,  goldReward: 34, xpReward: 75, boneDrop: 0.40, meatDrop: 0,    leatherDrop: 0.50, featherDrop: 0.15 },
}
// 注意：原始碼每筆都重複了 type 欄位（type: 'slime' 等），此處略去；建表時 type 應等於 key。
```

### 實例欄位（AI 旗標 + 狀態效果）

`MonsterSpawner._ai` 讀寫這些欄位；`MonsterEntity` 自己不改 aiState（除了沒被用到）。

```typescript
baseSpeed = 0            // 原始速度，狀態效果計算用
kind: MonsterKind = 'siege'
aiState: AIState = 'idle'
targetId: string | null = null
targetBuildingId: string | null = null
idleTimer = 0
wanderTarget: { x: number; y: number } | null = null
lastAttackMs = 0
facingLeft = false
isElite = false; isBoss = false
// debuffs（時間戳 ms，與 nowMs 比較）
slowUntil = 0; burnUntil = 0; frozenUntil = 0
burnDmgPerSec = 0; lastBurnMs = 0
```

### 受傷與動畫

driver（manifest sprite）存在時播放對應動畫；否則用 fallback Graphics 染色/縮放。常數 `DRIVER_ATTACK_MS = 420`。

```typescript
takeDamage(dmg: number): void {
  if (this.destroyed) return
  this.hp = Math.max(0, this.hp - dmg)
  if (this.driver) {
    this._damageAnimUntil = performance.now() + 240
    void this.driver.play('HIT', this.facingDir, true)
  } else {
    this.gfx.tint = 0xff5050
    setTimeout(() => { if (this.gfx && !this.gfx.destroyed) this.gfx.tint = 0xffffff }, 120)
  }
  this.refreshHpBar()
}

get isAttacking(): boolean {
  return performance.now() < this._attackAnimUntil || this._animTick !== null
}
```

### 移動 + 朝向 + 深度排序

水平位移優先決定 LEFT/RIGHT，否則由垂直決定 UP/DOWN。`zIndex = y + 20` 讓越下方的怪物畫在前面。fallback gfx 用負 scale.x 翻轉。

```typescript
moveTo(x: number, y: number): void {
  const dx = x - this.x, dy = y - this.y
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    this.facingLeft = dx < 0
    this.facingDir = dx < 0 ? 'LEFT' : 'RIGHT'
  } else if (dy !== 0) {
    this.facingDir = dy < 0 ? 'UP' : 'DOWN'
  }
  this.x = x; this.y = y
  this.sprite.x = x; this.sprite.y = y
  this.sprite.zIndex = y + 20
  this.gfx.scale.x = this.facingLeft ? -1 : 1
  this._syncDriverPose()
}
```

### update 的動畫狀態選擇

只有 driver 載入後才動。優先序：攻擊 > 受傷 > idle > 移動。

```typescript
update(delta: number): void {
  if (!this.driver) return
  const now = performance.now()
  const state = now < this._attackAnimUntil ? 'ATTACK'
    : now < this._damageAnimUntil ? 'HIT'
    : this.aiState === 'idle' ? 'IDLE' : 'MOVE'
  void this.driver.play(state, this.facingDir)
  this.driver.update(delta)
  this._syncDriverPose(now)
}
```

### 血條與菁英/Boss 視覺

血條只在受傷時顯示，比例 >0.5 綠 / >0.25 橙 / 否則紅。Boss sprite ×2.0 染金 `0xffd24a`，Elite ×1.5 染橙 `0xff8a2a`。常數 `BAR_W=28, BAR_H=3, DEFAULT_BAR_Y=26`。

```typescript
setVariantVisual(isElite: boolean, isBoss: boolean): void {
  this.isBoss = isBoss
  this.isElite = isBoss ? false : isElite   // Boss 不同時是 Elite
  this.sprite.scale.set(isBoss ? 2.0 : isElite ? 1.5 : 1.0)
  ;(this.sprite as any).tint = isBoss ? 0xffd24a : isElite ? 0xff8a2a : 0xffffff
}
```

### sprite 雙軌：fallback Graphics + 非同步 driver

建構時先畫 fallback（`_drawBody` 用 PIXI.Graphics 手繪 slime/goblin/skeleton 等），再 `void EntitySpriteDriver.create('monster.<type>')` 非同步換成圖集。載入完成時若已 destroy 要把 driver sprite 銷毀。`_syncDriverPose` 計算攻擊時的擠壓/位移/旋轉（punch = sin(t*π)）。

## EventBus 互動

- 無。`MonsterEntity` 不直接碰 EventBus；跨模組溝通全由 `MonsterSpawner` 的注入回呼處理。

## 依賴

- `pixi.js` — Container / Graphics / Ticker
- `@/render` 的 `EntitySpriteDriver` — manifest 圖集驅動（注意這是直接 import render，屬已存在的既定相依）
- `@/core/i18n` 的 `t` — 怪物名稱本地化

## 重建提示

- `kind` 預設 `'siege'` 而非 `'wild'`；`_spawn` 會覆寫，但若直接 new 出來忘了設會被當守城怪。
- `setVariantVisual` 中 Boss 與 Elite 互斥：`isElite = isBoss ? false : isElite`。
- `takeDamage` 把 hp 夾在 0，但「死亡判定 + 掉落 + remove」在 MonsterSpawner，不在這裡。
- driver 是非同步載入，可能在實體已建立數幀後才出現；`update`/`refreshHpBar` 都要容忍 `driver === null`（用 fallback）。
- 銷毀守衛無處不在：每個畫圖/動畫方法都先檢查 `this.destroyed` 或 `gfx.destroyed`，否則 Pixi 會丟例外。
- fallback `_drawBody` 只手繪了 slime / slime_blue / goblin / skeleton 四種；其餘 type 的 fallback 是空的（純靠 driver）。
- `MONSTER_STATS` 每筆都重複寫了 `type` 欄位——重建時 type 必須等於 key。
- 21 種 `MonsterType` 順序固定，`Object.keys(MONSTER_STATS)` 被 MonsterSpawner 拿去當 `MONSTER_TYPES`。
