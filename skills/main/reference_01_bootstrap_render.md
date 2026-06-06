# main.ts 重建參考 01：初始化、圖層、地圖、遺跡、特效

> 涵蓋 src/main.ts 第 78–581 行
> 此為 `bootstrap()` 巨函式的**開頭段**：建立 PixiJS app/圖層、視窗同步、系統實例化、全域可變狀態宣告、地圖/小地圖、遺跡進出、手榴彈/士兵、各 EventBus 接線。
> 所有後續段落（input、game loop、network、harvest 主流程等）都依賴此段宣告的閉包變數。

---

## 1. 初始化序列（順序不可動）

`bootstrap()` 是 `async`，開頭四步嚴格依序 await：

```typescript
async function bootstrap() {
  await initI18n()

  const app = await createApp()

  // 載入 Farm RPG sprites（失敗時靜默降級）
  await loadGameAssets()

  GameLoop.start(app)
```

順序理由：
1. `initI18n()` 先做 → 後面所有 `t(...)` 文案才有翻譯。
2. `createApp()` 回傳已 init 的 PixiJS `Application`（含 renderer/stage/screen）。
3. `loadGameAssets()` 失敗要靜默降級（不可 throw 中斷）。
4. `GameLoop.start(app)` 啟動 ticker。

---

## 2. 相機與圖層堆疊（核心 2.5D 結構）

所有世界物件都放進 `camera` 容器；移動/縮放 camera 即可平移與縮放整個世界。

```typescript
const { Container } = await import('pixi.js')
const CAMERA_ZOOM   = 1.5   // 縮放倍率：1.0 = 原尺寸，>1 放大（格子更大、視野更近）
const camera        = app.stage.addChild(new Container())
camera.scale.set(CAMERA_ZOOM)
const worldLayer    = camera.addChild(new Container())   // 底層：TileMap
const islandRingGfx  = camera.addChild(new PIXI.Graphics()) // 鎖定島嶼圓圈（tile 上、物件下）
// objectsLayer 啟用 Y 排序：資源、建築、玩家統一在此做深度排列（2.5D 遮擋）
const objectsLayer   = camera.addChild(new Container())
objectsLayer.sortableChildren = true
// 相容舊引用：resourceLayer / buildingLayer / playerLayer 全部指向 objectsLayer
const resourceLayer = objectsLayer
const buildingLayer = objectsLayer
const playerLayer   = objectsLayer
const dropLayer     = camera.addChild(new Container())   // 掉落物層（物件上方）

// ── 渲染層系統 ──
const fxLayer = new FxLayer(camera)   // 世界座標，跟著相機

// selectorLayer 最後加入，確保游標永遠在所有世界物件最上層
const selectorLayer  = camera.addChild(new Container())   // 採集游標（最上層）
const dayNight = new DayNight(        // 螢幕座標，在 stage 最上層
  app.stage, app.screen.width, app.screen.height
)
```

**加入 camera 的順序（決定 z 疊放，由下到上）：**
1. `worldLayer`（TileMap 底圖）
2. `islandRingGfx`（鎖定島嶼圓圈 Graphics）
3. `objectsLayer`（`sortableChildren = true`，資源/建築/玩家/士兵共用，靠 `zIndex` 做 Y 深度排序）
4. `dropLayer`（掉落物）
5. `fxLayer`（建構子內自行 add 到 camera）
6. `selectorLayer`（採集游標，最上層）

`dayNight` 直接掛在 `app.stage`（螢幕座標，不在 camera 內），故為**整個 stage 最上層**的全螢幕夜晚遮罩。

`resourceLayer` / `buildingLayer` / `playerLayer` 是 `objectsLayer` 的別名（相容舊引用）。

---

## 3. 視窗尺寸 / DPR 同步

