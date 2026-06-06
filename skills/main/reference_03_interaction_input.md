# main.ts 重建參考 03：互動偵測、瞄準、採集/攻擊、鍵盤輸入、Host 端動作

> 涵蓋 src/main.ts 第 1174–2543 行

本段是 `bootstrap()` 內「輸入與互動」核心：建築放置、座標轉換、瞄準/選格、互動射線偵測、採集/攻擊、各 UI 回呼（熔爐/市場/研究/核心/兵營/拆除）、超大型 `keydown` 處理器、以及 Host 端的 `_doAttack`/`_unlockIsland`/`_goddessPray`。所有函式都定義在 `bootstrap()` 閉包內,直接存取上層的全域可變狀態與系統單例(`buildingSystem`、`spawner`、`monsterSpawner`、`treasureSpawner`、`dungeonScene`、`hotbarUI`、`fxLayer`、`GameStateManager_`、`Inventory`、`RoomManager`、`NetworkHost`、`NetworkClient` 等)。

---

## 1. 本段使用 / 引入的全域可變狀態

這些在 `bootstrap()` 上方宣告(行號標於後),本段大量讀寫:

```typescript
const openedChests    = new Set<string>()   // 行175 已開啟寶箱 ID(用於廣播/重複開啟防護)
let   lastAttackMs    = 0                    // 行190 上次攻擊時間戳(performance.now),用於 cooldown
let   flashlightOn    = false               // 行197 手電筒開關(手持時 R 切換,切格仍維持)
const goddessCooldowns = new Map<string, number>() // 行200 女神像 statueId → 上次祈禱時間
let   nightCount      = 0                    // 行204 夜晚計數(寫入世界時鐘快照)
let   foodBiteCount   = 0                    // 行220 目前連按 R 的咬食次數
let   lastFoodItemId  = ''                   // 行221 切換食物時重置計數
let   inDungeon       = false                // 行341 是否在遺跡副本內
let   myPlayerId      = ''                   // 行370 本機玩家 ID
let   selectedDir     = { dx: 1, dy: 0 }     // 行383 鍵盤決定的面向(無指標時 fallback)
const selectedPoint   = { x:0, y:0, clientX:0, clientY:0, hasPointer:false } // 行384 滑鼠瞄準點(世界座標,已 clamp 到互動半徑)
let   selectorFlashUntil = 0                 // 行385 選格無效閃紅截止時間
let   playerReach     = 1                    // 行407 玩家互動半徑倍數(格)
let   demolishTargetId: string | null = null // 行675 待拆除建築 ID
let   placingDefId: string | null = null     // 行821 目前正在放置的建築 defId(null = 未放置)
let   waterPositions  = [...]                 // 行2876 水面格(由 tileMap.getWaterPositions())
```

常數(本段引用):

```typescript
const PLAYER_COLLISION_CENTER_Y = 8   // 行814 玩家碰撞中心相對 sprite 原點的 Y 偏移
const PLAYER_COLLISION_RADIUS   = 10  // 行815 玩家碰撞半徑
```

`inputState`(WASD/方向鍵 boolean,在上方宣告)由 keydown/keyup 維護。

---

## 2. 建築放置 / 座標轉換 / 選格瞄準

### 放置 ghost

```typescript
function startPlacement(defId: string): void {
  placingDefId = defId
  const def = BUILDING_DEFS[defId]
  ghost.removeChildren()
  const g = new PIXI.Graphics()
  const w = def.size.x * TILE_SIZE, h = def.size.y * TILE_SIZE
  g.rect(0,0,w,h).fill({ color:0xffffff, alpha:0.55 })
  g.rect(0,0,w,h).stroke({ color:0xffffff, width:2 })
  const label = new PIXI.Text({ text:def.name, style:{ fontSize:9, fill:0xffffff } })
  label.x = 3; label.y = 2
  ghost.addChild(g, label)
  ghost.visible = true
  document.body.style.cursor = 'crosshair'
}
function cancelPlacement(): void {
  placingDefId = null; ghost.visible = false; document.body.style.cursor = ''
}
```

### 螢幕→世界座標(含 camera 與縮放)

```typescript
function screenToWorld(clientX: number, clientY: number) {
  const rect = app.canvas.getBoundingClientRect()
  const sx = (clientX - rect.left) / rect.width  * app.screen.width
  const sy = (clientY - rect.top)  / rect.height * app.screen.height
  return { x: (sx - camera.x) / CAMERA_ZOOM, y: (sy - camera.y) / CAMERA_ZOOM }
}
```

### 互動幾何

```typescript
function flashSelectorInvalid(): void { selectorFlashUntil = performance.now() + 140 }

function getInteractionRadius(): number { return TILE_SIZE * Math.max(1, playerReach) }

// 碰撞中心 = sprite 原點往下 PLAYER_COLLISION_CENTER_Y(8px)
function getPlayerCollisionCenter(x, y) { return { x, y: y + PLAYER_COLLISION_CENTER_Y } }

// 互動原點 = 碰撞中心(攻擊/採集/射線都以此為起點)
function getInteractionOrigin(me: Player) { return getPlayerCollisionCenter(me.x, me.y) }
```

