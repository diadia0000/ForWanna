# main.ts 重建參考 02：UI 實例化、背包暫存、碰撞、玩家升級/重生
> 涵蓋 src/main.ts 第 582–1173 行

本段位於 `bootstrap()` 內,銜接於資源/系統初始化之後。職責是:把所有 UI 面板實例化並完成 callback 接線、建立互動提示 / 拆除面板 / Toast、定義背包暫存資料結構與規則、放置模式狀態、掉落物生成、各種碰撞判定(水面 / 資源節點 / 建築)、怪物對玩家/建築的傷害回呼,以及玩家升級門檻、死亡判定與重生邏輯。

---

## 1. UI 面板實例化

所有面板都是直接 `new`,無建構參數。實例化後立刻 `hud.hide()`(遊戲尚未開始)。

```typescript
// ── UI ─────────────────────────────────────────────────────
const lobby = new LobbyScreen()
const hud = new HUD()

const inventoryUI = new InventoryUI()
const craftingUI  = new CraftingUI()
const buildingUI  = new BuildingUI()
const hotbarUI    = new HotbarUI()
const furnaceUI   = new FurnaceUI()
const marketUI    = new MarketUI()
const researchUI  = new ResearchUI()
const bagUI       = new BagUI()
const baseCoreUI  = new BaseCoreUI()
const barracksUI  = new BarracksUI()
const equipUI     = new EquipUI()
hud.hide()
```

> 注意:雖然任務描述列出 `BaseCoreUI`,程式中即為 `baseCoreUI`。所有面板 callback 接線分散在後續(本段只接 `equipUI` / `hotbarUI` / `bagUI`,其餘面板的接線在後續行段)。

---

## 2. 互動提示 interactionPrompt(PixiJS 容器)

世界座標跟隨,顯示按鍵 `E` / `R`。使用自訂字型 `ForWannaInteractionPrompt` 與九宮格底圖。

```typescript
const INTERACTION_PROMPT_FONT = 'ForWannaInteractionPrompt'
const interactionPrompt = new PIXI.Container()
interactionPrompt.visible = false
interactionPrompt.zIndex = 10_000
const interactionPromptBg = new PIXI.Sprite(PIXI.Texture.EMPTY)
interactionPromptBg.anchor.set(0.5)
interactionPromptBg.scale.set(1.05)
const interactionPromptText = new PIXI.Text({
  text: '',
  style: {
    fontFamily: INTERACTION_PROMPT_FONT,
    fontSize: 10,
    fill: 0xffffff,
    align: 'center',
    dropShadow: { color: 0x000000, blur: 0, distance: 1, alpha: 0.9 },
  },
})
interactionPromptText.anchor.set(0.5)
interactionPrompt.addChild(interactionPromptBg, interactionPromptText)
selectorLayer.addChild(interactionPrompt)
```

字型與底圖以 IIFE 非同步載入(`/assets/main_resources/ui/NormalFont.ttf`、`nine_path_panel.png`,底圖 `scaleMode = 'nearest'`)。載完字型後用 `interactionPromptText.text = interactionPromptText.text` 觸發重排。

訂閱 `EventBus` 事件 `interaction:prompt` 來定位/顯示:

```typescript
;(EventBus as any).on('interaction:prompt', (prompt: InteractionPrompt | null) => {
  if (!prompt || (prompt.key !== 'E' && prompt.key !== 'R')) {
    interactionPrompt.visible = false
    return
  }
  interactionPrompt.visible = true
  interactionPrompt.x = prompt.worldX + TILE_SIZE * 0.65
  interactionPrompt.y = prompt.worldY - TILE_SIZE * 0.2
  interactionPromptText.text = prompt.key.toUpperCase()
})
```

> 提示落點偏移:X = +TILE_SIZE*0.65,Y = -TILE_SIZE*0.2(座標系為世界座標,容器在 `selectorLayer`)。`TILE_SIZE` 在本段稍後才宣告(=48),但因為事件 callback 是執行期才呼叫,故無 TDZ 問題。

---

## 3. 拆除確認面板 demolishPanel(DOM,Backspace 觸發)

DOM 元素,`id="demolish-panel"`,初始 `display:none`,內含標題/建物名/退款/確認/取消按鈕。

