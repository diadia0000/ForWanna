# main.ts 重建參考 05：難度 Modal、開始遊戲、存檔還原、網路事件

> 涵蓋 src/main.ts 第 3541–4031 行

本段是 `bootstrap()` 的**收尾段**：難度選擇 Modal、`startGame()` 主流程（Host 生成世界 / Client 等待同步）、各種存檔還原、樹木再生節流、所有 `window` 網路事件監聽、`i18n:changed` 重繪，以及最後的 `bootstrap()` 呼叫。

---

## 0. 本段所用到的外部作用域變數（在 bootstrap 前段宣告）

| 變數 | 宣告處 | 用途 |
| --- | --- | --- |
| `currentDifficulty: Difficulty = 'normal'` | L203 | 當前難度，給 monsterSpawner / WorldGen 用 |
| `nightCount = 0` | L204 | 累計夜晚數，會從存檔還原 |
| `myPlayerId = ''` | L370 | 本機玩家 id（執行期用 PeerJS id） |
| `currentMapName: string \| null = null` | L381 | 當前存檔槽名稱，供 `save:request` 使用 |
| `waterPositions` | L2876 | tileMap 算出的水域座標清單 |

執行期常用的 helper（前段定義，這段大量呼叫）：
- `assignPlayerSprites(state?)`（L1277）：把 state.players 的外觀/顏色套到 sprite。
- `upsertPlayerSprite(pData)`（L1294）：建立或更新單一玩家 sprite。
- `syncClientFullState(state)`（L1319）：Client 端套用完整 state（世界/玩家/背包等）。
- `_renderMapLegend()` / `_renderReconnectOverlay()` / `_renderDemolishPanel()`（L238/L157/L656）：main.ts 自己持有的常駐 UI 文字重繪。

---

## 1. 難度選擇 Modal — `selectDifficulty(): Promise<Difficulty>`

Host 開**全新地圖**前顯示。回傳 Promise，使用者點按鈕後 resolve 成 `'easy' | 'normal' | 'hard'`。

- 全螢幕半透明遮罩（`z-index:900`），中央綠色 box。
- 三顆按鈕用 `data-d` 屬性帶難度值（`easy` / `normal` / `hard`），點擊時 `removeChild(modal)` 後 resolve。
- 文案全走 i18n：`game.difficulty_title`、`game.difficulty_desc`、`game.difficulty_easy(_sub)` 等。
- 內嵌 `diffBtnStyle(bg, hover)` 產生按鈕樣式（hover 參數實際未用於樣式，hover 效果靠 mouseenter/leave 改 `filter`）。

```typescript
function selectDifficulty(): Promise<Difficulty> {
  return new Promise(resolve => {
    const modal = document.createElement('div')
    // ...遮罩 + box innerHTML（三顆 data-d 按鈕）...
    box.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mouseenter', () => (btn as HTMLElement).style.filter = 'brightness(1.25)')
      btn.addEventListener('mouseleave', () => (btn as HTMLElement).style.filter = '')
      btn.addEventListener('click', () => {
        document.body.removeChild(modal)
        resolve((btn as HTMLElement).dataset.d as Difficulty)
      })
    })
    modal.appendChild(box)
    document.body.appendChild(modal)
  })
}
```

---

## 2. 開始遊戲 — `startGame(role, mapName = null, playerName?)`

簽名：`async function startGame(role: 'host' | 'client', mapName: string | null = null, playerName?: string)`

開頭共通：
```typescript
lobby.hide()
hud.show()
hotbarUI.show(myPlayerId ? Inventory.get(myPlayerId) : [])
currentMapName = mapName   // 提升到 bootstrap 作用域供 save:request 使用
```

### 2A. Host 分支（`role === 'host'`）

世界生成/載入順序（**順序很重要**）：

