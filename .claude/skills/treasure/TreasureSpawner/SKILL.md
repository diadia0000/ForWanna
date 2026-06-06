---
name: treasure-spawner
description: Lookup for TreasureSpawner — island-based seeded placement algorithm, chest lifecycle, collision/proximity API, and snapshot sync.
---

# treasure/TreasureSpawner.ts

> 模組：treasure｜角色：寶箱生成管理器 — 負責全圖放置、開箱流程、碰撞查詢、Client 快照還原

## 公開 API

- `new TreasureSpawner(container: PIXI.Container)` — 傳入 PixiJS 容器，所有 entity.sprite 均 addChild 到此處
- `setLandChecker(fn: (x, y) => boolean): void` — 注入陸地判斷函數；若未注入，spawnAll 僅在原點島（ix=0, iy=0）生成
- `setClickHandler(fn: (chestId: string) => void): void` — Host 直接 open，Client 送網路；**對已存在的 chest 補掛監聽**
- `spawnAll(world: WorldData): void` — 全圖初次生成（-4..4 × -4..4 島嶼），同時啟動 updateTicker
- `spawnForIsland(world: WorldData, ix: number, iy: number): void` — 新解鎖島嶼追加生成，不重疊已存在的寶箱
- `spawnOne(data: TreasureChestData): void` — 單個寶箱實體化並加入 container
- `openChest(chestId: string): Array<{ itemId: string; amount: number }>` — 開箱、emit `treasure:opened`
- `removeChest(chestId: string): void` — 銷毀 entity 並從 Map 刪除
- `isBlockedByChest(wx, wy, playerR): boolean` — 碰撞查詢（未開啟的箱才阻擋）
- `findNearbyChest(x, y, range): TreasureChestEntity | null` — R 鍵互動用，返回範圍內最近的未開啟箱
- `getAllChestsData(): TreasureChestData[]` — 供 Host 廣播用快照
- `restoreFromSnapshot(snapshot: TreasureChestData[]): void` — Client 收到全量狀態時完整重建
- `update(): void` — 每 tick 驅動所有 entity 的 glow 動畫
- `clear(): void` — 銷毀並清空全部 chest

## 核心邏輯

### 放置常數

```typescript
private static readonly TILE_SIZE       = 48
private static readonly CENTER_TILE     = 104
private static readonly ISLAND_STRIDE   = 22
private static readonly ISLAND_R        = (6.5 - 1.8) * 48   // ≈ 225.6 px，島嶼可用半徑
private static readonly MIN_RES_DIST    = 48 * 1.5            // 72 px，離資源節點最小距
private static readonly MIN_CHK_DIST    = 48 * 1.2            // 57.6 px，箱與箱最小距
private static readonly MIN_CENTER_DIST = 48 * 3              // 144 px，離島心最小距（避免堵出生點）
```

島嶼中心世界座標：`cx = (CENTER_TILE + ix * ISLAND_STRIDE) * TILE_SIZE`，`cy` 同理。

### Seeded RNG（Lehmer / Park-Miller）

```typescript
private _seededRandom(seed: number) {
  let current = seed % 2147483647
  if (current <= 0) current += 2147483646
  return () => {
    current = (current * 16807) % 2147483647
    return (current - 1) / 2147483646
  }
}
```

seed 推導：`islandSeed = Math.abs((worldSeed ^ (ix * 73856093)) ^ (iy * 19349663)) + 1`  
確保相同 worldSeed + 島嶼座標永遠產出相同的箱子位置，但不同島嶼之間結果獨立。

### 單島生成算法（_spawnIsland）