```typescript
let lastDnW = app.screen.width
let lastDnH = app.screen.height
function syncViewportSize(): void {
  const dpr = window.devicePixelRatio || 1
  app.renderer.resize(window.innerWidth, window.innerHeight, dpr)
  dayNight.resize(app.screen.width, app.screen.height)
}
const scheduleViewportSync = () => {
  syncViewportSize()
  requestAnimationFrame(syncViewportSize)
}
window.addEventListener('resize', scheduleViewportSync)
new ResizeObserver(scheduleViewportSync).observe(document.documentElement)
```

- `lastDnW/lastDnH`：追蹤上次夜晚遮罩尺寸。Chrome 的瀏覽器縮放不一定觸發 `resize`，game loop 每幀比對這兩個值，尺寸一變就重撐夜晚遮罩（避免只蓋半邊畫面）。
- `syncViewportSize` 每次都重讀 `devicePixelRatio` 並傳給 `renderer.resize`：`resolution` 只在 `App.init` 讀一次，若不同步更新，canvas backing store 會與 CSS 尺寸不符（例如 25% 縮放載入後拉回 100% → 整個畫面糊掉）。
- `scheduleViewportSync` 同步呼叫一次 + 下一幀再呼叫一次（雙重保險）。

---

## 4. 鎖定瀏覽器縮放

縮放會讓 `window.innerWidth` 與 PIXI 內部尺寸不一致（夜晚遮罩半邊、解鎖圈錯位）。攔截縮放手勢，強制 100%；保留 Ctrl+0 當逃生門。

```typescript
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_'].includes(e.key)) {
    e.preventDefault()
  }
}, { passive: false })
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) e.preventDefault()
}, { passive: false })
// 觸控板雙指縮放（Safari/Chrome 的手勢事件）
window.addEventListener('gesturestart', (e) => e.preventDefault())
```

頁面離開時客戶端斷線：

```typescript
const notifyLeaveOnPageExit = () => {
  if (RoomManager.role === 'client') NetworkClient.disconnect()
}
window.addEventListener('pagehide', notifyLeaveOnPageExit)
window.addEventListener('beforeunload', notifyLeaveOnPageExit)
```

---

## 5. 信令斷線覆蓋層

```typescript
const reconnectOverlay = document.createElement('div')
reconnectOverlay.id = 'reconnect-overlay'
function _renderReconnectOverlay(): void {
  reconnectOverlay.innerHTML = `
    <div class="reconnect-box">
      <div class="reconnect-spinner"></div>
      <p>${t('game.reconnect_title')}</p>
      <p class="reconnect-sub">${t('game.reconnect_sub')}</p>
    </div>
  `
}
_renderReconnectOverlay()
reconnectOverlay.style.display = 'none'
document.body.appendChild(reconnectOverlay)
window.addEventListener('peer:signaling-lost',     () => { reconnectOverlay.style.display = 'flex' })
window.addEventListener('peer:signaling-restored', () => { reconnectOverlay.style.display = 'none' })
```

`peer:signaling-lost` 顯示（`flex`）、`peer:signaling-restored` 隱藏。

---

## 6. 各系統實例化

```typescript
const tileMap         = new TileMap()
const spawner         = new Spawner(resourceLayer)
const treasureSpawner = new TreasureSpawner(objectsLayer)
const openedChests    = new Set<string>()  // 追蹤已打開的寶箱 ID（用於廣播）
const buildingSystem  = new BuildingSystem(buildingLayer)
const craftingSystem = new CraftingSystem()
const players        = new Map<PlayerId, Player>()
const prediction     = new ClientPrediction()
const PLAYER_SPRITE_IDS = ['player', 'player.monk2', 'player.boy', 'player.eskimo'] as const

// ── 戰鬥 + 任務系統 ──
const monsterSpawner = new MonsterSpawner(objectsLayer)
const questSystem    = new QuestSystem()
const questUI        = new QuestUI(questSystem)

questSystem.setCompleteCallback(id => questUI.notifyComplete(id))
```

注意各系統建構子傳入的圖層：`Spawner(resourceLayer)`、`TreasureSpawner(objectsLayer)`、`BuildingSystem(buildingLayer)`、`MonsterSpawner(objectsLayer)`（皆等同 objectsLayer）。`questSystem` 完成回呼接到 `questUI.notifyComplete`。