```typescript
myPlayerId = RoomManager.myId

// mapName = null → 全新地圖；有值 → 載入指定存檔
let world = mapName ? await SaveManager.loadWorld(mapName) : null

// 舊存檔遷移：缺 unlockedIslands 欄位 → 視為舊世界重新生成
if (world && !(world as any).unlockedIslands) {
  currentDifficulty = 'normal'
  world = WorldGen.generate(world.seed, new Set(['0,0']), currentDifficulty)
  if (!currentMapName) currentMapName = `world_${world.seed}`
  await SaveManager.saveWorld(world, currentMapName)
}

if (!world) {
  // 全新地圖 → 顯示難度 modal
  currentDifficulty = await selectDifficulty()
  world = WorldGen.generate(
    Math.floor(Math.random() * 999999),
    new Set(['0,0']),
    currentDifficulty,
  )
  currentMapName = `world_${world.seed}`     // 以 seed 命名存檔槽
  await SaveManager.saveWorld(world, currentMapName)
} else {
  currentDifficulty = ((world as any).difficulty as Difficulty) ?? 'normal'
}

monsterSpawner.setDifficulty(currentDifficulty)

GameStateManager_.setWorld(world)
GameStateManager_.get().hostId = myPlayerId
```

玩家存檔載入（**每個世界進度獨立**，key 為 `stableId__seed`）：
```typescript
const worldPlayerKey = `${stableId}__${world.seed}`
let myData = await SaveManager.loadPlayer(worldPlayerKey)
if (!myData) {
  // 此世界無存檔 → 新玩家，只沿用名稱/外觀，進度歸零
  const localPlayer = SyncProtocol.getLocalPlayer()
  const baseName = (playerName ?? localPlayer?.name ?? t('game.default_player_name')).replace(/^👑\s*/, '')
  myData = SyncProtocol.createNewPlayer('👑 ' + baseName)   // Host 冠上 👑
  if (localPlayer?.color != null) myData.color = localPlayer.color
  myData.x = (world as any).spawnX ?? WORLD_CONFIG.CENTER_X
  myData.y = (world as any).spawnY ?? WORLD_CONFIG.CENTER_Y
  ;(myData as any).hunger = 100
  // 清掉上一個世界殘留在記憶體的背包箱
  for (const k of Object.keys(smallBagContents)) delete smallBagContents[k]
  for (const k of Object.keys(largeBagContents)) delete largeBagContents[k]
}
;(myData as any).hunger = (myData as any).hunger ?? 100
myData.id = myPlayerId   // 執行期以 PeerJS id 當 key
GameStateManager_.setPlayer(myPlayerId, myData)
assignPlayerSprites()
```

背包 / 背包箱 / 裝備還原：
```typescript
Inventory.init(myPlayerId)
const hostInventory = myData.inventory ?? []
Inventory.setInventory(myPlayerId, hostInventory)
EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: hostInventory })
hotbarUI.show(hostInventory)

// bag_small / bag_large
const savedBags = (myData as any)._bags
if (savedBags?.bag_small) Object.assign(smallBagContents, savedBags.bag_small)
if (savedBags?.bag_large) Object.assign(largeBagContents, savedBags.bag_large)

// 裝備欄顯示
const savedArmor = (myData as any).equipped?.armor as string | undefined
if (savedArmor) {
  const armorItemDef = ITEMS[savedArmor]
  const savedArmorDef = getArmorDef(savedArmor)
  if (armorItemDef && savedArmorDef) {
    equipUI.updateArmor(savedArmor, armorItemDef.icon, savedArmorDef.name, savedArmorDef.defPct)
  }
}
```

