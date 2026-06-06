---
name: building-building-system
description: BuildingSystem 是建築模組的核心引擎，負責放置合法性驗證、世界狀態寫入、PixiJS 渲染、傷害/修復/升級生命週期；重建時所有「建築放置、碰撞、血量、升級、拆除」邏輯都參考這裡。
---

# building/BuildingSystem.ts

> 模組：building｜角色：建築的唯一權威來源，管理所有建築的放置合法性、世界狀態、PIXI 精靈、HP 生命週期與升級，並透過 EventBus 廣播狀態變化。

## 公開 API

- `constructor(container: PIXI.Container): BuildingSystem` — 建立內部 Map，訂閱 `i18n:changed` 更新所有已放置建築的名稱標籤。
- `setWaterChecker(fn: (wx: number, wy: number) => boolean): void` — 注入水域判斷函數（由 main.ts 在初始化時提供）。
- `setPlayersGetter(fn: () => Array<{ x: number; y: number }>): void` — 注入玩家座標取得函數（main.ts 提供，用於放置碰撞）。
- `canPlace(buildingDefId: BuildingId, x: number, y: number, playerId: PlayerId): boolean` — 驗證指定位置是否可放置：材料、水域、建築重疊、資源節點重疊、玩家碰撞，全部通過才回傳 true。
- `place(playerId: PlayerId, buildingDefId: BuildingId, x: number, y: number): Building | null` — 放置建築：通過 canPlace → 扣材料 → 建立 Building 物件 → 寫入 world.buildings → 渲染精靈 → emit `build:placed`；木橋額外啟動 10 秒建造計時器。回傳 Building 或 null。
- `getAll(): Building[]` — 回傳 GameState 中所有建築陣列。
- `restoreBuilding(building: Building): void` — Client 端重連時從網路同步回復建築（如已有精靈則跳過）。
- `demolish(buildingId: string): Building | null` — 拆除建築：從 world.buildings 移除、移除精靈、清除進度與標籤記錄，回傳被拆除的 Building。
- `getBuildingDefs(): typeof BUILDING_DEFS` — 回傳所有建築定義（唯讀引用）。
- `isBuilding(buildingId: string): boolean` — 查詢建築是否仍在建造計時中（目前只有 wooden_bridge）。
- `update(): void` — 每 tick 呼叫；遍歷 buildingProgress，更新 sprite.alpha（0.4→1.0）和倒數文字；完成時移除計時記錄。
- `takeDamage(buildingId: string, damage: number): boolean` — 扣血、更新 sprite alpha（hp>0 為 1.0，hp≤0 為 0.3）、emit `building:damaged`，hp 降至 0 時額外 emit `building:destroyed`；回傳是否已毀。
- `repair(playerId: PlayerId, buildingId: string): boolean` — hp > 0 時不允許修復；扣 TRAP_REPAIR_COST 材料；恢復 `Math.floor(maxHp * 0.7)` HP；sprite alpha 還原 1.0；emit `building:repaired`。
- `isDestroyed(buildingId: string): boolean` — 回傳建築是否不存在或 hp ≤ 0。
- `canUpgrade(building: Building): boolean` — 查詢 BUILDING_UPGRADES 該 defId 是否有下一級（building.level < upgrades.length）。
- `upgrade(playerId: PlayerId, buildingId: string): boolean` — 驗證所有人、材料、層級上限；扣材料；building.level += 1、maxHp/hp = nextUpgrade.hp；emit `building:upgraded`。

## 核心邏輯

### 常數
- `TILE_SIZE = 48`
- `PLAYER_COL_OFFSET_Y = 8`（玩家碰撞圓心往上偏移 px）
- `PLAYER_COL_R = 18`（玩家碰撞圓半徑 px，靜態屬性）

### canPlace 驗證管線

完整管線，依序執行，任一失敗立即 return false：