---

## 7. 全域可變狀態變數（bootstrap 閉包，跨函式共享）

這些是後續所有 helper / game loop 讀寫的共享狀態。重建時務必都在此段宣告。

**戰鬥 / 視覺特效狀態：**
```typescript
let lastAttackMs   = 0
let lastNightState = false    // 偵測夜晚切換（計 nights）
// 魔法泡泡
let laserLastHitMs = 0
let laserOrbGfx: PIXI.Graphics | null = null
// 手電筒光束（世界座標，掛在 objectsLayer 上方）
let flashlightGfx: PIXI.Graphics | null = null
let flashlightOn = false   // 手電筒開關（持手電筒按 R 切換；切到其他格子仍維持）
let flashlightMask: PIXI.Graphics | null = null   // 形狀遮罩（光均勻、重疊不疊加）
// 女神像祈禱冷卻（buildingId → 最後祈禱時間 ms）
const goddessCooldowns = new Map<string, number>()
```

**難度 / 夜晚 / 飢餓：**
```typescript
let currentDifficulty: Difficulty = 'normal'
let nightCount = 0
let lastHungerDecay = 0   // ms timestamp
let lastHungerRegen = 0   // ms timestamp
```

**食物咬食飄字：**
```typescript
let foodBiteCount  = 0    // 目前連按 R 的次數
let lastFoodItemId = ''   // 切換食物時重置計數
```

**遺跡狀態（見 §10）：**
```typescript
let inDungeon = false
let dungeonReturnX = 0, dungeonReturnY = 0
let currentDungeonKey = ''   // `${ix},${iy}`
```

**玩家 / 輸入 / 游標狀態：**
```typescript
let myPlayerId  = ''
let currentMapName: string | null = null
let inputState = { up: false, down: false, left: false, right: false }
let selectedDir = { dx: 1, dy: 0 }
const selectedPoint = { x: 0, y: 0, clientX: 0, clientY: 0, hasPointer: false }
let selectorFlashUntil = 0
let clientPlayerHydrationChecked = false
```

**掉落物：**
```typescript
type DropItem = {
  id: string; resourceType: ResourceType
  itemId: string; amount: number
  worldX: number; worldY: number
  sprite: PIXI.Container; bobTick: () => void
}
type DropSnapshot = {
  id: string; resourceType: ResourceType; itemId: string
  amount: number; worldX: number; worldY: number
}
const drops = new Map<string, DropItem>()
```

**攻擊範圍：**
```typescript
let playerReach = 1   // 格數；空手 = 1，武器可擴展
```

**穩定玩家 ID（跨 session 存檔用，不隨 PeerJS peer ID 改變）：**
```typescript
const stableId = (() => {
  let id = localStorage.getItem('forager_stable_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('forager_stable_id', id) }
  return id
})()
```

---

## 8. 食物定義 FOOD_DEFS

```typescript
const FOOD_DEFS: Record<string, { bites: number; hungerRestore: number; icon: string }> = {
  berry: { bites: 3, hungerRestore: 30, icon: '🍓' },
  tomato: { bites: 3, hungerRestore: 30, icon: '🍅' },
  purple_grape: { bites: 3, hungerRestore: 30, icon: '🍇' },
  onion: { bites: 3, hungerRestore: 30, icon: '🧅' },
  carrot: { bites: 3, hungerRestore: 30, icon: '🥕' },
  pumpkin: { bites: 3, hungerRestore: 30, icon: '🎃' },
  watermelon: { bites: 3, hungerRestore: 30, icon: '🍉' },
}
```

全部食物：`bites: 3`、`hungerRestore: 30`，僅 icon 不同。飢餓顯示由 `HUD.update()` 統一處理（`#hud-hunger-segs`）。

---

## 9. 地圖覆蓋層與小地圖

