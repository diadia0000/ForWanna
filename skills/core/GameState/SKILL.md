---
name: core-game-state
description: 實作全域單一真實來源（GameState 單例）以及戰鬥/研究等級門檻、屬性成長公式。重建任何讀寫玩家/世界狀態、等級換算、HP/ATK/DEF 計算、tick 推進的功能前，務必先讀這份拿到所有關鍵數值。
---

# core/GameState.ts

> 模組：core｜角色：持有整個遊戲的單一狀態樹（players / world / tick / hostId），並提供等級門檻表與屬性成長公式作為共用工具。

## 公開 API
- `GameStateManager_` — `GameStateManager` 的單例 export，狀態存取入口。
  - `get(): GameState` — 回傳整個狀態物件（直接參考，非 copy）。
  - `set(newState: GameState): void` — 整包替換狀態。
  - `applyDelta(delta: Partial<GameState>): void` — 淺合併：`this.state = { ...this.state, ...delta }`。
  - `getPlayer(id: PlayerId): PlayerData | undefined` — 取單一玩家。
  - `setPlayer(id: PlayerId, data: PlayerData): void` — 設定/覆寫單一玩家。
  - `removePlayer(id: PlayerId): void` — `delete state.players[id]`。
  - `getWorld(): WorldData` — 取世界資料。
  - `setWorld(world: WorldData): void` — 設定世界資料。
  - `incrementTick(): void` — `state.tick++`。
  - `isHost(playerId: PlayerId): boolean` — `state.hostId === playerId`。
- `PlayerStats`（const 物件）— 屬性成長公式：
  - `getMaxHpByCombatLevel(level: number): number`
  - `getAtkByCombatLevel(level: number): number`
  - `getDefByCombatLevel(level: number): number`
- `LevelSystem`（const 物件）— 等級換算：
  - `getCombatLevelFromXp(xp: number): number`
  - `getXpForCombatLevel(level: number): number`
  - `getResearchLevelFromResearch(research: number): number`
  - `getResearchPointsForLevel(level: number): number`

## 核心邏輯

### 等級門檻常數（務必照抄數值）
index = 等級，值 = 達到該等級所需累積 XP / 研究點數：

```typescript
// 共 21 項，等級 0..20
const COMBAT_LEVEL_THRESHOLDS = [0, 50, 100, 150, 200, 250, 300, 350, 400, 500, 650, 850, 1100, 1400, 1750, 2150, 2650, 3200, 3850, 4600, 5500]
// 共 11 項；注意 index 0 與 1 都是 0
const RESEARCH_LEVEL_THRESHOLDS = [0, 0, 100, 200, 400, 800, 1200, 1800, 2500, 3500, 5000]
```

### 屬性成長公式（PlayerStats）

```typescript
export const PlayerStats = {
  getMaxHpByCombatLevel: (level: number) => 100 + (level - 1) * 15,
  getAtkByCombatLevel:   (level: number) => 10 + (level - 1) * 5,
  getDefByCombatLevel:   (level: number) => 0 + (level - 1) * 0.02, // 刻意保留 0 + 表達基底
}
```

### 等級換算演算法（LevelSystem）
由高往低掃，第一個達標的 index 即等級；全不符 fallback 為 `1`（非 0）。combat 與 research 兩組完全同型，只換門檻表：

```typescript
export const LevelSystem = {
  getCombatLevelFromXp(xp: number): number {
    for (let i = COMBAT_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= COMBAT_LEVEL_THRESHOLDS[i]) return i
    }
    return 1
  },
  getXpForCombatLevel(level: number): number {
    // clamp 到最後一格，避免超出表長
    return COMBAT_LEVEL_THRESHOLDS[Math.min(level, COMBAT_LEVEL_THRESHOLDS.length - 1)]
  },
  // getResearchLevelFromResearch / getResearchPointsForLevel 同型，改用 RESEARCH_LEVEL_THRESHOLDS
  // …
}
```

### 狀態樹初始值 + manager CRUD

```typescript
class GameStateManager {
  private state: GameState = {
    tick: 0,
    players: {},
    world: { seed: 0, chunks: [], resources: [], buildings: [], createdAt: Date.now() },
    hostId: '',
  }

  get(): GameState { return this.state }            // 同一參考，非 copy
  set(newState: GameState): void { this.state = newState }
  applyDelta(delta: Partial<GameState>): void {
    this.state = { ...this.state, ...delta }        // 淺合併：巢狀（world）會整包覆寫
  }
  getPlayer(id: PlayerId) { return this.state.players[id] }
  setPlayer(id: PlayerId, data: PlayerData) { this.state.players[id] = data }
  removePlayer(id: PlayerId) { delete this.state.players[id] }
  getWorld(): WorldData { return this.state.world }
  setWorld(world: WorldData) { this.state.world = world }
  incrementTick(): void { this.state.tick++ }
  isHost(playerId: PlayerId): boolean { return this.state.hostId === playerId }
}

export const GameStateManager_ = new GameStateManager()  // 注意尾端底線
```

### 邊界條件
- `get()` 回傳同一參考，外部可直接 mutate（無不可變保護）；`applyDelta` 為淺合併，巢狀物件（如 world）會被整包覆寫而非深合併。
- 等級 fallback 為 1 而非 0，即使 xp 為負或低於門檻仍回傳 1。

## EventBus 互動
無（GameState 純資料層，不 emit/on；通知由更動狀態的呼叫方自行發事件）。

## 依賴
- `import type { GameState, PlayerId, PlayerData, WorldData } from '@/types'` — 全部當型別用，定義狀態樹形狀。

## 重建提示
- 這是被 GameLoop（`incrementTick` / `get().tick`）與幾乎所有遊戲系統共用的核心。先把兩個門檻常數與三條公式寫對，再寫 manager 的 CRUD。
- 易踩雷：(1) 門檻表的 index 即等級，掃描方向是「由高往低」找第一個達標；(2) RESEARCH 表 index 0、1 同為 0 不要寫漏；(3) `applyDelta` 是淺合併，別誤用在巢狀更新；(4) `get()` 非 immutable，要避免共享參考被意外改壞時加防護由呼叫方負責。
- 單例命名是 `GameStateManager_`（尾端底線），import 時別打成 `GameStateManager`。