渲染與寶箱/夜晚/座標/建築還原（**這段順序是重建關鍵**）：
```typescript
// 1) 地圖渲染 + 水域 + 資源節點
tileMap.render(world)
waterPositions = tileMap.getWaterPositions()
spawner.spawnAll(world)

// 2) 寶箱：有存檔還原，沒有就生成並寫回 world，再 setWorld 讓 autosave 帶出
if ((world as any).treasureChests?.length > 0) {
  treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
} else {
  treasureSpawner.spawnAll(world)
  ;(world as any).treasureChests = treasureSpawner.getAllChestsData()
  GameStateManager_.setWorld(world)
}

// 3) 還原 nightCount + 日夜時間
if ((world as any).nightCount != null) nightCount = (world as any).nightCount
if ((world as any).dayCount != null || (world as any).dayTimeS != null) {
  dayNight.restore((world as any).dayCount ?? 1, (world as any).dayTimeS ?? 0)
}

// 4) 舊存檔座標可能卡水/卡寶箱/出界 → 強制移回中心島
{
  const safeX = (world as any).spawnX ?? WORLD_CONFIG.CENTER_X
  const safeY = (world as any).spawnY ?? WORLD_CONFIG.CENTER_Y
  const blockedByWater = isBlockedByWaterAt(myData.x, myData.y)
  const blockedByChest = treasureSpawner.isBlockedByChest(myData.x, myData.y, PLAYER_COLLISION_RADIUS)
  const offMap = tileMap.getTileAt(myData.x, myData.y, world) == null   // 出界
  if (blockedByWater || blockedByChest || offMap) {
    myData.x = safeX; myData.y = safeY
    GameStateManager_.setPlayer(myPlayerId, myData)
  }
}

// 5) 還原已放置的建築（重建 sprite）
for (const building of world.buildings ?? []) {
  buildingSystem.restoreBuilding(building)
}

// 6) 建立自己的 Player sprite
const mePlayer = new Player(myData)
players.set(myPlayerId, mePlayer)
playerLayer.addChild(mePlayer.sprite)
```

廣播與存檔節流：
```typescript
// 廣播完整 state 給所有已連線 client
NetworkHost.broadcast({ type: 'state_full', tick: GameStateManager_.get().tick, state: GameStateManager_.get() })

// 自動存檔：每 10 秒走 save:request
setInterval(() => EventBus.emit('save:request', {}), 10_000)

// 關鍵事件即時存檔（節流：最短 3 秒一次）
let lastEventSaveAt = 0
const requestEventSave = () => {
  const t = performance.now()
  if (t - lastEventSaveAt < 3000) return
  lastEventSaveAt = t
  EventBus.emit('save:request', {})
}
EventBus.on('player:died',       requestEventSave)
EventBus.on('build:placed',      requestEventSave)
EventBus.on('building:upgraded', requestEventSave)

// 初始寶箱狀態廣播（一般為空，保持結構一致）
if (openedChests.size > 0) {
  NetworkHost.broadcast({ type: 'state_delta', tick: GameStateManager_.get().tick,
    delta: { openedChests: Array.from(openedChests) } as any })
}
```

寶箱點擊（Host 直接打開）：
```typescript
treasureSpawner.setClickHandler((chestId: string) => {
  if (!openedChests.has(chestId)) {
    treasureSpawner.openChest(chestId)   // 發 'treasure:opened'，處理背包更新
    openedChests.add(chestId)
    treasureSpawner.removeChest(chestId)
    ;(GameStateManager_.getWorld() as any).treasureChests = treasureSpawner.getAllChestsData()
    NetworkHost.broadcast({ type: 'state_delta', tick: GameStateManager_.get().tick,
      delta: { openedChests: Array.from(openedChests) } as any })
  }
})
```