### 水面 / 移動阻擋

```typescript
function isBlockedByWaterAt(x, y): boolean {
  const center = getPlayerCollisionCenter(x, y)
  // 中心 + 上下左右 4 個 半徑取樣點,任一在水上即阻擋
  const samples = [[0,0],[0,-R],[0,R],[-R,0],[R,0]]   // R = PLAYER_COLLISION_RADIUS
  return samples.some(([ox,oy]) => isWater(center.x+ox, center.y+oy))
}
function isMovementBlockedAt(x, y): boolean {
  // 水 → 節點 → 建築 → 寶箱,任一阻擋即 true
  if (isBlockedByWaterAt(x,y)) return true
  const c = getPlayerCollisionCenter(x,y)
  if (isBlockedByNode(c.x,c.y)) return true
  if (isBlockedByBuilding(c.x,c.y)) return true
  if (treasureSpawner.isBlockedByChest(c.x,c.y,PLAYER_COLLISION_RADIUS)) return true
  return false
}
```

### 瞄準方向(四向化)

`getAimDir` 永遠回傳「四向之一」(上/下/左/右),供格子式攻擊使用。有指標時用指標相對原點的向量,否則用鍵盤 `selectedDir`;比較 |dx| 與 |dy| 取較大軸:

```typescript
function getAimDir(me: Player): { dx: number; dy: number } {
  const origin = getInteractionOrigin(me)
  const dx = selectedPoint.hasPointer ? selectedPoint.x - origin.x : selectedDir.dx
  const dy = selectedPoint.hasPointer ? selectedPoint.y - origin.y : selectedDir.dy
  if (Math.abs(dx) >= Math.abs(dy)) return { dx: dx >= 0 ? 1 : -1, dy: 0 }
  return { dx: 0, dy: dy >= 0 ? 1 : -1 }
}
```

### 依指標更新選格(clamp 到互動半徑)

```typescript
function updateSelectedPointFromPointer(clientX, clientY): void {
  const me = players.get(myPlayerId); if (!me) return
  const mouse = screenToWorld(clientX, clientY)
  const origin = getInteractionOrigin(me)
  const radius = getInteractionRadius()
  const dx = mouse.x-origin.x, dy = mouse.y-origin.y
  const len = Math.hypot(dx,dy)
  const scale = len > radius && len > 0 ? radius/len : 1   // 超出半徑就 clamp
  selectedPoint.clientX = clientX; selectedPoint.clientY = clientY
  selectedPoint.x = origin.x + dx*scale
  selectedPoint.y = origin.y + dy*scale
  selectedPoint.hasPointer = true
  selectedDir = getAimDir(me)   // 同步更新四向
}
function clearSelectedPoint(): void { selectedPoint.hasPointer = false }
```

`normalizeMove(dx,dy)`:把移動向量正規化成單位向量(0,0 → 0,0)。

---

## 3. 玩家 sprite 指派 / 全狀態同步

```typescript
// Host 排序:hostId 在最前,其餘字典序;依序套 PLAYER_SPRITE_IDS[index % N] 到 data.spriteId
function assignPlayerSprites(state = GameStateManager_.get()): void { ... }

// 若 spriteManifestId 變了 → 銷毀重建 Player;否則 syncFromServer;不存在 → 新建並加入 playerLayer
function upsertPlayerSprite(pData: PlayerData): void { ... }

function restoreWorldBuildings(world: WorldData): void {
  for (const b of world.buildings ?? []) buildingSystem.restoreBuilding(b)
}
```

### Client 全狀態同步(收 state_full 時)

```typescript
function syncClientFullState(state: GameState): void {
  if (!myPlayerId && RoomManager.myId) myPlayerId = RoomManager.myId
  assignPlayerSprites(state)
  const world = state.world
  if (world.nightCount != null) nightCount = world.nightCount
  if (world.dayCount != null || world.dayTimeS != null)
    dayNight.restore(world.dayCount ?? 1, world.dayTimeS ?? 0)
  if (world?.chunks?.length) {
    tileMap.render(world)
    waterPositions = tileMap.getWaterPositions()
    spawner.spawnAll(world)
    restoreWorldBuildings(world)
    if (world.treasureChests?.length > 0)
      treasureSpawner.restoreFromSnapshot(world.treasureChests)
  }
  for (const pData of Object.values(state.players ?? {})) upsertPlayerSprite(pData)
  if (myPlayerId) {
    const myPData = state.players[myPlayerId]
    Inventory.init(myPlayerId)
    const myInventory = myPData?.inventory ?? []
    Inventory.setInventory(myPlayerId, myInventory)
    EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: myInventory })
    hotbarUI.show(myInventory)
  }
}

// 僅 Host:把 nightCount / dayCount / dayTimeS 寫回 world(供 autosave)
function refreshWorldClockSnapshot(): void {
  if (RoomManager.role !== 'host') return
  const world = GameStateManager_.getWorld()
  world.nightCount = nightCount; world.dayCount = dayNight.currentDayCount; world.dayTimeS = dayNight.currentTimeS
}
```