DOM overlay（全螢幕、`z-index:500`）：

```typescript
const mapOverlay = document.createElement('div')
mapOverlay.id = 'map-overlay'
mapOverlay.style.cssText = [
  'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.78)',
  'display:none', 'align-items:center', 'justify-content:center',
  'z-index:500', 'flex-direction:column', 'gap:8px',
].join(';')
const mapCanvas = document.createElement('canvas')
mapCanvas.width = 560; mapCanvas.height = 560
mapCanvas.style.cssText = 'border-radius:12px;border:2px solid #4a9;box-shadow:0 0 24px #0006'
const mapLegend = document.createElement('div')
mapLegend.style.cssText = 'color:#7a9a7a;font-size:12px;font-family:monospace;text-align:center;line-height:1.8'
function _renderMapLegend(): void {
  mapLegend.innerHTML = `${t('game.map_legend_self')}&nbsp;&nbsp;${t('game.map_legend_ally')}&nbsp;&nbsp;${t('game.map_legend_wild')}&nbsp;&nbsp;${t('game.map_legend_siege')}&nbsp;&nbsp;${t('game.map_legend_build')}<br><span style="color:#aaa">${t('game.map_legend_close')}</span>`
}
_renderMapLegend()
mapOverlay.appendChild(mapCanvas)
mapOverlay.appendChild(mapLegend)
document.body.appendChild(mapOverlay)
mapOverlay.addEventListener('click', () => { mapOverlay.style.display = 'none' })
```

`renderMap()`（2D canvas 繪製，每次開圖時呼叫）關鍵常數與步驟：
- `W = H = 560`（canvas 尺寸）；`CTR_X = W/2`、`CTR_Y = H/2`。
- 背景填 `#091a2e`（深海色）。
- `MAP_SCALE = 70`（每個 island stride = 70px）。
- 生態系配色表（解鎖島用）：
  ```typescript
  const BIOME_FILL: Record<string, string> = {
    lush: '#2d7a2d', stone: '#556655', desert: '#b8922a', snow: '#99bbdd',
  }
  const BIOME_RING: Record<string, string> = {
    lush: '#4fc04f', stone: '#8aaa8a', desert: '#e8c040', snow: '#cce8ff',
  }
  ```
- 遍歷 `iy/ix` 從 -4..+4 畫所有小島格。`key = \`${ix},${iy}\``，從 `world.unlockedIslands`（預設 `['0,0']`）判斷是否解鎖。
- 解鎖島：用雜湊選生態系（中心 0,0 固定 `lush`），畫半徑 20 圓（fill+stroke，lineWidth 2）。
  ```typescript
  const bh = ((ix * 374761 + iy * 1103515) ^ 0xabcdef12) >>> 0
  const biomes = ['lush', 'lush', 'stone', 'desert', 'snow']
  const biome = (ix === 0 && iy === 0) ? 'lush' : biomes[bh % biomes.length]
  ```
- 未解鎖：`ring = Math.max(|ix|,|iy|)`，`ring>4` 跳過；費用 `ISLAND_UNLOCK_COST[ring] ?? 9999`；畫半徑 10 暗圓（fill `#1a2a1a`、stroke `#334433`），上方標 `${cost}🪙`（`#556655`、9px monospace）。
- 世界座標 → 地圖座標換算（建築/怪物/玩家共用）：
  ```typescript
  const stride_px = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE
  const mx = CTR_X + (wx - WORLD_CONFIG.CENTER_X) / stride_px * MAP_SCALE
  const my = CTR_Y + (wy - WORLD_CONFIG.CENTER_Y) / stride_px * MAP_SCALE
  ```
- 建築：`buildingSystem.getAll()`，取 `b.x/b.y + TILE_SIZE/2` 中心，畫 `#d4a017` 6×6 方塊。
- 怪物：`monsterSpawner.getAllMonsters()`，`m.kind === 'wild'` → `#ff8844`，否則 `#ff2233`；半徑 3 圓。
- 玩家：遍歷 `players`，自己（`pid === myPlayerId`）`#00ff88`、他人 `#44aaff`；半徑 5 圓 + 白邊（lineWidth 1.5）。
- 標題：`t('game.map_title')`，`#e0f0d0` bold 16px monospace，置中於 `(CTR_X, 22)`。