```typescript
canPlace(buildingDefId: BuildingId, x: number, y: number, playerId: PlayerId): boolean {
  const def = BUILDING_DEFS[buildingDefId]
  if (!def) return false

  // 1. 材料
  const hasMaterials = def.cost.every(c =>
    Inventory.getAmount(playerId, c.itemId) >= c.amount
  )
  if (!hasMaterials) return false

  // 2. 水域（中心點判斷）
  if (this.isWaterChecker) {
    const cx = x + def.size.x * TILE_SIZE / 2
    const cy = y + def.size.y * TILE_SIZE / 2
    const tileIsWater = this.isWaterChecker(cx, cy)
    if (buildingDefId === 'wooden_bridge') {
      if (!tileIsWater) return false      // 木橋必須在水上
    } else {
      if (tileIsWater) return false       // 其他建築不能在水上
    }
  }

  // 3. 建築重疊（AABB，以各自左上角計算）
  const hasBuildingConflict = (world.buildings ?? []).some(b => {
    const bDef = BUILDING_DEFS[b.defId]
    return Math.abs(b.x - x) < bDef.size.x * TILE_SIZE &&
           Math.abs(b.y - y) < bDef.size.y * TILE_SIZE
  })
  if (hasBuildingConflict) return false

  // 4. 資源節點重疊（AABB 對圓，資源半徑 = TILE_SIZE * 0.5 = 24）
  const buildingHalfW = def.size.x * TILE_SIZE / 2
  const buildingHalfH = def.size.y * TILE_SIZE / 2
  const buildingCX = x + buildingHalfW
  const buildingCY = y + buildingHalfH
  const RESOURCE_R = TILE_SIZE * 0.5   // = 24
  const hasResourceConflict = (world.resources ?? []).some(r => {
    const dx = Math.max(0, Math.abs(r.x - buildingCX) - buildingHalfW)
    const dy = Math.max(0, Math.abs(r.y - buildingCY) - buildingHalfH)
    return (dx * dx + dy * dy) < RESOURCE_R * RESOURCE_R
  })
  if (hasResourceConflict) return false

  // 5. 玩家碰撞（陷阱豁免）
  const isTrap = ['spike_trap', 'fire_trap', 'ice_trap'].includes(buildingDefId)
  if (!isTrap && this._getPlayers) {
    const R = BuildingSystem.PLAYER_COL_R        // 18
    const oY = BuildingSystem.PLAYER_COL_OFFSET_Y  // 8
    const bw = def.size.x * TILE_SIZE
    const bh = def.size.y * TILE_SIZE
    const hasPlayerConflict = this._getPlayers().some(p => {
      const pcx = p.x
      const pcy = p.y - oY
      const nearX = Math.max(x, Math.min(pcx, x + bw))
      const nearY = Math.max(y, Math.min(pcy, y + bh))
      const dx = pcx - nearX
      const dy = pcy - nearY
      return dx * dx + dy * dy < R * R
    })
    if (hasPlayerConflict) return false
  }

  return true
}
```

### place：放置建築