---

## 4. 依世界座標找目標 / 互動射線

```typescript
// 半徑 TILE_SIZE*0.75 內、hp>0 的資源節點
function findNodeAtWorldPoint(wx, wy): ResourceNodeEntity | undefined
// 半徑 TILE_SIZE*0.75 內、存活的怪物
function findMonsterAtWorldPoint(wx, wy): MonsterEntity | undefined
```

### 互動射線(從原點射向選格,沿線取樣點)

```typescript
function getInteractionRayPoints(): Array<{x,y}> {
  const me = players.get(myPlayerId); if (!me) return []
  const origin = getInteractionOrigin(me)
  const target = selectedPoint.hasPointer
    ? { x: selectedPoint.x, y: selectedPoint.y }
    : { x: origin.x + selectedDir.dx*getInteractionRadius(),
        y: origin.y + selectedDir.dy*getInteractionRadius() }
  const dx=target.x-origin.x, dy=target.y-origin.y, len=Math.hypot(dx,dy)
  if (len<=0) return [origin]
  const steps = Math.max(1, Math.ceil(len/(TILE_SIZE/4)))  // 每 ¼ 格一個取樣點
  // 回傳 i=1..steps 的內插點(不含原點)
}

// 矩形含 pad=6px 命中測試
function isPointInBuilding(point, building): boolean
// 沿射線取樣,找第一個符合 predicate 且被點到的建築
function findPointedBuilding(predicate): Building | undefined
// 沿射線取樣,半徑 TILE_SIZE*0.8 找寶箱
function findPointedChest(): ...
```

`InteractionPrompt` 型別:`{ key, code, action, targetType:'building'|'chest'|'resource'|'dungeon', targetId, worldX, worldY }`。

```typescript
function makeBuildingPrompt(building, key, code, action): InteractionPrompt
// worldX/Y = 建築中心
```

### 互動提示優先順序(`getCurrentInteractionPrompt`)

放置中或無玩家 → null。否則:

1. **遺跡內**:靠近出口 → 「離開遺跡」(E);靠近遺跡寶箱(R=2 格) → 「開遺跡寶箱」(E)
2. **指向寶箱且未開** → 「開寶箱」(**R 鍵**)
3. **指向特殊建築**(E 鍵):`furnace`→用熔爐、`market`→開市場、`research_lab`→工作站、`base_core`→看核心、`barracks`→看兵營、`goddess_statue`→祈禱
4. **指向損壞陷阱**(`spike/fire/ice_trap` 且 hp≤0) → 「修復陷阱」(R 鍵)
5. 否則 null(採集已改用滑鼠左鍵,資源節點不顯示提示)

---

## 5. 採集 / 攻擊(滑鼠)

### 採集節點

```typescript
function tryHarvestNode(node, playerId): boolean {
  const weapon = getWeaponDef(hotbarUI.activeItem?.itemId)
  const snap = node.getData()
  const afterHp = snap.hp - weapon.resDmg     // resDmg = 武器對資源傷害
  if (RoomManager.role === 'host') {
    node.hit(weapon.resDmg, playerId)
    if (afterHp <= 0) _grantHarvestXP(playerId, snap.type, node.x, node.y)
    else NetworkHost.broadcast({ type:'state_delta', delta:{ resources:{[node.id]:{hp:Math.max(0,afterHp)}} } })
  } else {
    NetworkClient.send({ type:'input', playerId, input:{type:'harvest', targetId:node.id, damage:weapon.resDmg} })
  }
  return true
}
function tryHarvestAtPointer(): boolean {
  if (!myPlayerId || placingDefId) return false
  const node = findNodeAtWorldPoint(selectedPoint.x, selectedPoint.y)
  if (!node) { flashSelectorInvalid(); return false }
  return tryHarvestNode(node, myPlayerId)
}
```

### 攻擊(滑鼠)

```typescript
function tryAttackAtPointer(): boolean {
  if (!myPlayerId || placingDefId) return false
  const me = players.get(myPlayerId); if (!me) return false

  if (inDungeon) {  // 遺跡怪不在世界怪清單,需單獨打
    const weapon2 = getWeaponDef(hotbarUI.activeItem?.itemId)
    if (now2 - lastAttackMs < weapon2.cooldown) return false
    const de = dungeonScene.findNearbyEnemy(me.x, me.y, TILE_SIZE*3); if (!de) return false
    lastAttackMs = now2
    const killed = dungeonScene.hitEnemy(de.id, weapon2.damage)
    fxLayer.spawnFloatingText(de.x, de.y-20, `-${weapon2.damage}`, killed?0xffff00:0xff8888)
    if (killed) { pdK.xp += 20; ... }   // 殺遺跡怪 +20 XP(本機直接改 GameState)
    return true
  }

  if (!findMonsterAtWorldPoint(selectedPoint.x, selectedPoint.y)) return false
  const weapon = getWeaponDef(hotbarUI.activeItem?.itemId)
  if (now - lastAttackMs < weapon.cooldown) return false
  const aim = getAimDir(me)
  lastAttackMs = now
  if (RoomManager.role === 'host') {
    const origin = getInteractionOrigin(me)
    _doAttack(myPlayerId, origin.x, origin.y, aim.dx, aim.dy, weapon.damage, weapon.range, weapon.arc)
  } else {
    NetworkClient.send({ type:'input', ..., input:{type:'attack', dirX:aim.dx, dirY:aim.dy, damage:weapon.damage, range:weapon.range, arc:weapon.arc} })
  }
  fxLayer.spawnFloatingText(...)   // fist/weapon 文字
  return true
}
```