```typescript
private _spawnIsland(world, ix, iy, placed): void {
  const ring = Math.max(Math.abs(ix), Math.abs(iy))
  if (ring === 0) return                         // 起始島不生成（太靠近出生點）
  const maxChests = ring <= 2 ? 2 : 1
  const count = Math.floor(rng() * maxChests) + 1  // ring 1-2: 1~2 個；ring 3+: 1 個

  for (let ci = 0; ci < count; ci++) {
    const chestId = `chest_${seed}_${ix + 4}_${iy + 4}_${ci}` as NodeId
    if (this.chests.has(chestId)) continue       // 已開過的不重生

    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = rng() * Math.PI * 2
      const dist  = MIN_CENTER_DIST + rng() * (ISLAND_R - MIN_CENTER_DIST)
      const x = Math.floor(cx + Math.cos(angle) * dist)
      const y = Math.floor(cy + Math.sin(angle) * dist)

      if (!isLandPos(x, y)) continue
      if (dist_to_center < MIN_CENTER_DIST) continue
      if (any_resource within MIN_RES_DIST) continue
      if (any_placed_chest within MIN_CHK_DIST) continue

      placed.push({ x, y })
      this.spawnOne({ id: chestId, x, y, rarity: rollLootRarity(), loot: generateLoot(rarity), opened: false })
      break
    }
  }
}
```

40 次重試失敗則該 ci 名額放棄，不強制放置。

### Chest ID 格式

`chest_{worldSeed}_{ix+4}_{iy+4}_{ci}`  
ix/iy 範圍 -4..4，偏移 +4 後為 0..8，避免負數拼接歧義。

### 碰撞檢查

```typescript
isBlockedByChest(wx, wy, playerR): boolean {
  const CHEST_R = 32    // 視覺寬 88px，碰撞半徑取一半留餘地
  const combined = (CHEST_R + playerR) ** 2
  for (const [, entity] of this.chests) {
    if (entity.isOpened()) continue
    const dx = wx - entity.sprite.x
    const dy = wy - entity.sprite.y
    if (dx * dx + dy * dy < combined) return true
  }
  return false
}
```

已開啟的箱子不阻擋移動。

## EventBus 互動

- emit `treasure:opened` — payload `{ chestId: string, loot: Array<{ itemId: string; amount: number }> }`  
  在 `openChest()` 呼叫 `entity.open()` 之後立即發出；`main.ts` 監聽並將 loot 寫入背包。

## 依賴

- `pixi.js` — PIXI.Container
- `./TreasureChest` — TreasureChestEntity、TreasureChestData
- `./treasureConfig` — `rollLootRarity`、`generateLoot`
- `@/core/EventBus` — emit `treasure:opened`
- `@/types` — WorldData、NodeId

## 重建提示

- `spawnAll` 掃描 ix/iy ∈ [-4, 4] 共 81 個格子，但 `_spawnIsland` 內部還要 `isLandPos` 過濾，非陸地島直接 return，不生成。
- `setLandChecker` 必須在 `spawnAll` 之前呼叫，否則只有 ring-0 島（ring=0 又直接 return）實際上什麼都不生成。
- `restoreFromSnapshot` 先 `clear()`（銷毀舊 entity）再重建，**不保留** updateTicker；重建後若需要 ticker 要再次呼叫 `spawnAll` 或手動設定 updateTicker。實際上 Client 呼叫 `restoreFromSnapshot` 後，ticker 由 `update()` 驅動，而 updateTicker 在 `restoreFromSnapshot` 中並未重建——這是一個潛在 bug，Client 的 glow 動畫不會跑。
- `spawnForIsland` 使用**現有 chests 座標**作為 placed 初始值，確保追加島嶼時不覆蓋已存在的箱子。
- `setClickHandler` 補掛既有 chest 的 listener 時使用 `removeAllListeners('pointerdown')` 先清除，再重新綁定，避免重複觸發。
- chest entity 的 `sprite.eventMode` 固定為 `'none'`（TreasureChestEntity 建構子設定），`setClickHandler` 補掛的 listener 不會生效——實際的互動入口是 `findNearbyChest` + 外部 R 鍵處理，`setClickHandler` 目前是廢碼路徑。
- `totalChestsPerWorld = 30` 欄位存在但 `_spawnIsland` 並不使用它，實際數量由各島 ring 決定。