```typescript
place(playerId: PlayerId, buildingDefId: BuildingId, x: number, y: number): Building | null {
  if (!this.canPlace(buildingDefId, x, y, playerId)) return null
  const def = BUILDING_DEFS[buildingDefId]
  def.cost.forEach(c => Inventory.remove(playerId, c.itemId, c.amount))

  const building: Building = {
    id: `building_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    defId: buildingDefId,
    x, y,
    ownerId:  playerId,
    placedAt: Date.now(),
    level: 1,
    hp: 100,
    maxHp: 100,
  }

  GameStateManager_.getWorld().buildings.push(building)
  this._renderBuilding(building)

  if (buildingDefId === 'wooden_bridge') {
    this.buildingProgress.set(building.id, { startTime: Date.now(), duration: 10_000 })
  }

  EventBus.emit('build:placed', { playerId, buildingId: building.id, x, y })
  return building
}
```

### _renderBuilding：渲染分派與 zIndex

```typescript
private _renderBuilding(building: Building): void {
  const def = BUILDING_DEFS[building.defId]
  const w = def.size.x * TILE_SIZE
  const h = def.size.y * TILE_SIZE
  const c = new PIXI.Container()
  c.x = building.x
  c.y = building.y
  // wooden_bridge 作地板層（低於玩家/資源）；其他走 Y-sort
  c.zIndex = building.defId === 'wooden_bridge' ? building.y - 100 : building.y + h

  switch (building.defId) {
    case 'furnace':        this._drawFurnace(c, w, h, building.id);       break
    case 'research_lab':   this._drawResearchLab(c, w, h, building.id);   break
    case 'farm':           this._drawFarm(c, w, h, building.id);          break
    case 'market':         this._drawMarket(c, w, h, building.id);        break
    case 'goddess_statue': this._drawGoddessStatue(c, w, h, building.id); break
    case 'wooden_bridge':  this._drawWoodenBridge(c, w, h);               break
    case 'tower':          this._drawBlockSprite(c, w, h, 'block.tower', building.id, def); break
    case 'fire_trap':      this._drawBlockSprite(c, w, h, 'block.fire_trap', building.id, def); break
    case 'ice_trap':       this._drawBlockSprite(c, w, h, 'block.ice_trap', building.id, def); break
    default:               this._drawGeneric(c, w, h, building.id, def);  break
  }

  const timerContainer = new PIXI.Container()
  timerContainer.name = 'timer'
  c.addChild(timerContainer)
  this.container.addChild(c)
  this.sprites.set(building.id, c)
}
```

`_drawBlockSprite` 降級模式：EntitySpriteDriver.createSync(manifestId) 失敗 → 呼叫 `_drawGeneric`。成功時 `driver.sprite.x += w/2; driver.sprite.y += h`（精靈 anchor 在底部中心）。

### update()：建造計時器（木橋專用）

```typescript
update(): void {
  const now = Date.now()
  for (const [buildingId, progress] of this.buildingProgress.entries()) {
    const elapsed = now - progress.startTime
    const completedRatio = Math.min(elapsed / progress.duration, 1)
    const remainingSeconds = Math.ceil(Math.max(progress.duration - elapsed, 0) / 1000)

    const sprite = this.sprites.get(buildingId)
    if (sprite) {
      sprite.alpha = 0.4 + completedRatio * 0.6   // 0.4 → 1.0

      const timerContainer = sprite.getChildByName('timer') as PIXI.Container
      if (timerContainer) {
        timerContainer.removeChildren()
        if (remainingSeconds > 0) {
          const txt = new PIXI.Text({
            text: `${remainingSeconds}s`,
            style: { fontSize: 14, fill: 0xffff00, stroke: { color: 0x000000, width: 2 }, fontWeight: 'bold' },
          })
          txt.anchor.set(0.5, 0.5)
          txt.x = 24; txt.y = 24
          timerContainer.addChild(txt)
        }
      }

      if (completedRatio >= 1) {
        this.buildingProgress.delete(buildingId)
        timerContainer?.removeChildren()
      }
    }
  }
}
```

### takeDamage / repair / upgrade

```typescript
takeDamage(buildingId: string, damage: number): boolean {
  const building = GameStateManager_.getWorld().buildings.find(b => b.id === buildingId)
  if (!building) return false
  building.hp = Math.max(0, building.hp - damage)
  const sprite = this.sprites.get(buildingId)
  if (sprite) sprite.alpha = building.hp <= 0 ? 0.3 : 1.0
  EventBus.emit('building:damaged' as any, { buildingId, hp: building.hp, maxHp: building.maxHp })
  if (building.hp <= 0) {
    EventBus.emit('building:destroyed' as any, { buildingId, defId: building.defId })
  }
  return building.hp <= 0
}

repair(playerId: PlayerId, buildingId: string): boolean {
  const building = /* find */ ...
  if (!building || building.hp > 0) return false   // hp>0 不允許修復
  const repairCost = TRAP_REPAIR_COST[building.defId]
  if (!repairCost) return false
  // canAfford check → remove items
  building.hp = Math.floor(building.maxHp * 0.7)
  sprite.alpha = 1.0
  EventBus.emit('building:repaired' as any, { buildingId, hp: building.hp })
  return true
}