### Canvas 事件監聽

```typescript
// pointermove:更新選格;放置中則對齊格子並依 canPlace tint 綠/紅
app.canvas.addEventListener('pointermove', e => {
  updateSelectedPointFromPointer(e.clientX, e.clientY)
  if (!placingDefId) return
  const {x,y}=screenToWorld(...); const sx=Math.floor(x/TILE_SIZE)*TILE_SIZE; ...
  ghost.x=sx; ghost.y=sy
  ghost.tint = buildingSystem.canPlace(placingDefId, sx, sy, myPlayerId) ? 0x88ff88 : 0xff6666
})

// contextmenu(右鍵):若 active item = 'grenade' → throwGrenade(world座標);否則只 preventDefault
app.canvas.addEventListener('contextmenu', e => { e.preventDefault(); ... })

// pointerdown 左鍵:
//   - swingHeldTool()(揮動動畫)
//   - 非放置模式:先 tryAttackAtPointer(),否則 tryHarvestAtPointer()
//   - 放置模式:遺跡內禁止建築(提示後 cancel);否則對齊格 + canPlace,Host 直接 place+廣播 / Client 送 input,最後 cancelPlacement()
app.canvas.addEventListener('pointerdown', e => { if (e.button!==0) return; ... })

// pointerleave:clearSelectedPoint()
```

---

## 6. UI 回呼(每個都有 Host/Client 分支)

通用模式:Host 直接改 `GameStateManager_` / `Inventory` 並 `NetworkHost.broadcast(state_delta)`;Client 改本機後 `NetworkClient.send(input)`。

### 製作 / 背包重排

- `craftingUI.setOnCraft((recipeId, qty))`:迴圈 `canCraft`→`craft`,完後用 `researchLevel` 重刷 craftingUI。
- `inventoryUI.setOnReorder(newInv)`:設背包、emit `inventory:changed`、Host 廣播。

### 熔爐冶煉(3:1 / 金幣 1:1)

```typescript
furnaceUI.setOnSmelt((recipe, amount) => {
  const SMELT = {
    iron:      { oreId:'iron', ingotId:'ingot',      ratio:3, isCurrency:false }, // 鐵礦→鐵錠 3:1
    gold:      { oreId:'gold', ingotId:'gold_ingot', ratio:3, isCurrency:false }, // 金礦→金錠 3:1
    gold_coin: { oreId:'gold', ingotId:'gold_coin',  ratio:1, isCurrency:true  }, // 金礦→金幣 1:1
  }
  const def = SMELT[recipe]
  const oreAvail = 背包礦數
  const maxIngots = Math.floor(oreAvail / def.ratio)
  const actual = Math.min(amount, maxIngots)         // 不夠 → 提示 need_ore
  const oreConsumed = actual * def.ratio
  Inventory.remove(oreId, oreConsumed)
  if (def.isCurrency) pd.gold += actual               // 金幣加進 pd.gold
  else Inventory.add(ingotId, actual)
  // floatingText + hotbar 刷新 + Host 廣播(inventory,gold) / Client send furnace_smelt
})
```

### 市場賣 / 買

```typescript
marketUI.setOnSell((itemId, amount) => {
  const actual = Math.min(amount, 背包量)             // <=0 → market_not_enough
  const goldEarned = marketPricing.calculateGold(itemId, actual)   // 賣價由 marketPricing 計
  Inventory.remove(itemId, actual)
  pd.gold += goldEarned
  // floatingText + hotbar/market 刷新 + Host 廣播 / Client send market_sell
})

const MARKET_BUY_PRICE = 100_000                       // 每日設計圖特賣固定價
marketUI.setOnBuy((itemId) => {
  if (pd.gold < MARKET_BUY_PRICE) { showUIToast('gold_insufficient'); return }
  pd.gold -= MARKET_BUY_PRICE
  Inventory.add(itemId, 1)
  // 刷新 + Host 廣播 / Client send market_buy(帶 price)
})
```

### 研究所升級