```typescript
const demolishPanel = document.createElement('div')
demolishPanel.id = 'demolish-panel'
demolishPanel.style.display = 'none'
function _renderDemolishPanel(): void {
  // 只更新靜態文字（按鈕事件在 document.body.appendChild 後統一綁定）
  const titleEl = demolishPanel.querySelector('.demolish-title')
  const okBtn   = demolishPanel.querySelector<HTMLButtonElement>('#demolish-ok')
  const cancelBtn = demolishPanel.querySelector<HTMLButtonElement>('#demolish-cancel')
  if (titleEl)    titleEl.textContent = t('game.demolish_title')
  if (okBtn)      okBtn.textContent   = t('game.demolish_ok')
  if (cancelBtn)  cancelBtn.textContent = t('game.demolish_cancel')
}
demolishPanel.innerHTML = `
  <div class="demolish-title">${t('game.demolish_title')}</div>
  <div id="demolish-bname" class="demolish-bname"></div>
  <div id="demolish-refund" class="demolish-refund"></div>
  <div class="demolish-btns">
    <button id="demolish-ok">${t('game.demolish_ok')}</button>
    <button id="demolish-cancel">${t('game.demolish_cancel')}</button>
  </div>
`
document.body.appendChild(demolishPanel)
let demolishTargetId: string | null = null

demolishPanel.querySelector('#demolish-cancel')!.addEventListener('click', () => {
  demolishPanel.style.display = 'none'
  demolishTargetId = null
})
```

> `_renderDemolishPanel` 僅刷新「靜態文字」(i18n);`#demolish-bname` / `#demolish-refund` 與 `#demolish-ok` 的 click 由後續行段填入。`demolishTargetId` 為記住目前要拆的建物 id。本段只綁了 cancel。

---

## 4. UI Toast showUIToast(DOM,面板之上)

```typescript
function showUIToast(msg: string, colorHex = 0xffffff): void {
  const div = document.createElement('div')
  div.className = 'ui-toast'
  // 0xRRGGBB → CSS #rrggbb
  const hex = '#' + colorHex.toString(16).padStart(6, '0')
  div.style.color = hex
  div.style.borderColor = hex + '55'
  div.textContent = msg
  document.body.appendChild(div)
  // 動畫結束後自動移除（2.2s 與 CSS animation 一致）
  setTimeout(() => div.remove(), 2200)
}
```

> 顏色以 0xRRGGBB 數字傳入,轉成 CSS;邊框用 `+ '55'`(約 33% alpha)。存活 2200ms,須與 CSS animation 同步。

---

## 5. 背包暫存(本機只讀,不跨網路同步)

兩種背包:`bag_small`(容量 999)與 `bag_large`(容量 Infinity 無限)。內容只是 `Record<itemId, count>`,**不進入 GameState、不廣播**。

```typescript
const smallBagContents: Record<string, number> = {}   // bag_small 內容
const largeBagContents: Record<string, number> = {}   // bag_large 內容
const BAG_SMALL_MAX = 999

function _bagContents(type: BagType): Record<string, number> {
  return type === 'bag_small' ? smallBagContents : largeBagContents
}
function _bagUsed(type: BagType): number {
  return Object.values(_bagContents(type)).reduce((a, b) => a + b, 0)
}
function _bagRemain(type: BagType): number {
  if (type === 'bag_large') return Infinity
  return BAG_SMALL_MAX - _bagUsed('bag_small')
}
```

放入 / 取出規則:

```typescript
function _bagPutIn(type: BagType, itemId: string, amount: number, playerId: string): boolean {
  const remain = _bagRemain(type)
  const actual = remain === Infinity ? amount : Math.min(amount, remain)
  if (actual <= 0) return false
  if (!Inventory.remove(playerId, itemId, actual)) return false   // 先從物品欄移除
  const bag = _bagContents(type)
  bag[itemId] = (bag[itemId] ?? 0) + actual
  bagUI.update(_bagContents(type), Inventory.get(playerId))
  return true
}

function _bagTakeOut(type: BagType, itemId: string, amount: number, playerId: string): boolean {
  const bag = _bagContents(type)
  const have = bag[itemId] ?? 0
  const actual = Math.min(have, amount)
  if (actual <= 0) return false
  // 確認物品欄有空格（物品欄上限 18 格）
  const inv = Inventory.get(playerId)
  const hasExisting = inv.some(i => i.itemId === itemId)
  if (!hasExisting && inv.length >= 18) {
    const mePos = myPlayerId ? players.get(myPlayerId) : null
    if (mePos) fxLayer.spawnFloatingText(mePos.x, mePos.y - 40, t('game.bag_no_space'), 0xff8800)
    return false
  }
  Inventory.add(playerId, itemId, actual)   // 加回物品欄
  bag[itemId] = have - actual               // 從背包扣除
  if (bag[itemId] <= 0) delete bag[itemId]
  bagUI.update(_bagContents(type), Inventory.get(playerId))
  return true
}
```

判斷目前作用中的背包類型(掃描物品欄,先找到的 bag 為準):

```typescript
function _getActiveBagType(): BagType | null {
  const inv = Inventory.get(myPlayerId ?? '')
  for (const item of inv) {
    if (item.itemId === 'bag_small' || item.itemId === 'bag_large') {
      return item.itemId as BagType
    }
  }
  return null
}
```

---

## 6. UI callback 接線(equip / hotbar / bag)