自然樹木再生（**Host only，每 50 秒一次，數值不可杜撰**）：
```typescript
setInterval(() => {
  if (RoomManager.role !== 'host') return
  const world = GameStateManager_.getWorld()
  if (!world?.chunks?.length) return
  if (Math.random() > 0.5) return        // 50% 機率略過

  const allTrees = spawner.getAllNodes().filter(n => n.getData().type === 'tree')
  if (allTrees.length === 0) return

  for (let tries = 0; tries < 15; tries++) {     // 最多嘗試 15 次找位置
    const parent = allTrees[Math.floor(Math.random() * allTrees.length)]
    const angle  = Math.random() * Math.PI * 2
    const dist   = (2.5 + Math.random() * 5) * TILE_SIZE   // 父樹周圍 2.5~7.5 格
    const nx = parent.x + Math.cos(angle) * dist
    const ny = parent.y + Math.sin(angle) * dist
    if (tileMap.getTileAt(nx, ny, world) !== 'grass') continue        // 只長在草地
    const tooClose = spawner.getAllNodes().some(n => Math.hypot(n.x - nx, n.y - ny) < TILE_SIZE * 1.8)
    if (tooClose) continue                                            // 太靠近其他節點
    const resType = pickResourceForSpawn(ringAtWorld(nx, ny), 'grass') ?? 'tree'
    const cfg   = RESOURCE_CONFIG[resType]
    const newId = `tree_nat_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const nodeData = { id: newId, type: resType, x: nx, y: ny, hp: cfg.hp, maxHp: cfg.hp, respawnTime: cfg.respawnTime }
    const newNode = spawner.spawnOne(nodeData)
    newNode.playRespawnAnim()
    world.resources = (world.resources ?? []).filter(r => r.id !== newId)
    world.resources.push(newNode.getData())
    NetworkHost.broadcast({ type: 'state_delta', tick: GameStateManager_.get().tick,
      delta: { resources: { [newId]: newNode.getData() } } })
    break   // 每次只長一棵樹
  }
}, 50_000)
```

### 2B. Client 分支（`else`）

不生成世界，改用 `state_full` 裡的資料初始化：
```typescript
const state = GameStateManager_.get()
syncClientFullState(state)
const world = state.world

if (world.chunks.length > 0) {
  tileMap.render(world)
  waterPositions = tileMap.getWaterPositions()
  spawner.spawnAll(world)
  // 寶箱：Host 已存入 world.treasureChests，Client 直接還原
  if ((world as any).treasureChests?.length > 0) {
    treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
  } else {
    treasureSpawner.spawnAll(world)
  }
  // 還原建築（去重：避免與 client:state_full 重建衝突）
  for (const b of world.buildings ?? []) {
    if (!buildingSystem.getAll().find(existing => existing.id === b.id)) {
      buildingSystem.restoreBuilding(b)
    }
  }
}

// Client 寶箱點擊：目前只 log（TODO：未來實作網路指令）
treasureSpawner.setClickHandler((chestId: string) => {
  console.log('Client clicked treasure:', chestId)
})

// 建立所有玩家 sprite（跳過 client:state_full 提前建好的，避免分身）
for (const pData of Object.values(state.players)) {
  if (!players.has(pData.id)) {
    const p = new Player(pData)
    players.set(pData.id, p)
    playerLayer.addChild(p.sprite)
  }
}