```typescript
researchUI.setOnUpgrade((toLevel) => {
  const upgradeCost = RESEARCH_UPGRADE_COSTS.find(c => c.level === toLevel)   // 含 materials/gold/durationSecs
  // 逐項檢查 materials + gold,任一不足 → showUIToast 後 return
  // 扣材料 + 扣金幣;researchLevel 一律 +1(不管選哪條路線)
  pd.researchLevel = (pd.researchLevel ?? 1) + 1
  researchUI.setUpgradeProgress(upgradeCost.durationSecs)
  // Host 廣播(researchLevel,gold,inventory) / Client send research_upgrade
})
```

### 基地核心 / 兵營升級(同邏輯)

```typescript
baseCoreUI.setOnUpgrade((buildingId) => { ... })
barracksUI.setOnUpgrade((buildingId) => { ... })
// Host:buildingSystem.upgrade() → 成功則 floatingText + 廣播 {buildings:{[id]:{level,hp,maxHp}}};失敗 showUIToast('upgrade_max_or_no_mat')
// Client:send build_upgrade
```

### 拆除確認按鈕(`#demolish-ok`)

```typescript
// 無 target/玩家 → 關面板 return
// Host:buildingSystem.demolish(tid) → 退還每項成本 ceil(amount*0.75);floatingText;廣播 {demolishedBuildings:[tid]}
// Client:send demolish_building
```

---

## 7. 鍵盤輸入(`window.keydown` 大型處理器)

### 按鍵 → 行為對照表

| 按鍵 (e.code) | 行為 |
| --- | --- |
| `KeyW`/`ArrowUp` | `inputState.up=true`;`selectedDir={0,-1}` |
| `KeyS`/`ArrowDown` | `inputState.down=true`;`selectedDir={0,1}` |
| `KeyA`/`ArrowLeft` | `inputState.left=true`;`selectedDir={-1,0}` |
| `KeyD`/`ArrowRight` | `inputState.right=true`;`selectedDir={1,0}` |
| `Escape` | 關閉所有面板(inventory/crafting/building/furnace/baseCore/barracks/map/demolish)、`cancelPlacement()`、`demolishTargetId=null` |
| `KeyQ` | `questUI.toggle()` |
| `Backspace`/`Delete` | 拆除「最近的建築」(半徑 `TILE_SIZE*2.5`,排除 `chest`/`wooden_bridge`),開啟拆除確認面板(顯示退還 75% 預覽) |
| `KeyE` | **互動主鍵**(見下方詳解) |
| `KeyF`/`Space` | 攻擊(格子式;遺跡內優先打遺跡怪) |
| `KeyR` | 寶箱 > 修復陷阱 > 手電筒 > 食物(見下方詳解) |
| `KeyU` | 解鎖附近鎖定島嶼 |
| `KeyG`(非 Ctrl) | 裝備/卸下快捷欄選中的防具 |
| `KeyM` | 切換地圖覆蓋層(開啟時 `renderMap()`) |

> 多數動作開頭都檢查 `if (!myPlayerId || placingDefId) return`(放置中不互動)。

`keyup` 只把對應的 `inputState.{up,down,left,right}` 設回 false。

### E 鍵互動順序(`KeyE`)

依序判斷,命中即 return:

1. **遺跡內**:靠近出口 → `_exitDungeon()`;靠近遺跡寶箱(R=2 格)→ `dungeonScene.openChest()`,金幣加 `pd.gold`、品級掉落物進背包(rarity 色:common 0xc9a468 / rare 0x6fa8ff / epic 0xffec80)。
2. **世界中手持 `dungeon_map`**:扣 1 張地圖,`instanceSeed = (Date.now() ^ random) >>> 0`,`_enterDungeon(seed, x, y)`。
3. **熔爐**(指向 `furnace`):讀鐵/金數量 → `furnaceUI.show(iron, gold)`。
4. **市場**(`market`):`marketUI.show(inv, gold, dayCount)`。
5. **工作站**(`research_lab`):`researchUI.show(currentLevel)`。
6. **基地核心**(`base_core`):`baseCoreUI.show(id, level, inv)`。
7. **兵營**(`barracks`):`barracksUI.show(id, level, inv)`。
8. **床**(手持 `bed`,見下方「彈到外太空」)。
9. **女神像**(`goddess_statue`,見下方祈禱)。

#### 床「彈到外太空」(夜晚才有效)

```typescript
if (activeItemForBed === 'bed') {
  if (dayNight.isNight) {
    // 1) 噴掉背包所有物品(bed 除外),散布在 ±TILE_SIZE*8 範圍
    // 2) 清空背包,玩家 y -= 5000(飛上太空),fxText('bed_launched')
    // 3) dayNight.skipToMorning()
    // 4) setTimeout 1500ms:墜回原地(bed_crash)
    //    再 setTimeout 500ms:死亡 → 傳回重生點(world.spawnX/Y 或 WORLD_CONFIG.CENTER),hp 回滿
  } else {
    fxText('daytime_now')   // 白天無效
  }
  return
}
```

#### 女神像祈禱(冷卻 3 分鐘)