```typescript
// 裝備欄卸下回調：把 armor 加回物品欄、清空 equipped、刷新 hotbar 與 equipUI
equipUI.setOnUnequip(() => {
  if (!myPlayerId) return
  const pd = GameStateManager_.getPlayer(myPlayerId)
  if (!pd) return
  const armor = (pd as any).equipped?.armor as string | undefined
  if (!armor) return
  Inventory.add(myPlayerId, armor, 1)
  ;(pd as any).equipped = { armor: null }
  GameStateManager_.setPlayer(myPlayerId, pd)
  hotbarUI.show(Inventory.get(myPlayerId))
  equipUI.clearArmor()
})

// 注入 InventoryUI 參考（供 HotbarUI 拖曳放入背包使用）
hotbarUI.setInventoryUI(inventoryUI)

// 快捷欄背包右鍵 → 開啟 BagUI
hotbarUI.setOnBagRightClick((bagType) => {
  bagUI.toggle(bagType, _bagContents(bagType), Inventory.get(myPlayerId ?? ''))
})

// BagUI 放入按鈕：用「目前可見且作用中的背包」
bagUI.setOnPutIn((itemId, amount) => {
  if (!myPlayerId) return
  const activeBagType = bagUI.isVisible ? _getActiveBagType() : null
  if (!activeBagType) return
  _bagPutIn(activeBagType, itemId, amount, myPlayerId)
})

// BagUI 取出按鈕
bagUI.setOnTakeOut((itemId, amount) => {
  if (!myPlayerId) return
  const activeBagType = _getActiveBagType()
  if (!activeBagType) return
  _bagTakeOut(activeBagType, itemId, amount, myPlayerId)
})

// 拖曳放入背包（HotbarUI 發出事件 bag:drag_drop）
;(EventBus as any).on('bag:drag_drop', ({ bagType, itemId, amount }: { bagType: BagType; itemId: string; amount: number }) => {
  if (!myPlayerId) return
  const bag = _bagContents(bagType)
  const remain = _bagRemain(bagType)
  const actual = remain === Infinity ? amount : Math.min(amount, remain)
  if (actual <= 0) return
  bag[itemId] = (bag[itemId] ?? 0) + actual
  // 注意：InventoryUI.acceptBagDrop 已移除物品欄物品，此處只更新背包
  bagUI.update(_bagContents(bagType), Inventory.get(myPlayerId))
  const mePosDrag = myPlayerId ? players.get(myPlayerId) : null
  if (mePosDrag) fxLayer.spawnFloatingText(mePosDrag.x, mePosDrag.y - 40,
    t('game.bag_put_in', { name: t('item.' + itemId + '.name', undefined, ITEMS[itemId]?.name ?? itemId), amount: actual }), 0x88ddff)
})
```

> 接線順序重點:`setOnPutIn` 用 `bagUI.isVisible && _getActiveBagType()`;`bag:drag_drop` 與 `setOnPutIn`/`_bagPutIn` 的差異——拖曳事件**不呼叫 `Inventory.remove`**(因為 `InventoryUI.acceptBagDrop` 已先移除),直接累加背包;而 `_bagPutIn` 自己負責移除物品欄。容易踩雷:兩條路徑職責不同,不可混用。

---

## 7. 建築放置模式 + 常數

```typescript
const TILE_SIZE = 48
const PLAYER_COLLISION_CENTER_Y = 8
const PLAYER_COLLISION_RADIUS = 10
const ringAtWorld = (x: number, y: number): number => {
  const ix = Math.round((x - WORLD_CONFIG.CENTER_X) / (WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE))
  const iy = Math.round((y - WORLD_CONFIG.CENTER_Y) / (WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE))
  return Math.max(Math.abs(ix), Math.abs(iy))
}
let placingDefId: string | null = null
```

- `ringAtWorld`:由世界座標算出所在「島嶼環數」(切比雪夫距離,以島嶼步距 `ISLAND_STRIDE * TILE_SIZE` 為單位)。
- `placingDefId`:目前正在放置的建築 defId(null = 非放置模式)。

---

## 8. 選格高亮 + 島嶼費用標籤池

```typescript
const selectorGfx = createSelectorGfx(selectorLayer)

const ISLAND_LABEL_POOL_SIZE = 12
const islandLabelPool: HTMLElement[] = []
for (let _li = 0; _li < ISLAND_LABEL_POOL_SIZE; _li++) {
  const lbl = document.createElement('div')
  lbl.className = 'island-label'
  lbl.style.display = 'none'
  document.body.appendChild(lbl)
  islandLabelPool.push(lbl)
}
```

> 島嶼費用標籤是 DOM(screen-space),預先建 12 個重用,避免動態增刪。`selectorGfx` 由外部工廠 `createSelectorGfx` 建立並掛在 `selectorLayer`。

---

## 9. 掉落物生成