---

## 10. 遺跡系統（進出）

```typescript
const dungeonScene = new DungeonScene(objectsLayer)
dungeonScene.container.visible = false
let inDungeon = false
let dungeonReturnX = 0, dungeonReturnY = 0
let currentDungeonKey = ''

function _enterDungeon(instanceSeed: number, retX: number, retY: number): void {
  const world = GameStateManager_.getWorld()
  const layout = generateDungeon(instanceSeed ^ world.seed, 0, 0)
  dungeonScene.setup(layout, instanceSeed)
  dungeonReturnX = retX; dungeonReturnY = retY
  currentDungeonKey = `dungeon_${instanceSeed}`
  inDungeon = true
  dungeonScene.container.visible = true
  const spawn = dungeonScene.getSpawnPoint()
  const me = players.get(myPlayerId)
  if (me) { me.sprite.x = spawn.x; me.sprite.y = spawn.y }
  const pd = GameStateManager_.getPlayer(myPlayerId)
  if (pd) { pd.x = spawn.x; pd.y = spawn.y; GameStateManager_.setPlayer(myPlayerId, pd) }
}

function _exitDungeon(): void {
  inDungeon = false
  currentDungeonKey = ''
  dungeonScene.container.visible = false
  const me = players.get(myPlayerId)
  if (me) { me.sprite.x = dungeonReturnX; me.sprite.y = dungeonReturnY }
  const pd = GameStateManager_.getPlayer(myPlayerId)
  if (pd) { pd.x = dungeonReturnX; pd.y = dungeonReturnY; GameStateManager_.setPlayer(myPlayerId, pd) }
}
```

進入：dungeon seed = `instanceSeed ^ world.seed`，`generateDungeon(...,0,0)`；存返回座標、設 `currentDungeonKey = \`dungeon_${instanceSeed}\``、顯示場景、把玩家 sprite 與 GameState player 同步到 spawn 點。
離開：隱藏場景，玩家 sprite 與 player data 還原到 `dungeonReturnX/Y`。

---

## 11. 全域 debug 注入（globalThis）

緊接在 `let myPlayerId = ''` 之後：

```typescript
;(globalThis as any).__giveItem = (itemId: string, amount = 1) => {
  if (!ITEMS[itemId]) return { ok: false, reason: 'unknown-item', itemId }
  const n = Math.max(1, Math.floor(Number(amount) || 1))
  if (!myPlayerId) return { ok: false, reason: 'player-not-ready' }
  const ok = Inventory.add(myPlayerId, itemId, n)
  const inventory = Inventory.get(myPlayerId)
  hotbarUI.show(inventory)
  return { ok, playerId: myPlayerId, itemId, name: ITEMS[itemId].name, amount: n, inventory }
}
;(globalThis as any).__giveDungeonMap = (amount = 1) => (globalThis as any).__giveItem('dungeon_map', amount)
```

（注意 `hotbarUI` 在後段宣告，靠閉包提升使用。）

---

## 12. 手榴彈系統