```typescript
const COOLDOWN_MS = 3*60*1000
const lastPray = goddessCooldowns.get(statue.id) ?? 0
if (now - lastPray < COOLDOWN_MS) { 顯示剩餘秒數; return }
goddessCooldowns.set(statue.id, now)
if (RoomManager.role === 'host') _goddessPray(statue.x+TILE_SIZE/2, statue.y+TILE_SIZE/2)
else { NetworkClient.send({input:{type:'pray', statueId, cx, cy}}); fxText('praying') }
```

### F / Space 攻擊

```typescript
const weapon = getWeaponDef(hotbarUI.activeItem?.itemId)
if (now - lastAttackMs < weapon.cooldown) return
lastAttackMs = now
if (inDungeon) { 打 dungeonScene.findNearbyEnemy(3 格) → hitEnemy;殺死 +20 XP;return }
const aim = getAimDir(me)
if (RoomManager.role === 'host') _doAttack(myPlayerId, origin.x, origin.y, aim.dx, aim.dy, weapon.damage, weapon.range, weapon.arc)
else NetworkClient.send({input:{type:'attack', dirX, dirY, damage, range, arc}})
// 本地 fxText(fist/weapon)
```

### R 鍵(優先級:寶箱 > 修復陷阱 > 手電筒 > 食物)

```typescript
// 1) 開附近寶箱(findPointedChest,優先級最高)
const nearbyChest = findPointedChest()
if (nearbyChest) {
  if (!openedChests.has(id)) {
    const loot = treasureSpawner.openChest(id)   // 發 treasure:opened
    openedChests.add(id)
    // 每項掉落物 spawnHarvest + floatingText
    treasureSpawner.removeChest(id)
    (world).treasureChests = treasureSpawner.getAllChestsData()   // 更新快照供 autosave
    if (Host) broadcast { openedChests: Array.from(openedChests) }
  }
  return
}
// 2) 修復損壞陷阱(spike/fire/ice_trap 且 hp<=0)
const nearbyTrap = findPointedBuilding(b => 三種陷阱 && b.hp<=0)
if (nearbyTrap) {
  if (buildingSystem.repair(myPlayerId, id)) { fxText('trap_repair_done'); Host 廣播 {buildings:{[id]:{hp}}} }
  else fxText('trap_repair_no_mat')
  return
}
// 3) 手電筒開關(手持 flashlight)
if (active === 'flashlight') { flashlightOn = !flashlightOn; fxText(on/off); return }
// 4) 食物模式(連按咬食)
const foodDef = FOOD_DEFS[active]
if (foodDef) {
  if (lastFoodItemId !== active) { foodBiteCount=0; lastFoodItemId=active }  // 切食物重置
  foodBiteCount++
  if (foodBiteCount >= foodDef.bites) {   // 咬滿次數才真正吃掉
    if (Inventory.remove(active,1)) { pd.hunger = min(100, hunger + foodDef.hungerRestore); fxText('+X 🍖') }
    else fxText('no_food')
    foodBiteCount = 0
  } else fxText(`${icon} ${foodBiteCount}/${foodDef.bites}`)
  return
}
```

### U 鍵:解鎖島嶼

```typescript
const unlocked = world.unlockedIslands ?? ['0,0']
const nearby = WorldGen.findNearbyLockedIsland(me.x, me.y, new Set(unlocked))
if (!nearby) { fxText('no_nearby_island'); return }
if (myData.gold < nearby.cost) { fxText('island_need_gold'); return }
if (Host) _unlockIsland(myPlayerId, nearby.ix, nearby.iy)
else NetworkClient.send({input:{type:'unlock_island', ix, iy}})
```

### G 鍵:裝備/卸下防具

```typescript
const armorDef = getArmorDef(active.itemId)
if (!armorDef) fxText('cant_equip')
else if (pd.equipped?.armor === active.itemId) {  // 同件 → 卸下
  pd.equipped = { armor:null }; Inventory.add(active,1); equipUI.clearArmor()
} else {  // 換裝
  if (prevArmor) Inventory.add(prevArmor,1)        // 退回舊防具
  Inventory.remove(active,1); pd.equipped = { armor:active.itemId }
  equipUI.updateArmor(active.itemId, icon, armorDef.name, armorDef.defPct)
}
```

---

## 8. Host 端權威動作

### `_doAttack`(格子式判定)

只在 Host 跑。把世界座標換成格座標,以「玩家格 + 面向方向 1..range 格 + 各深度的側格(由 arc 決定)」組成命中格集合,凡是落在命中格的怪物都受傷。