掉落物顏色表(itemId → 0xRRGGBB):

```typescript
const DROP_COLORS: Record<string, number> = {
  wood: 0x7A3E0E, stone: 0x8090A2, iron: 0x4A5CA8, gold: 0xD89020, crystal: 0x8020C0,
  berry: 0xD01840, tomato: 0xE5462E, purple_grape: 0x7B3FC7, onion: 0xD8D0B0,
  carrot: 0xE57C22, pumpkin: 0xD8731E, watermelon: 0x5CB85C,
  bone: 0xDDCCBB, feather: 0x66CCFF, meat: 0xB03030, leather: 0xA07040,
  fire_essence: 0xFF4400, ice_essence: 0x44AAFF, ancient_crystal: 0xFFAA00,
}
```

三個函式:

```typescript
/** 依資源類型生成掉落物（如 tree → wood）。回傳 DropSnapshot[] 供廣播 */
function spawnDrop(worldX: number, worldY: number, resourceType: ResourceType): DropSnapshot[] {
  const dropDefs = RESOURCE_CONFIG[resourceType]?.drops
  if (!dropDefs) return []
  const spawned: DropSnapshot[] = []
  for (const def of dropDefs) {
    spawned.push(_spawnDropSprite(worldX, worldY, resourceType, def.itemId, def.amount))
  }
  return spawned
}

/** 依 itemId 直接生成（怪物骨頭/農場產出）；host 端會廣播 state_delta */
function spawnDropByItemId(worldX: number, worldY: number, itemId: string, amount: number): void {
  const drop = _spawnDropSprite(worldX, worldY, 'wood' as ResourceType, itemId, amount)
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { drops: [drop] } as any,
    })
  }
}
```

共用 sprite 渲染(本段最關鍵的繪圖實作):