// 自己的背包：從 state_full 的 playerData 恢復
const myPData = state.players[myPlayerId]
Inventory.init(myPlayerId)
const clientInventory = myPData?.inventory ?? []
Inventory.setInventory(myPlayerId, clientInventory)
EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: clientInventory })
hotbarUI.show(clientInventory)
// 後續 state_full/delta 都透過 EventBus（NetworkClient 已處理）
```

---

## 3. 網路事件監聽（`window.addEventListener`）

### 3A. `client:state_delta` — Host 差分更新（最大宗）
依序處理 `msg.delta` 的各欄位：
- **`players`**：合併到 GameStateManager（`{ ...current, ...delta, id }`），`assignPlayerSprites()` + `upsertPlayerSprite()`。
  - 若 `playerId === myPlayerId && delta.inventory`：同步本地 `Inventory.setInventory` + 發 `inventory:changed`。
  - 若 `playerId === myPlayerId && role !== 'host'` 且 `hp` 從 >0 變成 ≤0：在自己頭上飄 `game.killed_respawning` 文字（紅 `0xFF4444`）。
- **`resources` / `removedResources`**：`spawner.applyResourceDelta(...)`。
- **`drops`**：`_spawnDropSprite(...)` + `fxLayer.spawnHarvest(...)`。
- **`removedDrops`**：移除 bob ticker、`sprite.destroy()`、`drops.delete()`。
- **`buildings`**：陣列 → 逐個 `restoreBuilding`；物件（patch） → `Object.assign(existing, patch)` 後 `restoreBuilding`。
- **`monsters`**（`role !== 'host'`）：`monsterSpawner.applyDelta(...)`。
- **`openedChests`**：逐個 `treasureSpawner.removeChest(chestId)`。
- **`demolishedBuildings`**：逐個 `buildingSystem.demolish(bid)`（只移 sprite，不退材料）。

### 3B. `client:player_list` — 玩家加入/離開
```typescript
window.addEventListener('client:player_list', (e) => {
  const list = (e as CustomEvent).detail as PlayerData[]
  for (const pData of list) GameStateManager_.setPlayer(pData.id, pData)
  assignPlayerSprites()
  const incomingIds = new Set(list.map(p => p.id))
  // 移除已斷線玩家（不在清單內，且非自己）
  for (const [pid, p] of players) {
    if (pid !== myPlayerId && !incomingIds.has(pid)) { p.destroy(); players.delete(pid) }
  }
  // 補建新加入玩家
  for (const pData of list) {
    if (!players.has(pData.id)) {
      upsertPlayerSprite(GameStateManager_.getPlayer(pData.id) ?? pData)
      Inventory.init(pData.id)
      if (pData.inventory?.length) Inventory.setInventory(pData.id, pData.inventory)
    }
  }
})
```

### 3C. `client:state_full` — Host 完整 state（⚠️ 含 dead code）
**重要**：handler 在 `syncClientFullState(state); return;` 後**還有一大段程式碼，因為前面的 `return` 而永遠不會執行（unreachable / dead code）**。重建時應保留語意：實際生效的只有 `syncClientFullState(state)`，後面那段渲染世界 / 還原寶箱 / 還原建築 / 建玩家 sprite 全部失效（功能已搬進 `syncClientFullState` 與 `startGame` 的 Client 分支）。

```typescript
window.addEventListener('client:state_full', (e) => {
  const state = (e as CustomEvent).detail
  syncClientFullState(state)
  return                                  // ← 之後全是 dead code（不會執行）
  // ─────── 以下 unreachable ───────
  const world = state.world
  if (!world?.chunks?.length) return
  tileMap.render(world)
  waterPositions = tileMap.getWaterPositions()
  spawner.spawnAll(world)
  if ((world as any).treasureChests?.length > 0) treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
  for (const b of world.buildings ?? []) {
    if (!buildingSystem.getAll().find(existing => existing.id === b.id)) buildingSystem.restoreBuilding(b)
  }
  for (const pData of Object.values(state.players)) {
    if (!players.has(pData.id)) { const p = new Player(pData); players.set(pData.id, p); playerLayer.addChild(p.sprite) }
  }
})
```

### 3D. `game:start` — 銜接 LobbyScreen → startGame
LobbyScreen 開始時 dispatch 此事件。handler 確定 `myPlayerId`，Host 設定房間碼/人數，再呼叫 `startGame`：
```typescript
window.addEventListener('game:start', (e) => {
  const detail = (e as CustomEvent).detail as {
    role: 'host' | 'client'; mapName?: string | null; playerName?: string; roomCode?: string
  }
  myPlayerId = RoomManager.myId
  if (detail.role === 'host' && detail.roomCode) {
    hud.setRoomCode(detail.roomCode)
    hud.setPlayerCount(1)   // 開始只有 Host 自己
  }
  startGame(detail.role, detail.mapName ?? null, detail.playerName)
})
```

---

## 4. i18n 重繪 — `EventBus.on('i18n:changed', ...)`
語言切換時重繪 main.ts 自己持有的常駐文字：
```typescript
EventBus.on('i18n:changed', () => {
  _renderMapLegend()
  _renderReconnectOverlay()
  _renderDemolishPanel()
  // minimap canvas 標題會在下次 renderMap() 自動套用，無須額外處理
})
```

---

## 5. 啟動呼叫
檔案最後一行（在 `bootstrap()` 函式外）：
```typescript
bootstrap()
```

---

## 6. 本段 helper / 事件 handler 清單

| 名稱 | 類型 | 用途 |
| --- | --- | --- |
| `selectDifficulty()` | helper（Promise） | Host 全新地圖前的難度選擇 Modal |
| `diffBtnStyle(bg, hover)` | 內嵌 helper | 難度按鈕樣式字串 |
| `startGame(role, mapName, playerName?)` | 主流程 | Host 生成世界 / Client 套用 state，完成所有還原 |
| `requestEventSave()`（Host 內） | 內嵌 helper | 關鍵事件存檔節流（3 秒） |
| `treasureSpawner.setClickHandler(...)` | callback | Host：直接開箱 + 廣播；Client：僅 log |
| `setInterval(... , 10_000)` | Host 計時器 | 每 10 秒自動存檔 |
| `setInterval(... , 50_000)` | Host 計時器 | 每 50 秒嘗試自然樹木再生 |
| `window 'client:state_delta'` | handler | 玩家/資源/掉落/建築/怪物/寶箱/拆除差分更新 |
| `window 'client:player_list'` | handler | 玩家加入補建、離線移除 |
| `window 'client:state_full'` | handler | `syncClientFullState` + **dead code（return 後不執行）** |
| `window 'game:start'` | handler | Lobby → startGame 銜接 |
| `EventBus.on('i18n:changed')` | handler | 重繪 map legend / reconnect overlay / demolish panel |
| `bootstrap()` | 呼叫 | 程式進入點 |

---

## 7. 重建提示 / 易踩雷

1. **啟動時序**：`bootstrap()`（檔尾）→ 內部建好所有系統與 UI、顯示 `lobby` → 使用者在 LobbyScreen 操作 → dispatch `window 'game:start'` → handler 設 `myPlayerId = RoomManager.myId` → `startGame(role, mapName, playerName)`。`startGame` 不會自己被呼叫，一律經由 `game:start`。

2. **Host / Client 開局路徑完全不同**：
   - Host：`WorldGen.generate` 或 `SaveManager.loadWorld` 取得世界 → 自己負責所有生成/還原 → `NetworkHost.broadcast({type:'state_full'})` 把世界推給 client。
   - Client：**不生成世界**，從 `GameStateManager_.get()`（已由 NetworkClient 填入 Host 的 state_full）取資料 → `syncClientFullState` → 只渲染與去重還原。Client 寶箱點擊目前是 no-op（只 log）。

3. **存檔還原順序很重要**（Host）：先 `tileMap.render` → `spawner.spawnAll` → 寶箱還原 → 夜晚/日夜還原 → **座標安全檢查（卡水/卡寶箱/出界才移回中心）** → 建築還原 → 建自己的 sprite。座標檢查必須在寶箱還原之後（要用 `isBlockedByChest`），且 `getTileAt == null` 代表出界也要移回中心，否則四周空白。

4. **myPlayerId 何時確定**：在 `game:start` handler 內先設一次（`RoomManager.myId`），Host 分支 `startGame` 開頭又設一次。執行期一律用 PeerJS id 當 key，`myData.id = myPlayerId` 會覆蓋存檔裡的舊 id。

5. **每世界進度獨立**：玩家存檔 key 是 `${stableId}__${world.seed}`，不是純 stableId。換世界時要清空記憶體裡的 `smallBagContents` / `largeBagContents`，否則背包箱會跨世界殘留。

6. **存檔槽命名**：全新地圖與舊存檔遷移都以 `world_${seed}` 命名，確保同一世界永遠對應同一槽位。難度從 `world.difficulty` 還原，缺值預設 `'normal'`。

7. **dead code 提醒**：`client:state_full` handler 的 `return` 之後整段 unreachable，重建時保留即可（不要誤以為它有作用），實際 Client 還原邏輯在 `syncClientFullState` + `startGame` 的 Client 分支。

8. **數值不可杜撰**：autosave 10 秒、事件存檔節流 3 秒、樹木再生 50 秒 + 50% 機率略過 + 最多 15 次嘗試 + 距離 `2.5~7.5*TILE_SIZE` + 最小間距 `TILE_SIZE*1.8` + 只長草地。