```typescript
function _doAttack(attackerId, ax, ay, dirX, dirY, damage, range, arc): void {
  const T = TILE_SIZE
  const ptx = Math.floor(ax/T), pty = Math.floor(ay/T)   // 玩家中心所在格
  const perpX = -dirY, perpY = dirX                       // 垂直方向(旋轉 90°)
  const arcSide = arc <= 90 ? 0 : arc <= 200 ? 1 : 2      // 弧度 → 側格數

  const hitTiles = new Set<string>()
  const addTile = (tx,ty) => hitTiles.add(`${tx},${ty}`)

  addTile(ptx, pty)                                        // 玩家自己的格
  for (let s=1; s<=arcSide; s++) {                         // 玩家格的側格(寬弧)
    addTile(ptx+perpX*s, pty+perpY*s); addTile(ptx-perpX*s, pty-perpY*s)
  }
  for (let i=1; i<=range; i++) {                           // 面向方向 1..range
    const fx=ptx+dirX*i, fy=pty+dirY*i; addTile(fx, fy)
    for (let s=1; s<=arcSide; s++) {                       // 每深度的側格
      addTile(fx+perpX*s, fy+perpY*s); addTile(fx-perpX*s, fy-perpY*s)
    }
  }
  for (const m of monsterSpawner.getAllMonsters()) {       // 命中格內的怪物受傷
    if (hitTiles.has(`${Math.floor(m.x/T)},${Math.floor(m.y/T)}`))
      monsterSpawner.hitMonster(m.id, damage, attackerId)
  }
}
```

> arc → 側格:`<=90` → 0(直線一格寬)、`<=200` → 1(±1 側格)、其餘 → 2(±2 側格)。

### `_unlockIsland`(Host)

```typescript
function _unlockIsland(playerId, ix, iy): void {
  const key = `${ix},${iy}`; if (unlocked.includes(key)) return
  const ring = Math.max(Math.abs(ix), Math.abs(iy))
  const cost = ISLAND_UNLOCK_COST[ring] ?? 9999     // 依環數查價
  if (pd.gold < cost) { fxText('island_need_gold_unlock'); return }
  pd.gold -= cost
  const newUnlocked = new Set([...unlocked, key])
  const newWorld = WorldGen.generate(world.seed, newUnlocked, difficulty)
  newWorld.buildings = world.buildings ?? []        // 保留建築
  const existingIds = new Set(現存節點 ID)
  tileMap.render(newWorld); waterPositions = tileMap.getWaterPositions()
  for (const res of newWorld.resources) if (!existingIds.has(res.id)) spawner.spawnOne(res).playRespawnAnim()  // 只生新島節點
  newWorld.treasureChests = treasureSpawner.getAllChestsData()
  treasureSpawner.spawnForIsland(newWorld, ix, iy)  // 為新島加寶箱
  newWorld.treasureChests = treasureSpawner.getAllChestsData()
  GameStateManager_.setWorld(newWorld)
  // 視覺回饋(島中心 island_unlocked / -cost)
  // 廣播金幣 state_delta + 整份 state_full(因世界重生)
}
```

### `_goddessPray`(Host)

```typescript
function _goddessPray(cx, cy): void {
  if (RoomManager.role !== 'host') return
  const PRAY_R = 5*TILE_SIZE
  const target = 10 + Math.floor(Math.random()*6)   // 10–15 個節點
  // 最多嘗試 target*10 次:角度隨機、距離 TILE_SIZE*1.5 + random*PRAY_R
  //   - 只在 'grass' 格生成
  //   - 與既有節點距離 < TILE_SIZE*1.6 則跳過
  //   - resType = pickResourceForSpawn(ringAtWorld(nx,ny),'grass') ?? 'tree'
  //   - 從 RESOURCE_CONFIG 取 hp/respawnTime,spawner.spawnOne + playRespawnAnim
  //   - 寫入 world.resources 與 newResources
  // 若有新節點 → 廣播 state_delta { resources: newResources }
  // fxText('goddess_arrived' / 'goddess_spawned' count)
}
```

---

## 9. 本段 helper 函式清單(簽章 + 用途)

```
startPlacement(defId)                                建立放置 ghost 並進入放置模式
cancelPlacement()                                    退出放置模式、清游標
screenToWorld(clientX, clientY)                      螢幕座標→世界座標(含 camera/縮放)
flashSelectorInvalid()                               觸發選格無效閃紅(140ms)
getInteractionRadius()                               互動半徑 = TILE_SIZE * max(1, playerReach)
getPlayerCollisionCenter(x, y)                       sprite 原點→碰撞中心(y+8)
isBlockedByWaterAt(x, y)                             5 取樣點是否任一在水上
isMovementBlockedAt(x, y)                            水/節點/建築/寶箱任一阻擋
getInteractionOrigin(me)                             互動射線/攻擊的起點(=碰撞中心)
getAimDir(me)                                        瞄準四向化(指標優先,否則 selectedDir)
updateSelectedPointFromPointer(clientX, clientY)     依指標更新選格(clamp 半徑)+同步 selectedDir
clearSelectedPoint()                                 selectedPoint.hasPointer = false
assignPlayerSprites(state?)                          依 hostId/字典序指派 spriteId
upsertPlayerSprite(pData)                            新建/更新/重建玩家 sprite
restoreWorldBuildings(world)                         逐一 restoreBuilding
syncClientFullState(state)                           Client 收 state_full 全量還原
refreshWorldClockSnapshot()                          (Host)世界時鐘寫回 world
normalizeMove(dx, dy)                                移動向量正規化
findNodeAtWorldPoint(wx, wy)                          0.75 格內存活資源節點
findMonsterAtWorldPoint(wx, wy)                       0.75 格內存活怪物
getInteractionRayPoints()                            原點→選格的取樣點陣列
isPointInBuilding(point, building)                   點是否落在建築矩形(pad 6)
findPointedBuilding(predicate)                        沿射線找符合條件的建築
findPointedChest()                                   沿射線找寶箱(0.8 格)
makeBuildingPrompt(building, key, code, action)      組 InteractionPrompt(中心座標)
getCurrentInteractionPrompt()                        當前互動提示(優先序見上)
tryHarvestNode(node, playerId)                        對節點採集(Host 算/Client 送)
tryAttackAtPointer()                                 滑鼠攻擊(含遺跡分支)
tryHarvestAtPointer()                                滑鼠採集入口(無節點則閃紅)
_doAttack(attackerId, ax, ay, dirX, dirY, damage, range, arc)  (Host)格子式攻擊判定
_unlockIsland(playerId, ix, iy)                       (Host)扣金幣、重生世界、保留建築/節點、補新島
_goddessPray(cx, cy)                                  (Host)在半徑 5 格的草地補 10–15 個資源節點
```

