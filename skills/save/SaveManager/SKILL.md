---
name: save-manager
description: World and player persistence logic — look here for save/load flow, auto-save timer, event integration, and the save:request → save:complete contract.
---

# save/SaveManager.ts

> 模組：save｜角色：儲存與載入的業務邏輯層，統一管理世界與玩家資料的讀寫

## 公開 API

- `SaveManager.saveWorld(worldData: WorldData, saveName?: string): Promise<void>` — 將世界資料存入 IndexedDB（預設 saveName `'autosave'`）
- `SaveManager.loadWorld(saveName?: string): Promise<WorldData | null>` — 從 IndexedDB 讀取世界資料，找不到回傳 `null`
- `SaveManager.savePlayer(playerData: PlayerData): Promise<void>` — upsert 玩家資料至 IndexedDB，同時鏡像至 localStorage `'forager_player'`
- `SaveManager.loadPlayer(playerId: string): Promise<PlayerData | null>` — 從 IndexedDB 讀取玩家資料
- `SaveManager.startAutoSave(intervalMs?: number, getWorldData: () => WorldData, saveName?: string): void` — 啟動定期自動儲存（預設 30 秒），每次完成後 emit `save:complete`
- `SaveManager.stopAutoSave(): void` — 清除自動儲存計時器
- `SaveManager.listSaves(): Promise<string[]>` — 回傳所有 saveName 清單
- `SaveManager.listWorldsWithInfo(): Promise<{ saveName: string; createdAt: number }[]>` — 回傳按 createdAt 降序排列的存檔列表
- `SaveManager.deleteWorld(saveName: string): Promise<void>` — 刪除指定 saveName
- `SaveManager.renameWorld(oldName: string, newName: string): Promise<void>` — 重命名存檔（刪舊 + 新增，移除 `id` 避免主鍵衝突）

## 核心邏輯

### saveWorld：delete-then-add 去重模式

```typescript
async saveWorld(worldData: WorldData, saveName = DEFAULT_SAVE): Promise<void> {
  await db.worlds.where('saveName').equals(saveName).delete()
  await db.worlds.add({ ...worldData, saveName })
}
```

Dexie 的 `worlds` 表主鍵為自動遞增 `id`，`saveName` 是普通索引，不具 unique 約束，因此靠此模式確保同名只保留一筆。

### loadWorld：strip saveName 後返回 WorldData

```typescript
async loadWorld(saveName = DEFAULT_SAVE): Promise<WorldData | null> {
  const record = await db.worlds.where('saveName').equals(saveName).first()
  if (!record) return null
  const { saveName: _, ...worldData } = record
  return worldData as WorldData
}
```

從 DB 讀出的記錄含有 `id` 和 `saveName` 欄位，需解構排除 `saveName` 後再回傳。注意 `id` 欄位並未排除，但 `WorldData` 型別不含 `id`，TypeScript 允許多餘屬性在物件展開後存在。

### savePlayer：雙寫 IndexedDB + localStorage

```typescript
async savePlayer(playerData: PlayerData): Promise<void> {
  await db.players.put(playerData)
  localStorage.setItem('forager_player', JSON.stringify(playerData))
}
```

`put()` 是 Dexie 的 upsert，主鍵為 `id`（string）。localStorage 鏡像是為了讓 `SyncProtocol.getLocalPlayer()` 在無 async 情境下能同步讀取。

### startAutoSave：事件觸發存檔

```typescript
startAutoSave(intervalMs = 30_000, getWorldData: () => WorldData, saveName = DEFAULT_SAVE): void {
  this.stopAutoSave()
  this.autoSaveInterval = setInterval(async () => {
    await this.saveWorld(getWorldData(), saveName)
    EventBus.emit('save:complete', {})
  }, intervalMs)
}
```

`getWorldData` 是 callback，每次計時器觸發時才呼叫（避免閉包捕獲舊的世界狀態）。每次儲存完成後 emit `save:complete`，供 UI 顯示提示。

### renameWorld：delete + re-add 模式（移除 id 避免主鍵衝突）

```typescript
async renameWorld(oldName: string, newName: string): Promise<void> {
  const record = await db.worlds.where('saveName').equals(oldName).first()
  if (!record) throw new Error(`找不到存檔：${oldName}`)
  await db.worlds.where('saveName').equals(oldName).delete()
  const { id: _id, ...rest } = record as typeof record & { id?: number }
  await db.worlds.add({ ...rest, saveName: newName })
}
```

必須排除 `id` 欄位，否則 `add()` 會嘗試沿用舊主鍵，引發 Dexie ConstraintError。

## EventBus 互動

- emit `save:complete` — payload `{}`，每次 `startAutoSave` 計時器儲存完成後觸發
- on `save:request` — **本檔案未直接監聽**；`save:request` 由外部（`main.ts` / GameController）監聽後呼叫 `SaveManager.saveWorld()`，完成後再手動 emit `save:complete`

## 依賴

- `./GameDB` (`db`) — 底層 Dexie 單例
- `@/core/EventBus` — emit `save:complete`
- `@/types` — `WorldData`、`PlayerData` 型別

## 重建提示

- `DEFAULT_SAVE = 'autosave'` 是常數，為 module-level private，非類別成員。
- `SaveManager` 是單例（`new SaveManagerClass()`），不是 class export，import 時為 `import { SaveManager } from './SaveManager'`。
- `autoSaveInterval` 型別為 `ReturnType<typeof setInterval> | null`（跨 Node/browser 環境安全）。
- `loadWorld` 返回物件中的 `id` 欄位（Dexie 自動添加的數字主鍵）會被 TypeScript 的 `WorldData` 型別遮蔽，但實際仍存在於物件中；若需真正乾淨的 `WorldData` 也應排除 `id`。
- `listWorldsWithInfo` 用 `w.createdAt ?? 0` 防禦無 `createdAt` 欄位的舊存檔。
- `savePlayer` 的 localStorage 鏡像和 `SyncProtocol.saveLocalPlayer` 都寫同一個 key `'forager_player'`——兩者保持一致。