```typescript
interface GrenadeProjectile {
  id: string
  sprite: PIXI.Graphics
  startX: number; startY: number
  targetX: number; targetY: number
  spawnMs: number
  fuseMs: number      // 引爆時間 ms
  exploded: boolean
}
const grenades: GrenadeProjectile[] = []
const GRENADE_FUSE_MS = 1500
const GRENADE_RADIUS  = 48 * 3   // 爆炸半徑（像素）= TILE_SIZE * 3

function throwGrenade(wx: number, wy: number): void {
  if (!myPlayerId) return
  const me = players.get(myPlayerId)
  if (!me) return
  if (!Inventory.remove(myPlayerId, 'grenade', 1)) {
    fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.no_grenade'), 0xFF6666)
    return
  }
  hotbarUI.show(Inventory.get(myPlayerId))
  const id = `gren_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const gfx = new PIXI.Graphics()
  gfx.circle(0, 0, 7).fill(0x445533)
  gfx.circle(0, 0, 7).stroke({ color: 0x222211, width: 1.5 })
  gfx.circle(0, -8, 3).fill(0x888866)   // 安全拉環
  gfx.x = me.x; gfx.y = me.y
  dropLayer.addChild(gfx)
  grenades.push({ id, sprite: gfx, startX: me.x, startY: me.y,
    targetX: wx, targetY: wy, spawnMs: performance.now(),
    fuseMs: GRENADE_FUSE_MS, exploded: false })
}
```

`throwGrenade` 只負責「扣道具 + 生成投擲物」；飛行/引爆/傷害在 game loop 處理。手榴彈 sprite 加到 `dropLayer`。沒手榴彈時飄紅字 `game.no_grenade`（0xFF6666）。

---

## 13. 兵營士兵系統

```typescript
interface SoldierEntry {
  id: string
  barracksId: string
  sprite: PIXI.Container
  gfx: PIXI.Graphics
  x: number; y: number
  hp: number; maxHp: number
  lastAttackMs: number
  dead: boolean
  respawnAt: number
}
const soldiers: SoldierEntry[] = []
const barracksSpawnTimer = new Map<string, number>()   // barracksId → 下次生成時間 ms
const SOLDIER_SPAWN_INTERVAL = 30_000   // 30 秒生成 1 名
const farmProduceTimer = new Map<string, number>()      // farmId → 下次產出時間 ms
const FARM_PRODUCE_INTERVAL = 30_000   // 每 30 秒掉落 2 顆漿果
const SOLDIER_MAX_PER_BARRACKS = 3
const SOLDIER_HP = 50
const SOLDIER_ATK = 8
const SOLDIER_SPEED = 80   // px/s
const SOLDIER_ATTACK_RANGE = 48 * 1.4   // = TILE_SIZE * 1.4
const SOLDIER_ATTACK_CD_MS = 1200
const SOLDIER_RESPAWN_MS = 60_000