事件監聽:`pointermove` / `contextmenu` / `pointerdown` / `pointerleave`(canvas);`keydown` / `keyup`(window);各 UI 的 `setOn*` 回呼;`#demolish-ok` click。

---

## 10. 重建提示 / 易踩雷

- **Host vs Client 權威**:`_doAttack`、`_unlockIsland`、`_goddessPray` 與所有「直接改 GameState/Inventory + broadcast」分支只在 `RoomManager.role === 'host'` 跑;Client 一律改本機後 `NetworkClient.send({type:'input', ...})`,等 Host 回 delta 才是權威。每個 UI 回呼、採集、攻擊、建造、拆除都有這對 if/else,不可漏。
- **互動優先順序**:R 鍵的「開寶箱優先級最高」是刻意的(寶箱 > 修復陷阱 > 手電筒 > 食物),getCurrentInteractionPrompt 的順序也是(遺跡 > 寶箱 > E 建築 > 陷阱)。重建時務必照順序且命中即 `return`。
- **座標系**:`screenToWorld` 必須含 `getBoundingClientRect` 縮放修正 + `camera` 偏移 + `CAMERA_ZOOM`。互動/攻擊一律以 `getInteractionOrigin`(碰撞中心 = sprite y+8)為起點,**不是** sprite 原點。
- **瞄準 vs 選格**:`selectedPoint`(滑鼠,clamp 到互動半徑)與 `selectedDir`(鍵盤四向)。`getAimDir` 有指標用指標、否則用 selectedDir,且永遠回傳四向之一(格子攻擊需要)。`getInteractionRayPoints` 同樣 hasPointer 才用點、否則沿 selectedDir 射出一個互動半徑長。
- **格子式攻擊**:`_doAttack` 用 `Set<"tx,ty">` 命中格,arc→側格映射是 `90/200` 兩個門檻(0/1/2 側格)。怪物以其格座標查表受傷,**不是**圓形/扇形距離判定。
- **熔爐 3:1**:鐵礦→鐵錠、金礦→金錠 都是 `ratio:3`;金礦→金幣是 `ratio:1` 且 `isCurrency`(加到 `pd.gold`,不進背包)。`actual = min(amount, floor(oreAvail/ratio))`。
- **金錢**:市場賣價 `marketPricing.calculateGold`;買固定 `MARKET_BUY_PRICE = 100_000`;拆除退還 `ceil(cost*0.75)`;島嶼解鎖 `ISLAND_UNLOCK_COST[ring]`(ring = max(|ix|,|iy|))。
- **`_unlockIsland` 會 `state_full` 全量廣播**(因為世界被重新 generate),且必須保留 `buildings` 與用 ID 過濾既有節點/寶箱,否則玩家建築/資源會被洗掉。
- **女神像冷卻**用 `goddessCooldowns` Map(per statueId)在「本機/觸發端」擋,COOLDOWN 3 分鐘;Client 端也會先擋再送 input。
- **遺跡(inDungeon)特殊**:遺跡怪不在 `monsterSpawner` 清單,F/Space 與滑鼠攻擊都要走 `dungeonScene.findNearbyEnemy/hitEnemy`(3 格);遺跡內禁止放置建築;遺跡寶箱/出口用 `dungeonScene` 介面。
- **placingDefId 守衛**:幾乎所有互動開頭 `if (!myPlayerId || placingDefId) return`,放置模式下不採集/攻擊/互動。
- **食物咬食**:`foodBiteCount` 累加到 `foodDef.bites` 才真正消耗 1 個並回 `hungerRestore`;切換食物 itemId 會重置計數。
- **床彈太空**用兩層 `setTimeout`(1500ms 墜落 → 500ms 死亡重生),且只在 `dayNight.isNight` 有效,會清空背包(bed 除外)散落地面。
