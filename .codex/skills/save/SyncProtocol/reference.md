---
name: sync-protocol
description: Player data serialization and new-player factory — look here for the JSON wire format, client-join handshake data, and the createNewPlayer defaults including researchLevel.
---

# save/SyncProtocol.ts

> 模組：save｜角色：玩家資料的序列化/反序列化與本地快取，供 Client 加入房間時帶上自身存檔

## 公開 API

- `SyncProtocol.exportPlayerData(playerData: PlayerData): string` — 將 PlayerData 序列化為 JSON 字串，用於網路傳輸
- `SyncProtocol.importPlayerData(json: string): PlayerData` — 反序列化 JSON 字串為 PlayerData，含基本驗證（需要 `id` 和 `name`）
- `SyncProtocol.getLocalPlayer(): PlayerData | null` — 同步讀取 localStorage `'forager_player'`，讀取失敗回傳 null
- `SyncProtocol.saveLocalPlayer(data: PlayerData): void` — 同步寫入 localStorage `'forager_player'`
- `SyncProtocol.createNewPlayer(name: string): PlayerData` — 建立全新玩家資料（第一次遊玩）

## 核心邏輯

### exportPlayerData / importPlayerData：JSON 序列化層

```typescript
static exportPlayerData(playerData: PlayerData): string {
  return JSON.stringify(playerData)
}

static importPlayerData(json: string): PlayerData {
  const data = JSON.parse(json) as PlayerData
  if (!data.id || !data.name) throw new Error(t('save.invalidPlayerData', undefined, '無效的玩家資料'))
  return data
}
```

傳輸格式即為 `PlayerData` 的直接 JSON 序列化，無額外包裝。驗證僅檢查 `id` 和 `name` 是否存在（truthy）。

### createNewPlayer：玩家出生點與初始值

```typescript
static createNewPlayer(name: string): PlayerData {
  return {
    id: crypto.randomUUID(),
    name,
    x: WORLD_CONFIG.CENTER_X, y: WORLD_CONFIG.CENTER_Y,
    hp: 100, maxHp: 100,
    xp: 0, level: 1,
    researchLevel: 1,
    gold: 0,
    inventory: [],
    unlockedSkills: [],
    color: Math.floor(Math.random() * 0xffffff),
  }
}
```

`researchLevel` 初始為 `1`（非 0），與 `level` 相同。出生座標取自 `WORLD_CONFIG.CENTER_X / CENTER_Y`。`color` 為隨機 24-bit PixiJS 整數色碼。

### localStorage 快取

```typescript
static getLocalPlayer(): PlayerData | null {
  const raw = localStorage.getItem('forager_player')
  if (!raw) return null
  try { return JSON.parse(raw) as PlayerData } catch { return null }
}

static saveLocalPlayer(data: PlayerData): void {
  localStorage.setItem('forager_player', JSON.stringify(data))
}
```

localStorage key 固定為 `'forager_player'`，與 `SaveManager.savePlayer()` 寫同一個 key，需保持一致。

## EventBus 互動

（本檔案無 EventBus 呼叫，純粹為序列化與本地快取工具類）

## 依賴

- `@/types` — `PlayerData` 型別
- `@/world/WorldGen` — `WORLD_CONFIG.CENTER_X / CENTER_Y`（出生點座標）
- `@/core/i18n` — `t()` 函式（用於 import 驗證失敗的錯誤訊息 i18n）

## 重建提示

- `SyncProtocol` 是 static-only class，無需實例化。
- `importPlayerData` 的錯誤訊息使用 `t('save.invalidPlayerData', undefined, '無效的玩家資料')`，第三個參數是 fallback 字串，i18n key 未定義時使用。
- `createNewPlayer` 中 `researchLevel: 1` 是關鍵——若省略或設為 0，玩家重新載入後研究系統會被重置（此為 CLAUDE.md 明確標注的 landmine）。
- `unlockedSkills: []` 初始為空陣列，skill 系統靠此欄位追蹤解鎖狀態，重建時不可省略。
- localStorage 快取是給無 async 情境的「同步快速讀取」使用（例如 Client 加入房間前打包資料），真實儲存仍以 IndexedDB 為準。
- `@/world/WorldGen` 的 import 違反了「只能 import `@/core/`」的嚴格規則，屬歷史遺留；重建時若遇到 linter/架構師阻攔，可改為直接寫死座標或從 EventBus 取得。