function spawnSoldier(barracksId: string, bx: number, by: number): void {
  const id = `soldier_${barracksId}_${Date.now()}`
  const sprite = new PIXI.Container()
  const gfx = new PIXI.Graphics()
  // 士兵外觀：綠色小人
  gfx.rect(-6, -16, 12, 10).fill(0x4a7a2a)           // 身體（軍裝）
  gfx.rect(-4, -6, 8, 12).fill(0x3a5a1a)              // 腿
  gfx.circle(0, -22, 7).fill(0xcc9966)                 // 頭
  gfx.rect(-8, -18, 16, 4).fill(0x2a4a0a)              // 頭盔
  gfx.rect(6, -16, 3, 8).fill(0x888888)                // 武器（長矛）
  gfx.ellipse(0, 6, 10, 3).fill({ color: 0x000000, alpha: 0.2 })  // 陰影
  sprite.addChild(gfx)
  sprite.x = bx + TILE_SIZE; sprite.y = by + TILE_SIZE
  sprite.zIndex = by + TILE_SIZE + 21
  objectsLayer.addChild(sprite)
  soldiers.push({
    id, barracksId, sprite, gfx,
    x: bx + TILE_SIZE, y: by + TILE_SIZE,
    hp: SOLDIER_HP, maxHp: SOLDIER_HP,
    lastAttackMs: 0, dead: false, respawnAt: 0,
  })
}
```

士兵生成位置 = 兵營 `(bx+TILE_SIZE, by+TILE_SIZE)`。`zIndex = by + TILE_SIZE + 21`（Y 排序 + 21 偏移讓士兵略蓋兵營）。加到 `objectsLayer`。
注意 `farmProduceTimer`/`FARM_PRODUCE_INTERVAL` 雖屬農場但宣告在此區塊。

---

## 14. TileMap 掛載

```typescript
worldLayer.addChild(tileMap.displayObject)
```

`tileMap` 早在 §6 建構，但其 displayObject 在 §13 之後才掛進 `worldLayer`（底層）。

---

## 15. EventBus / callback 接線

**資源耗盡爆炸特效 + 掉落物（Host 才生成掉落並廣播）：**
```typescript
spawner.setDepletedVisualCallback((data) => {
  fxLayer.spawnDepletionBurst(data.x, data.y, data.type)
  if (RoomManager.role === 'host') {
    const spawnedDrops = spawnDrop(data.x, data.y, data.type)
    if (spawnedDrops.length > 0) {
      NetworkHost.broadcast({
        type: 'state_delta',
        tick: GameStateManager_.get().tick,
        delta: { drops: spawnedDrops } as any,
      })
    }
  }
})
```

**Quest 追蹤（採集事件 `resource:collected` 本專案未實際 emit，改直接追蹤）：**
```typescript
EventBus.on('craft:success', ({ recipeId }) => { questSystem.add(recipeId, 1) })
EventBus.on('build:placed',  ()             => { questSystem.add('buildings', 1) })
```

**寶箱打開 → 加入背包（只 Host 處理，並廣播 player inventory）：**
```typescript
EventBus.on('treasure:opened', ({ chestId, loot }) => {
  if (RoomManager.role !== 'host') return
  const playerId = myPlayerId
  if (!playerId) return
  for (const { itemId, amount } of loot) {
    Inventory.add(playerId, itemId, amount)
  }
  const updated = Inventory.get(playerId)
  NetworkHost.broadcast({
    type: 'state_delta',
    tick: GameStateManager_.get().tick,
    delta: { players: { [playerId]: { inventory: updated } } },
  })
})
```

**採集 XP 表 + `_grantHarvestXP`（目前只追蹤 Quest，XP 已停用）：**
```typescript
const HARVEST_XP: Record<string, [number, number]> = {
  berry: [1, 3], tomato: [1, 3], purple_grape: [1, 3], onion: [1, 3],
  carrot: [1, 3], pumpkin: [1, 3], watermelon: [1, 3],
  tree: [2, 5], rock: [2, 5],
  iron:  [4, 8], gold: [6, 12], crystal: [10, 20],
}
function _grantHarvestXP(pid: string, type: string, nodeX: number, nodeY: number): void {
  if (RoomManager.role !== 'host') return
  // 雙等級系統：採集不再給 Combat XP（XP 只能從打怪獲得）
  void HARVEST_XP
  void nodeX; void nodeY; void pid
  questSystem.add(type, 1)   // 只追蹤 Quest 進度
}
```
> `HARVEST_XP` 表保留但 `void` 掉，實際只呼叫 `questSystem.add(type, 1)`。重建時務必保留表（日後改 Research XP 用）。

**採集浮動文字 + 粒子：**
```typescript
EventBus.on('resource:collected', ({ playerId: _pid, type, amount }) => {
  const collector = myPlayerId ? players.get(myPlayerId) : undefined
  if (collector) {
    fxLayer.spawnHarvest(collector.x, collector.y - 20, type, amount ?? 1)
  }
})
```

**採集點擊停用 + 重生回呼（Host 廣播）：**
```typescript
// 採集改由滑鼠左鍵集中處理（見 canvas pointerdown → tryHarvestAtPointer），停用節點自身 click
spawner.setClickHandler(() => {})