upgrade(playerId: PlayerId, buildingId: string): boolean {
  // building.ownerId !== playerId → false
  const nextUpgrade = BUILDING_UPGRADES[building.defId][building.level]  // level 作 index
  // canAfford → remove items
  building.level += 1
  building.maxHp = nextUpgrade.hp
  building.hp    = nextUpgrade.hp   // 升級後滿血
  EventBus.emit('building:upgraded', { playerId, buildingId, newLevel: building.level })
  return true
}
```

### _addLabel 與語言同步

```typescript
private _addLabel(c: PIXI.Container, buildingId: string, defId: string, w: number, _h: number, y = 0): void {
  const def = BUILDING_DEFS[defId]
  const label = new PIXI.Text({
    text: t(`building.${defId}.name`, undefined, def?.name ?? defId),
    style: { fontSize: 9, fill: 0xffffff, dropShadow: { color: 0x000000, blur: 1, distance: 1, alpha: 0.9 } },
  })
  label.anchor.set(0.5, 1)
  label.x = w / 2
  label.y = y    // 各建築不同：-10 / -28 / -30 / -32 / 0
  c.addChild(label)
  this.nameLabels.set(buildingId, { label, defId })
}
```

### 內部狀態
- `sprites: Map<buildingId, PIXI.Container>` — 每個建築的根容器
- `buildingProgress: Map<buildingId, { startTime: number; duration: number }>` — 建造計時
- `nameLabels: Map<buildingId, { label: PIXI.Text; defId: string }>` — 語言切換用
- `isWaterChecker` / `_getPlayers` — 注入函數，初始為 null

## EventBus 互動

- on `i18n:changed` — 遍歷 nameLabels，重新翻譯所有已放置建築的名稱標籤。
- emit `build:placed` — payload: `{ playerId: PlayerId, buildingId: string, x: number, y: number }`；place() 成功後觸發。
- emit `building:damaged` — payload: `{ buildingId: string, hp: number, maxHp: number }`；takeDamage() 每次呼叫。
- emit `building:destroyed` — payload: `{ buildingId: string, defId: string }`；hp 降至 0 時在 takeDamage() 內額外觸發（以 `as any` 繞過型別檢查）。
- emit `building:repaired` — payload: `{ buildingId: string, hp: number }`；repair() 成功後觸發（as any）。
- emit `building:upgraded` — payload: `{ playerId: PlayerId, buildingId: string, newLevel: number }`；upgrade() 成功後觸發。

## 依賴

- `pixi.js` — PIXI.Container、PIXI.Graphics、PIXI.Text（渲染）
- `@/types` — Building、PlayerId、BuildingId（型別）
- `@/core/EventBus` — emit/on
- `@/core/i18n` — `t()` 翻譯函數
- `@/inventory` — `Inventory.getAmount`、`Inventory.remove`（直接 import，例外於 EventBus 原則，屬跨模組直接呼叫）
- `@/core/GameState` — `GameStateManager_.getWorld()`，讀寫 world.buildings / world.resources
- `@/render/EntitySpriteDriver` — `EntitySpriteDriver.createSync(manifestId)` 載入精靈，失敗時降級為 Graphics
- `./data/buildings` — BUILDING_DEFS、BUILDING_UPGRADES、TRAP_REPAIR_COST

## 重建提示

- TILE_SIZE 在此為 48（非 32），與 BuildingPlacer 的 32 不同；place 和 canPlace 的座標計算都基於 48。
- `Inventory` 是直接 import 而非透過 EventBus，重建時注意此例外（現況如此，未來可能改為事件驅動）。
- `building:damaged`、`building:destroyed`、`building:repaired` 三個 emit 都加了 `as any`，表示型別定義（types/index.ts）中尚未有這三個事件的正式宣告；重建時請在 types 補齊或維持 as any。
- restoreBuilding 在 Client 端重連時使用，須先確認 sprites.has 才跳過，避免重複渲染。
- demolish 回傳 Building，讓呼叫方（通常是 UI 或 Network 層）自行決定是否退還材料。
- update() 必須在每個 GameLoop tick 中呼叫，否則木橋建造計時不會更新。
- 玩家碰撞豁免清單固定為 `['spike_trap', 'fire_trap', 'ice_trap']`，陷阱允許玩家站在上面放置。