```typescript
function _spawnDropSprite(
  worldX: number, worldY: number,
  resourceType: ResourceType,
  itemId: string, amount: number,
  snapshot?: DropSnapshot
): DropSnapshot {
  const id  = snapshot?.id ?? `drop_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const ox  = snapshot ? 0 : (Math.random() - 0.5) * 28   // 隨機散開 X
  const oy  = snapshot ? 0 : (Math.random() - 0.5) * 20   // 隨機散開 Y
  const wx  = snapshot?.worldX ?? worldX + ox
  const baseY = snapshot?.worldY ?? worldY + oy

  if (drops.has(id)) return snapshot ?? { id, resourceType, itemId, amount, worldX: wx, worldY: baseY }

  const c = new PIXI.Container()
  c.x = wx; c.y = baseY

  const col = DROP_COLORS[itemId] ?? 0xBBBBBB

  // 光暈（兩層半透明圓）
  const glow = new PIXI.Graphics()
  glow.circle(0, 0, 22).fill({ color: col, alpha: 0.25 })
  glow.circle(0, 0, 15).fill({ color: col, alpha: 0.30 })

  // 主圓（半徑 12）
  const dg = new PIXI.Graphics()
  dg.circle(0, 0, 12).fill(col)
  dg.circle(0, 0, 12).stroke({ color: 0x000000, width: 1.5 })
  dg.circle(-3, -4, 4).fill({ color: 0xffffff, alpha: 0.42 })   // 高光

  const lbl = new PIXI.Text({
    text: `×${amount}`,
    style: { fontSize: 11, fill: 0xffffff,
      dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 1 } },
  })
  lbl.anchor.set(0.5, 1); lbl.y = -14
  c.addChild(glow, dg, lbl)
  dropLayer.addChild(c)

  // 上下浮動 + 光暈呼吸
  const phase = Math.random() * Math.PI * 2
  const bobTick = () => {
    const t = performance.now() / 600 + phase
    c.y = baseY + Math.sin(t) * 3
    glow.alpha = 0.55 + Math.sin(t * 1.6) * 0.45
  }
  PIXI.Ticker.shared.add(bobTick)

  drops.set(id, { id, resourceType, itemId, amount,
    worldX: wx, worldY: baseY, sprite: c, bobTick })
  return { id, resourceType, itemId, amount, worldX: wx, worldY: baseY }
}
```

> 重建要點:傳入 `snapshot` 時(client 端套用 host 廣播)**不做隨機散開**(ox/oy=0),用 snapshot 的座標/id,確保各端位置一致。回傳值不含 `sprite`/`bobTick`(僅可序列化欄位);存進 `drops` Map 的物件才含 sprite 與 bobTick(供之後移除動畫)。

---

## 10. 碰撞判定

### 水面 isWater

```typescript
function isWater(wx: number, wy: number): boolean {
  const world = GameStateManager_.getWorld()
  if (!world?.chunks?.length) return false
  const isTileWater = tileMap.getTileAt(wx, wy, world) === 'water'
  if (isTileWater) {
    const TILE_SIZE = 48   // 區域內遮蔽外層常數
    const hasCompletedBridge = (world.buildings ?? []).some(b => {
      if (b.defId !== 'wooden_bridge') return false
      if (buildingSystem.isBuilding(b.id)) return false       // 只算已完成的橋
      return wx >= b.x && wx < b.x + TILE_SIZE &&             // 橋 1x1，b.x/b.y 為左上角
             wy >= b.y && wy < b.y + TILE_SIZE
    })
    return !hasCompletedBridge   // 有完成的橋 → 不算水
  }
  return isTileWater
}
```

注入到各子系統:
```typescript
monsterSpawner.setLandPosChecker((wx, wy) => {  // 怪物不生在水/橋上
  if (isWater(wx, wy)) return false
  const world = GameStateManager_.getWorld()
  const isOnBridge = (world?.buildings ?? []).some(b =>
    b.defId === 'wooden_bridge' && !buildingSystem.isBuilding(b.id) &&
    wx >= b.x && wx < b.x + TILE_SIZE && wy >= b.y && wy < b.y + TILE_SIZE)
  return !isOnBridge
})
treasureSpawner.setLandChecker((wx, wy) => {     // 中心格陸地 = 該島已解鎖
  const world = GameStateManager_.getWorld()
  if (!world?.chunks?.length) return false
  return tileMap.getTileAt(wx, wy, world) !== 'water'
})
buildingSystem.setWaterChecker((wx, wy) => {     // 木橋需水上、其他需陸地（用原始 tile）
  const world = GameStateManager_.getWorld()
  if (!world?.chunks?.length) return false
  return tileMap.getTileAt(wx, wy, world) === 'water'
})
buildingSystem.setPlayersGetter(() => [...players.values()].map(p => ({ x: p.x, y: p.y })))
```

### 資源節點 isBlockedByNode

每種節點有不同碰撞半徑,再加玩家碰撞半徑;耗盡(hp<=0)的節點不阻擋。

```typescript
const NODE_COLLIDE_R: Record<string, number> = {
  tree: 14, rock: 18, iron: 18, gold: 18, crystal: 12,
}
function isBlockedByNode(wx: number, wy: number): boolean {
  const PLAYER_R = 10   // 區域常數（實際相加用 PLAYER_COLLISION_RADIUS）
  for (const node of spawner.getAllNodes()) {
    const data = node.getData()
    if (data.hp <= 0) continue
    const r  = (NODE_COLLIDE_R[data.type] ?? 16) + PLAYER_COLLISION_RADIUS   // 預設 16
    const dx = wx - node.x
    const dy = wy - node.y
    if (dx * dx + dy * dy < r * r) return true
  }
  return false
}
```

> 注意:此處宣告了 `PLAYER_R = 10` 但實際相加用的是外層 `PLAYER_COLLISION_RADIUS`(也是 10);`PLAYER_R` 未被使用(可視為冗餘)。圓對圓碰撞用平方距離比較。

### 建築 isBlockedByBuilding

AABB(建築)對圓(玩家)碰撞;木橋與寶箱不阻擋。

```typescript
function isBlockedByBuilding(wx: number, wy: number): boolean {
  const world = GameStateManager_.getWorld()
  for (const b of (world.buildings ?? [])) {
    const bDef = BUILDING_DEFS[b.defId]
    if (!bDef) continue
    if (b.defId === 'wooden_bridge' || b.defId === 'chest') continue
    const halfW = bDef.size.x * TILE_SIZE / 2
    const halfH = bDef.size.y * TILE_SIZE / 2
    const cx = b.x + halfW   // b.x/b.y = 左上角 → 換算中心
    const cy = b.y + halfH
    const dx = Math.max(0, Math.abs(wx - cx) - halfW)   // 點到 AABB 最近距離
    const dy = Math.max(0, Math.abs(wy - cy) - halfH)
    if (dx * dx + dy * dy < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) return true
  }
  return false
}
```

---

## 11. 怪物回呼接線

```typescript
monsterSpawner.setDarknessGetter(() => dayNight.darkness)
monsterSpawner.setDeathVisualCallback((x, y) => fxLayer.spawnMonsterBloodBurst(x, y))
```

### 擊殺回呼(金幣 + XP + 升級 + 掉落 + Quest)

```typescript
monsterSpawner.setKillCallback((drop, killerId) => {
  const kp = GameStateManager_.getPlayer(killerId)
  if (!kp) return
  kp.gold = (kp.gold ?? 0) + drop.goldReward
  kp.xp   = (kp.xp   ?? 0) + drop.xpReward
  // ── 升級判斷：門檻 = floor(100 × level^1.5)，最高 20 級 ──
  let didLevelUp = false
  while ((kp.level ?? 1) < 20) {
    const threshold = Math.floor(100 * Math.pow(kp.level ?? 1, 1.5))
    if ((kp.xp ?? 0) >= threshold) {
      kp.xp   = (kp.xp ?? 0) - threshold   // 扣門檻，餘數帶入下一級
      kp.level = (kp.level ?? 1) + 1
      didLevelUp = true
      fxLayer.spawnFloatingText(drop.x, drop.y - 30, t('game.level_up', { level: kp.level }), 0xFFFF44)
    } else break
  }
  GameStateManager_.setPlayer(killerId, kp)
  fxLayer.spawnFloatingText(drop.x, drop.y - 20, `+${drop.goldReward}🪙`, 0xFFD700)
  // 配方素材直接入背包；只能賣錢的掉落在地上
  if (drop.meatDrop)    Inventory.add(killerId, 'meat',    1)
  if (drop.leatherDrop) Inventory.add(killerId, 'leather', 1)
  if (drop.boneDrop)    spawnDropByItemId(drop.x, drop.y, 'bone',    1)
  if (drop.featherDrop) spawnDropByItemId(drop.x, drop.y, 'feather', 1)
  if (drop.dungeonMapDrop) spawnDropByItemId(drop.x, drop.y, 'dungeon_map', 1)
  questSystem.add('kills', 1)
  questSystem.add('gold_earned', drop.goldReward)
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta', tick: GameStateManager_.get().tick,
      delta: { players: { [killerId]: { gold: kp.gold, xp: kp.xp, level: kp.level } } },
    })
  }
  void didLevelUp
})
```

**升級公式:`threshold = Math.floor(100 * Math.pow(level, 1.5))`;`while` 迴圈逐級升(支援一次跨多級),上限 `level < 20`;升級時 xp 扣掉門檻保留餘數。`meat`/`leather` 直接入背包,`bone`/`feather`/`dungeon_map` 生成為地面掉落物。**

### Boss 擊殺(dungeonScene)

```typescript
dungeonScene.setBossKillCallback(() => {
  if (!myPlayerId) return
  const meBoss = players.get(myPlayerId)
  if (!meBoss) return
  fxLayer.spawnFloatingText(meBoss.x, meBoss.y - 50, t('game.boss_killed'), 0xffcc44)
  Inventory.add(myPlayerId, 'crystal', 3)   // 額外 3 顆晶體
  hotbarUI.show(Inventory.get(myPlayerId))
  fxLayer.spawnFloatingText(meBoss.x, meBoss.y - 28, t('game.crystal_bonus'), 0x66ddff)
})
```

### 怪物攻擊建築

```typescript
monsterSpawner.setHitBuildingCallback((buildingId, damage) => {
  const destroyed = buildingSystem.takeDamage(buildingId, damage)
  if (destroyed) {
    const b = buildingSystem.getAll().find(b => b.id === buildingId)
    if (b) {
      const bx = b.x + TILE_SIZE / 2, by = b.y + TILE_SIZE / 2
      fxLayer.spawnFloatingText(bx, by - 20, t('game.building_damaged'), 0xFF6600)
    }
  }
  if (RoomManager.role === 'host') {
    const b = buildingSystem.getAll().find(b => b.id === buildingId)
    if (b) NetworkHost.broadcast({
      type: 'state_delta', tick: GameStateManager_.get().tick,
      delta: { buildings: { [buildingId]: { hp: b.hp } } } as any,
    })
  }
})