spawner.setRespawnCallback((data) => {
  if (RoomManager.role !== 'host') return
  const world = GameStateManager_.getWorld()
  world.resources = (world.resources ?? []).filter(r => r.id !== data.id)
  world.resources.push(data)
  NetworkHost.broadcast({
    type: 'state_delta',
    tick: GameStateManager_.get().tick,
    delta: { resources: { [data.id]: data } },
  })
})
```

---

## 16. 本段定義的 helper 函式索引（簽章 + 用途）

| 函式 | 簽章 | 用途 |
|------|------|------|
| `syncViewportSize` | `(): void` | 重讀 DPR，`renderer.resize` + `dayNight.resize` |
| `scheduleViewportSync` | `() => void` | 同步呼叫 + 下一幀再呼叫一次 syncViewportSize |
| `notifyLeaveOnPageExit` | `() => void` | 頁面離開時 client 斷線 |
| `_renderReconnectOverlay` | `(): void` | 重繪重連覆蓋層 HTML（i18n） |
| `_renderMapLegend` | `(): void` | 重繪小地圖圖例 HTML（i18n） |
| `renderMap` | `(): void` | 在 mapCanvas 繪製整張世界小地圖 |
| `_enterDungeon` | `(instanceSeed: number, retX: number, retY: number): void` | 進入遺跡並傳送玩家到 spawn |
| `_exitDungeon` | `(): void` | 離開遺跡並還原玩家座標 |
| `throwGrenade` | `(wx: number, wy: number): void` | 扣手榴彈道具並生成投擲物 |
| `spawnSoldier` | `(barracksId: string, bx: number, by: number): void` | 生成兵營士兵（sprite + entry） |
| `_grantHarvestXP` | `(pid: string, type: string, nodeX: number, nodeY: number): void` | 採集追蹤 Quest（XP 已停用） |

全域注入：`globalThis.__giveItem(itemId, amount=1)`、`globalThis.__giveDungeonMap(amount=1)`。

---

## 17. 重建提示 / 易踩雷

1. **初始化順序硬依賴**：`initI18n` → `createApp` → `loadGameAssets` → `GameLoop.start`，全 `await`。i18n 必須最先（後面所有 `t()` / overlay HTML 用到）。
2. **圖層加入 camera 的順序就是 z 疊放**：worldLayer → islandRingGfx → objectsLayer → dropLayer → fxLayer → selectorLayer。`selectorLayer` 必須最後加（游標永遠最上層）。`dayNight` 不在 camera 裡，掛 `app.stage`（螢幕座標、全螢幕遮罩）。
3. **`objectsLayer.sortableChildren = true`**：資源/建築/玩家/士兵共用此層，靠 `zIndex`（通常 = 世界 Y）做 2.5D 深度排序。士兵 zIndex 額外 +21。
4. **DPR 每幀同步的理由**：`resolution` 只在 App.init 讀一次；瀏覽器縮放或跨 DPI 螢幕會變 DPR，不重 `renderer.resize` 會糊。Chrome 縮放不一定觸發 resize → game loop 另用 `lastDnW/lastDnH` 比對重撐夜晚遮罩。
5. **camera 縮放 `CAMERA_ZOOM = 1.5`**：整個世界容器縮放，非每個 sprite；指標 → 世界座標換算需考慮此縮放（在後段 input 處理）。
6. **Host/Client 權威**：`spawnDrop`、`treasure:opened`、`_grantHarvestXP`、`setRespawnCallback` 都 `if (RoomManager.role !== 'host') return`；Client 端透過 `state_delta` 接收。
7. **閉包提升使用**：`hotbarUI` 在本段（§11 `__giveItem`、§12 throwGrenade）被引用，但實際宣告在後段——靠 bootstrap 閉包，重建時注意它必須存在於同一函式作用域。
8. **魔術數字別杜撰**：MAP_SCALE=70、mapCanvas 560×560、GRENADE_FUSE_MS=1500、GRENADE_RADIUS=48*3、SOLDIER_* 全套、FOOD_DEFS 全 bites3/restore30、HARVEST_XP 表值——以上皆原樣保留。
9. **dungeon seed**：`generateDungeon(instanceSeed ^ world.seed, 0, 0)`，是 XOR world.seed，不是直接用 instanceSeed。
10. **`stableId`** 用 IIFE 從 localStorage `forager_stable_id` 取/建 UUID，跨 session 穩定，與 PeerJS peer ID 解耦。
