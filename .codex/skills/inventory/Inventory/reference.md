---
name: inventory-inventory
description: 背包核心系統 — 管理所有玩家的主背包狀態、監聽資源採集事件、提供增刪查 API；需要重建背包存取或資源轉換邏輯時首先參考此檔案。
---

# inventory/Inventory.ts

> 模組：inventory｜角色：以 Map 維護全玩家背包狀態的 singleton，對外提供 add / remove / get / getAmount API，並監聽 `resource:collected` 事件自動加物品。

## 公開 API

`Inventory` 是 `InventorySystem` class 的 singleton export（`export const Inventory = new InventorySystem()`）。

- `init(playerId: PlayerId): void` — 若此 playerId 尚未有背包記錄則建立空陣列；同時確保 `resource:collected` 全域監聽器只被註冊一次（以 `_resourceListenerRegistered` 布林旗標守門）。
- `add(playerId: PlayerId, itemId: string, amount: number, emitChange?: boolean): boolean` — 找 `ITEMS[itemId]` 定義，不存在回傳 `false`；存在則找背包內同 itemId 疊加（上限 `itemDef.maxStack`），沒有則新增 entry；預設 `emitChange = true` 觸發 `inventory:changed`。
- `remove(playerId: PlayerId, itemId: string, amount: number): boolean` — 找到 entry 且 `existing.amount >= amount` 才執行扣除；扣至 0 時直接 `splice` 移除 entry；無論如何都 emit `inventory:changed`；數量不足回傳 `false`。
- `get(playerId: PlayerId): InventoryItem[]` — 回傳 MAIN 背包陣列（內部 `getOrCreate` 保證不為 null）；注意：只回傳主背包，bag 物品不在此列（設計決定，非 bug）。
- `setInventory(playerId: PlayerId, inventory: InventoryItem[]): void` — Client 收到 Host 快照時直接覆蓋，做淺拷貝 `[...inventory]` 但不 emit；呼叫端自行負責後續通知。
- `getAmount(playerId: PlayerId, itemId: string): number` — 回傳指定 itemId 的數量，不存在回傳 0；供 `CraftingSystem.canCraft` 呼叫。

## 核心邏輯

**內部狀態：**

```typescript
private inventories: Map<PlayerId, InventoryItem[]> = new Map()
private _resourceListenerRegistered = false
```

**`add` — 疊加規則（含 maxStack 上限）：**

```typescript
add(playerId: PlayerId, itemId: string, amount: number, emitChange = true): boolean {
  const inv = this.getOrCreate(playerId)
  const itemDef = ITEMS[itemId]
  if (!itemDef) return false

  const existing = inv.find(i => i.itemId === itemId)
  if (existing) {
    existing.amount = Math.min(existing.amount + amount, itemDef.maxStack)
  } else {
    inv.push({ itemId, amount: Math.min(amount, itemDef.maxStack) })
  }
  if (emitChange) EventBus.emit('inventory:changed', { playerId, inventory: [...inv] })
  return true
}
```

**`remove` — 扣除並清理零數量 entry：**

```typescript
remove(playerId: PlayerId, itemId: string, amount: number): boolean {
  const inv = this.getOrCreate(playerId)
  const existing = inv.find(i => i.itemId === itemId)
  if (!existing || existing.amount < amount) return false
  existing.amount -= amount
  if (existing.amount === 0) {
    const idx = inv.indexOf(existing)
    inv.splice(idx, 1)
  }
  EventBus.emit('inventory:changed', { playerId, inventory: [...inv] })
  return true
}
```

**`getOrCreate` — 四個公開方法共用的守門私有方法：**

```typescript
private getOrCreate(playerId: PlayerId): InventoryItem[] {
  if (!this.inventories.has(playerId)) this.inventories.set(playerId, [])
  return this.inventories.get(playerId)!
}
```

**`init` — `resource:collected` 監聽器只掛一次（旗標守門）：**

```typescript
init(playerId: PlayerId): void {
  if (!this.inventories.has(playerId)) this.inventories.set(playerId, [])
  if (!this._resourceListenerRegistered) {
    this._resourceListenerRegistered = true
    EventBus.on('resource:collected', ({ playerId: pid, type, amount }) => {
      const itemId = this.resourceToItemId(type)
      if (itemId) this.add(pid, itemId, amount)
    })
  }
}
```

**`resourceToItemId` 硬編碼映射表：**

```typescript
private resourceToItemId(type: string): string | null {
  const map: Record<string, string> = {
    tree: 'wood', rock: 'stone', iron: 'iron', gold: 'gold', crystal: 'crystal',
    fire_node: 'fire_essence', ice_node: 'ice_essence',
  }
  return map[type] ?? null
}
```

**`getAmount` — 供 CraftingSystem 使用：**

```typescript
getAmount(playerId: PlayerId, itemId: string): number {
  return this.getOrCreate(playerId).find(i => i.itemId === itemId)?.amount ?? 0
}
```

**邊界條件：**

- `maxStack` 上限在 `add` 時強制（單次 add 和疊加都套），不會超過上限。
- `get()` 回傳的是內部陣列的直接參考，不是副本——呼叫端不應直接修改返回值；`inventory:changed` payload 是淺拷貝 `[...inv]`（安全）。
- `setInventory` 做淺拷貝 `[...inventory]` 避免外部陣列污染內部狀態。

## EventBus 互動

- on `resource:collected` — payload: `{ playerId: string, type: string, amount: number }`；收到後用 `resourceToItemId(type)` 查映射，有值則呼叫 `this.add(pid, itemId, amount)`。
- emit `inventory:changed` — payload: `{ playerId: PlayerId, inventory: InventoryItem[] }`（淺拷貝）；於 `add`（emitChange=true）和 `remove` 成功後觸發。

## 依賴

- `@/types` — `InventoryItem`, `PlayerId` 型別。
- `@/core/EventBus` — 監聽 `resource:collected`、發射 `inventory:changed`。
- `./data/items` — `ITEMS` 表，用來查 `maxStack` 與驗證 itemId 合法性。

## 重建提示

- `Inventory` 是 singleton（模組載入時即 `new`），整個遊戲共享同一實例；不要誤改成每次 import 都 new。
- `_resourceListenerRegistered` 旗標是關鍵——若少了這個守門，每次 `init` 都會重複掛監聽器，資源採集將被多倍計入。
- `get()` 刻意只回傳 MAIN 背包；背包擴充（bag_small / bag_large）的內容不在此 Map 中，這是設計決定，重建時不要「修正」它。
- `setInventory` 無 EventBus emit，呼叫端（通常是 Network 層 Client 收到 Host snapshot）要自行決定是否通知 UI。
- `remove` 在數量不足時回傳 `false` 且不修改狀態，但沒有拋出錯誤——呼叫端應該先用 `canCraft` / `getAmount` 確認，不要依賴 remove 的回傳值做錯誤恢復。