// 注入建築列表給怪物 AI（每幀由 host 取用）
monsterSpawner.setGetBuildings(() =>
  buildingSystem.getAll()
    .filter(b => BUILDING_DEFS[b.defId])
    .map(b => {
      const def = BUILDING_DEFS[b.defId]
      return { id: b.id, defId: b.defId, x: b.x, y: b.y, sizeX: def.size.x, sizeY: def.size.y, hp: b.hp }
    })
)
```

---

## 12. 玩家死亡 / 重生

`deadPlayers`:重生冷卻中的玩家集合,避免重複觸發死亡與冷卻期免疫。

```typescript
const deadPlayers = new Set<string>()

function _respawnPlayer(playerId: string): void {
  // 若在遺跡內死亡，先離開遺跡（否則重生點是世界座標但仍被當在遺跡內 → 卡死）
  if (playerId === myPlayerId && inDungeon) _exitDungeon()
  const worldD = GameStateManager_.getWorld()
  const spawnX = (worldD as any).spawnX ?? WORLD_CONFIG.CENTER_X
  const spawnY = (worldD as any).spawnY ?? WORLD_CONFIG.CENTER_Y
  const pdR = GameStateManager_.getPlayer(playerId)
  let xpLost = 0
  if (pdR) {
    xpLost    = Math.floor((pdR.xp ?? 0) * 0.5)   // 死亡懲罰：損失 50% 當前等級 XP
    pdR.xp    = (pdR.xp ?? 0) - xpLost
    pdR.hp    = pdR.maxHp ?? 100
    pdR.x     = spawnX
    pdR.y     = spawnY
    GameStateManager_.setPlayer(playerId, pdR)
  }
  const pR = players.get(playerId)
  if (pR) { pR.sprite.x = spawnX; pR.sprite.y = spawnY }
  deadPlayers.delete(playerId)
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta', tick: GameStateManager_.get().tick,
      delta: { players: { [playerId]: {
        hp: pdR?.maxHp ?? 100, x: spawnX, y: spawnY,
        xp: pdR?.xp, level: pdR?.level,
      } } },
    })
  }
  if (playerId === myPlayerId) {
    if (pdR) hud.update({ hp: pdR.hp, maxHp: pdR.maxHp ?? 100, xp: pdR.xp, level: pdR.level } as any)
    if (xpLost > 0) fxLayer.spawnFloatingText(spawnX, spawnY - 60, `-${xpLost} XP 💀`, 0xFF8866)
    fxLayer.spawnFloatingText(spawnX, spawnY - 40, t('game.respawn'), 0xAAFFAA)
  }
}
```

怪物攻擊玩家(含防具減傷 + 死亡判定):

```typescript
monsterSpawner.setHitPlayerCallback((playerId, damage) => {
  if (deadPlayers.has(playerId)) return         // 冷卻期免疫
  const pd = GameStateManager_.getPlayer(playerId)
  if (!pd) return
  const equippedArmor = (pd as any).equipped?.armor as string | undefined
  const armorDef = getArmorDef(equippedArmor)
  const defPct = armorDef?.defPct ?? 0
  const actualDamage = Math.round(damage * (1 - defPct) * 10) / 10   // 減傷後保留 1 位小數
  pd.hp = Math.round(Math.max(0, pd.hp - actualDamage) * 10) / 10
  GameStateManager_.setPlayer(playerId, pd)
  const p = players.get(playerId)
  const dmgText = defPct > 0
    ? `-${actualDamage}❤️ (${Math.round(defPct * 100)}% ${t('game.defense_pct')})`
    : `-${actualDamage}❤️`
  if (p) fxLayer.spawnFloatingText(p.x, p.y - 30, dmgText, 0xFF4444)
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta', tick: GameStateManager_.get().tick,
      delta: { players: { [playerId]: { hp: pd.hp } } },
    })
  }
  // ── 死亡判定 ──
  if (pd.hp <= 0) {
    deadPlayers.add(playerId)
    if (p) fxLayer.spawnFloatingText(p.x, p.y - 55, t('game.killed'), 0xFF4444)
    setTimeout(() => _respawnPlayer(playerId), 2000)   // 2 秒後重生
  }
})
```

---

## 13. 放置預覽 ghost(段末)

```typescript
const ghost = new PIXI.Container()
ghost.visible = false
ghost.alpha   = 0.65
ghost.zIndex  = 999999          // 永遠在最上層（放置預覽）
buildingLayer.addChild(ghost)   // ghost 在 camera 內，跟著世界座標走
```

---

## Helper 函式清單(簽章 + 用途)

| 函式 | 簽章 | 用途 |
| --- | --- | --- |
| `_renderDemolishPanel` | `(): void` | 刷新拆除面板的 i18n 靜態文字 |
| `showUIToast` | `(msg: string, colorHex = 0xffffff): void` | 在所有面板之上彈出 2.2s 自動消失的 Toast |
| `_bagContents` | `(type: BagType): Record<string, number>` | 取得對應背包的內容物件 |
| `_bagUsed` | `(type: BagType): number` | 背包已用容量(數量總和) |
| `_bagRemain` | `(type: BagType): number` | 背包剩餘容量(large = Infinity) |
| `_bagPutIn` | `(type, itemId, amount, playerId): boolean` | 物品欄→背包(先移除物品欄) |
| `_bagTakeOut` | `(type, itemId, amount, playerId): boolean` | 背包→物品欄(檢查 18 格上限) |
| `_getActiveBagType` | `(): BagType \| null` | 掃描物品欄回傳目前作用中的背包類型 |
| `ringAtWorld` | `(x, y): number` | 世界座標→島嶼環數(切比雪夫距離) |
| `spawnDrop` | `(worldX, worldY, resourceType): DropSnapshot[]` | 依資源類型生成掉落物群 |
| `spawnDropByItemId` | `(worldX, worldY, itemId, amount): void` | 依 itemId 生成掉落物(host 廣播) |
| `_spawnDropSprite` | `(worldX, worldY, resourceType, itemId, amount, snapshot?): DropSnapshot` | 共用掉落物 sprite 渲染與浮動動畫 |
| `isWater` | `(wx, wy): boolean` | 水面碰撞(已完成木橋視為非水) |
| `isBlockedByNode` | `(wx, wy): boolean` | 資源節點圓形碰撞 |
| `isBlockedByBuilding` | `(wx, wy): boolean` | 建築 AABB-圓碰撞(橋/寶箱不阻擋) |
| `_respawnPlayer` | `(playerId: string): void` | 重生:扣 50% XP、回滿血、移回出生點、廣播 |

---

## 本段引入的全域可變狀態(在 bootstrap 閉包內)

| 變數 | 型別 | 說明 |
| --- | --- | --- |
| `lobby, hud, inventoryUI, craftingUI, buildingUI, hotbarUI, furnaceUI, marketUI, researchUI, bagUI, baseCoreUI, barracksUI, equipUI` | UI 實例 | 所有面板 |
| `interactionPrompt / interactionPromptBg / interactionPromptText` | Pixi | 世界互動提示 |
| `demolishPanel` | HTMLElement | 拆除確認面板(DOM) |
| `demolishTargetId` | `string \| null` | 目前要拆的建物 id |
| `smallBagContents / largeBagContents` | `Record<string,number>` | 兩種背包暫存(本機,不同步) |
| `placingDefId` | `string \| null` | 放置模式的建築 defId |
| `selectorGfx` | 工廠回傳 | 選格高亮圖形 |
| `islandLabelPool` | `HTMLElement[]` | 12 個島嶼費用標籤(DOM 池) |
| `deadPlayers` | `Set<string>` | 重生冷卻中的玩家集合 |
| `ghost` | `PIXI.Container` | 放置預覽容器 |

常數:`INTERACTION_PROMPT_FONT`、`BAG_SMALL_MAX=999`、`TILE_SIZE=48`、`PLAYER_COLLISION_CENTER_Y=8`、`PLAYER_COLLISION_RADIUS=10`、`ISLAND_LABEL_POOL_SIZE=12`、`DROP_COLORS`、`NODE_COLLIDE_R`。

---

## 重建提示 / 易踩雷

1. **UI callback 串接順序**:先 `new` 所有面板 → 立刻 `hud.hide()` → 之後才逐一 `setOn...`。`hotbarUI.setInventoryUI(inventoryUI)` 必須在使用拖曳前注入。本段只接 equip/hotbar/bag 三者,其餘面板 callback 在後續行段。
2. **背包兩條放入路徑職責不同**:`_bagPutIn`(按鈕)自己呼叫 `Inventory.remove`;`bag:drag_drop`(拖曳)**不移除**,因 `InventoryUI.acceptBagDrop` 已移除——重建時若兩邊都移除會雙重扣物品。
3. **背包只在本機**:`smallBagContents`/`largeBagContents` 不進 GameState、不廣播。多人時各玩家背包獨立,故 `_bagPutIn` 等都吃 `playerId` 但只操作本地 Map + 該玩家的 `Inventory`。
4. **升級公式邊界**:`threshold = floor(100 * level^1.5)`;用 `while` 迴圈(一次擊殺可跨多級),硬上限 `level < 20`;升級扣門檻保留餘數。重建勿寫成 `if`(否則無法連升)。
5. **碰撞座標系**:全部用世界座標。建築 `b.x/b.y` 是**左上角**,碰撞要 `+half` 換中心;木橋是 1x1,寶箱與橋皆不阻擋玩家。`isWater` 中已完成木橋會把「水」判成可走(`hasCompletedBridge` 取反);但 `setWaterChecker`(放置用)刻意用原始 tile,不考慮橋。
6. **掉落物 snapshot 一致性**:client 套用 host 廣播時帶 `snapshot`,此時不可再隨機散開,座標/id 全用 snapshot;回傳物件不含 sprite/bobTick(可序列化),存進 `drops` Map 的才含這兩者。
7. **重生先離遺跡**:`_respawnPlayer` 若玩家在遺跡內死亡,必須先 `_exitDungeon()`,否則重生點是世界座標卻仍被 `dungeonScene.isFloor()` 判定 → 卡死。
8. **死亡冷卻免疫**:`deadPlayers` 既防重複死亡判定,也讓 `setHitPlayerCallback` 在冷卻期 early-return 免傷;`_respawnPlayer` 結尾才 `delete`。死亡到重生固定 2000ms(`setTimeout`)。
9. **TILE_SIZE 重複宣告**:`isWater` 與 `setLandPosChecker` 內各自有 `const TILE_SIZE = 48` 區域遮蔽;`isBlockedByNode` 內 `PLAYER_R=10` 未實際使用(相加用外層 `PLAYER_COLLISION_RADIUS`)。重建可保留以求忠實,但知道是冗餘。
10. **host 權威廣播**:擊殺/受傷/重生/建築受損都只有 `RoomManager.role === 'host'` 才 `NetworkHost.broadcast` state_delta;client 端僅做本地視覺(floating text)並等 delta 修正。
