# 踩坑筆記（開發常見問題）

## 1. src/ 下絕對不能有 .js 檔案

**問題**：Vite 在 dev 模式下，如果 `src/` 下有舊的 `.js` 檔（例如編譯殘留的 `LobbyScreen.js`），會直接回傳那個檔案，**完全繞過 TypeScript 源碼**，導致修改無效。

**根本原因修正**（`tsconfig.json`）：`tsc` 原本會 emit，導致每個 `.ts` 旁邊長出同名 `.js`。改為 `"noEmit": true` 讓 Vite 負責打包，`tsc` 僅做型別檢查。

```json
{
  "compilerOptions": {
    "noEmit": true
  }
}
```

**緊急清除**：刪除所有 src/ 下的 .js 檔

```bash
find src -name "*.js" -type f -delete
```

---

## 2. PeerJS 本地信令伺服器

**問題**：RoomManager 連接 `localhost:9000`（因為台灣無法穩定使用公共 PeerJS 雲端）。若伺服器沒啟，連線會失敗。

**檢查是否運行**：
```bash
netstat -an | grep 9000
# 或
lsof -i :9000
```

**啟動本地信令伺服器**：
```bash
npm run peer
```

> ⚠️ 注意：`.env` 已包含 Railway 公共信令伺服器地址作為備選，但本地優先。

---

## 3. 多個 Vite 進程會吃舊代碼

**問題**：若同時跑多個 Vite dev server，瀏覽器會隨機連到舊的進程，導致改動不生效。

**檢查 Vite 進程**：
```bash
netstat -an | grep 5175
lsof -i :5175
```

**解決**：確保只有一個 Vite 在運行
```bash
# 殺掉所有 Vite 進程
pkill -f "vite"

# 重新啟動
npm run dev
```

---

## 4. 按鍵偵測要用 e.code，不能用 e.key

**問題**：中文輸入法（IME）啟用時，`e.key` 會變成 `'Process'`，導致 `I`/`C`/`B` 等快捷鍵無法觸發。

**錯誤做法**：
```typescript
document.addEventListener('keydown', (e) => {
  if (e.key === 'i') {  // ❌ IME 會變成 'Process'
    showInventory()
  }
})
```

**正確做法**：
```typescript
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyI') {  // ✅ 使用按鍵碼
    showInventory()
  }
})
```

> 常用快捷鍵碼：`KeyI`, `KeyC`, `KeyB`, `KeyS` 等

---

## 5. UI Panel CSS 必須包含所有 Panel ID

**問題**：若 CSS `position: fixed` 選擇器漏掉某些 Panel ID，該 Panel 會出現在 body 最下方，被 canvas 遮住無法互動。

**正確做法**：
```css
#inventory-ui, #crafting-ui, #building-ui {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: none;
  z-index: 1000;
}

#inventory-ui.visible, #crafting-ui.visible, #building-ui.visible {
  display: flex;
}
```

> 新增 Panel 時記得加入 CSS 選擇器！

---

## 6. InventoryUI 不要在 constructor 監聽事件

**問題**：若在 InventoryUI constructor 監聽 `ui:open_inventory` 事件並自動顯示，之後 main.ts 又呼叫 `toggle()`，會先設 `visible=true` 再立刻 toggle 關閉。

**錯誤做法**：
```typescript
// ❌ InventoryUI.ts
constructor() {
  EventBus.on('ui:open_inventory', () => this.show())
}

// main.ts
inventoryUI.toggle()  // 衝突！
```

**正確做法**：
```typescript
// ✅ InventoryUI.ts - 只負責 show/hide/toggle
show() { this.visible = true }
hide() { this.visible = false }
toggle() { this.visible = !this.visible }

// main.ts - 統一管理開關邏輯
EventBus.on('ui:open_inventory', () => {
  inventoryUI.toggle()
})
```

---

## 7. Vite port 設定

**目前設定**：5175（vite.config.ts）

若需要更改，編輯 `vite.config.ts`：
```typescript
export default defineConfig({
  server: {
    port: 5175  // 改這裡
  }
})
```

重啟後開啟 `http://localhost:5175`

---

## 8. 分身 Bug

**舊問題**：state_full 和 game:start 雙重初始化導致重複 sprite。

**修正方式**：在 main.ts 加入 `players.has()` guard
```typescript
if (!players.has(playerId)) {
  // 只在首次初始化 sprite
  createPlayerSprite(playerId)
}
```

---

## 9. Client 加入時背包資料不同步

**舊問題**：Client 加入房間後背包為空。

**修正方式**：state_full 包含所有玩家的 inventory 資料
```typescript
const state_full = {
  world: worldData,
  players: Array.from(players.values()),
  inventories: Array.from(inventories.entries())  // 關鍵
}
```

---

## 10. BuildingSystem 空值檢查

**問題**：舊存檔中 `buildings` 可能為 undefined，導致 crash。

**修正方式**：
```typescript
restoreBuilding(buildingData: any) {
  if (!this.buildings) {
    this.buildings = []
  }
  // 避免重複 push
  if (!this.buildings.find(b => b.id === buildingData.id)) {
    this.buildings.push(buildingData)
  }
}
```

---

## 11. 合成解鎖用 `researchLevel`，不是 `level`

**問題**：`CraftingSystem.canCraft()` 和 `GameController` 的 `ui:open_crafting` handler 都錯誤地讀取 `player.level` 來判斷配方解鎖，但實際上解鎖條件是由 `player.researchLevel` 控制。結果所有解鎖判斷永遠用錯欄位，配方永遠顯示為不可用或全部可用（取決於 `level` 預設值）。

**錯誤做法**：
```typescript
const playerLevel = GameStateManager_.getPlayer(playerId)?.level ?? 1
if (playerLevel < recipe.unlockLevel) return false
```

**正確做法**：
```typescript
const researchLevel = GameStateManager_.getPlayer(playerId)?.researchLevel ?? 1
if (researchLevel < recipe.unlockLevel) return false
```

> 影響檔案：`src/inventory/CraftingSystem.ts`、`src/GameController.ts`  
> 新增合成相關邏輯時，記得 `unlockLevel` 對應的是 `researchLevel` 而非 `level`。

---

## 12. `items.json` 缺少 `plank` 導致木板沒有貼圖

**問題**：`public/assets/main_resources/items_json/items.json` 漏掉 `"plank"` 的 JSON 路徑對應，使木板物品永遠無法載入貼圖，顯示為空白或 emoji fallback。

**正確做法**：

```json
{
  "plank": "/assets/main_resources/items_json/plank.json"
}
```

> 新增物品時，`items.json`、物品定義檔（`.json`）、`ITEMS` 資料三處都要同步更新。

---

## 13. `Inventory.add()` 新建格未 clamp `maxStack`

**問題**：`Inventory.add()` 在堆疊到既有格時會 `Math.min(amount, maxStack)`，但首次建立新格（`inv.push`）直接塞入原始 `amount`，導致背包可以超過上限（例如 crystal 一次加 200 會變 200，上限應為 99）。

**錯誤做法**：

```typescript
inv.push({ itemId, amount })
```

**正確做法**：

```typescript
inv.push({ itemId, amount: Math.min(amount, itemDef.maxStack) })
```

---

## 14. `Inventory.init()` 重複監聽 `resource:collected`

**問題**：`Inventory.init()` 每次呼叫都會重新監聽 `resource:collected`，若玩家加入時被呼叫多次，採集一次物品會觸發多次加入，導致物品成倍增加。

**正確做法**：用旗標確保全域只註冊一次：

```typescript
private _resourceListenerRegistered = false

init(playerId: PlayerId): void {
  if (!this._resourceListenerRegistered) {
    this._resourceListenerRegistered = true
    EventBus.on('resource:collected', ({ playerId: pid, type, amount }) => {
      const itemId = this.resourceToItemId(type)
      if (itemId) this.add(pid, itemId, amount)
    })
  }
}
```

---

## 15. 存檔金幣/XP 用 `Player.getData()` 而非 `GameStateManager_`

**問題**：`handleSave()` 原本用 `Player.getData()` 組存檔資料，但 Host 收不到自己的 `state_delta`，Player 實體的 `gold`/`xp`/`level` 等欄位從未更新。結果存檔後金幣歸零或變舊值。

**權威資料來源**：
- **位置（x/y）**：`Player.getData()`（sprite 即時位置）
- **金幣/XP/等級/HP**：`GameStateManager_.getPlayer(playerId)`（權威狀態）

**正確做法**：

```typescript
const statePlayer = GameStateManager_.getPlayer(pid)
const data = {
  ...p.getData(),
  ...(statePlayer ? {
    gold: statePlayer.gold,
    xp: statePlayer.xp,
    level: statePlayer.level,
    researchLevel: statePlayer.researchLevel,
    hp: statePlayer.hp,
    maxHp: statePlayer.maxHp,
  } : {}),
  inventory: Inventory.get(pid),
}
```

---

## 16. P2 看不到菁英/Boss 怪物視覺、攻擊動畫不同步

**問題**：`MonsterDelta` 缺少 `isElite`、`isBoss`、`attacking` 欄位，Client 端 `applyDelta()` 生成新怪時無從得知等級與狀態，導致：
- P2 所有怪都顯示為普通怪（無橘色/金色）
- P2 看不到怪物攻擊動畫

**正確做法**：`MonsterDelta` 補上可選欄位，`tick()` 廣播時附上狀態，`applyDelta()` 生成與更新時套用：

```typescript
// MonsterDelta
interface MonsterDelta {
  id: string; type: string; hp: number; x: number; y: number; kind: string
  isElite?: boolean; isBoss?: boolean; attacking?: boolean
}

// tick() 廣播
{ id: m.id, ..., isElite: m.isElite || undefined, isBoss: m.isBoss || undefined, attacking: m.isAttacking || undefined }

// applyDelta() 更新
if (u.attacking) ex.attackAnim()

// applyDelta() 新建
this._spawn(u.type, u.x, u.y, u.kind, u.id, u.isElite ?? false, u.isBoss ?? false)
```

> `Monster` 需補 `get isAttacking()` 公開 getter 才能在 `tick()` 讀取。

---

## 17. `DayNight.resize()` 未立即重繪 overlay

**問題**：`resize()` 只更新內部 `w`/`h` 但不呼叫 `_apply()`，視窗拖曳後要等到下一幀計時才重繪，導致夜晚 overlay 短暫殘留錯誤尺寸。

**正確做法**：

```typescript
resize(w: number, h: number): void {
  this.w = w
  this.h = h
  this._apply()   // 立即重繪，不等下一幀
}
```

---

## 18. resize 事件用 `app.screen` 而非 `window.innerWidth/Height`

**問題**：PixiJS `app.screen` 在 `resize` 事件觸發的當下有一幀延遲，導致 `DayNight` overlay 與島嶼圓圈圖層用舊尺寸計算，出現閃爍或位置錯誤。

**正確做法**：

```typescript
// ❌
window.addEventListener('resize', () => {
  dayNight.resize(app.screen.width, app.screen.height)
})

// ✅
window.addEventListener('resize', () => {
  dayNight.resize(window.innerWidth, window.innerHeight)
})
```

> 凡是在 `resize` handler 裡需要即時尺寸的地方，一律用 `window.innerWidth/Height`。

---

## 19. `setInventory()` 不會自動觸發 `inventory:changed`

**問題**：`Inventory.setInventory()` 直接覆蓋背包，但不 emit `inventory:changed` 事件，導致 Host 讀存檔後 HotbarUI/CraftingUI 未更新；Client 加入時 hotbar 空白。

**正確做法**：呼叫 `setInventory()` 後手動補發事件：

```typescript
// Host 路徑
Inventory.setInventory(myPlayerId, myData.inventory)
EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: Inventory.get(myPlayerId) })

// Client 路徑
Inventory.setInventory(myPlayerId, myPData.inventory)
hotbarUI.show(Inventory.get(myPlayerId))
```

---

## 20. 採集游標被物件層遮住

**問題**：`selectorLayer`（採集選格高亮）被加到 `camera` 時，若加入順序在 `objectsLayer` 之前，會被建築/資源節點遮住，無法互動。

**正確做法**：`selectorLayer` 必須在 `camera.addChild(...)` 的**最後**加入，確保 z 軸最高：

```typescript
const worldLayer    = camera.addChild(new Container())
const objectsLayer  = camera.addChild(new Container())
// ... 其他圖層 ...
const selectorLayer = camera.addChild(new Container())   // ← 最後加入，置頂
```

---

## 21. 自動存檔只存世界，不存玩家背包

**問題**：原本 `startAutoSave()` 只存世界資料，玩家金幣/背包在自動存檔時不保存，只有手動存（`save:request`）才完整。

**正確做法**：自動存檔改為 `setInterval` emit `save:request`，與手動存檔走相同路徑：

```typescript
setInterval(() => {
  EventBus.emit('save:request', {})
}, AUTO_SAVE_INTERVAL_MS)
```

> `save:request` handler 需一併處理 `nightCount`/`dayCount`/`dayTimeS`，與手動存檔行為完全一致。

---

## 22. 木橋只能放在水上；其他建築不能放在水上

**問題**：原本 `BuildingSystem.canPlace()` 沒有水域檢查，導致玩家可以把牆、塔等建築放在水裡，或把木橋放在陸地上。

**正確做法**：`BuildingSystem.setWaterChecker()` 注入水域判斷函數，`canPlace()` 內分別處理：

```typescript
// main.ts 注入
buildingSystem.setWaterChecker((wx, wy) => worldMap.isWater(wx, wy))

// BuildingSystem.canPlace() 內部
if (buildingDefId === 'wooden_bridge') {
  if (!tileIsWater) return false  // 木橋必須在水上
} else {
  if (tileIsWater) return false   // 其他建築不能在水上
}
```

---

## 快速診斷清單

遇到問題時依次檢查：

- [ ] src/ 下有 .js 檔？ → `find src -name "*.js"`
- [ ] Vite 正常運行？ → `netstat -an | grep 5175`
- [ ] PeerJS 信令伺服器運行？ → `netstat -an | grep 9000`
- [ ] 瀏覽器 DevTools Console 有錯？ → 檢查紅色錯誤
- [ ] Network 標籤有失敗的請求？ → 檢查 CORS、連線狀態
- [ ] LocalStorage 數據損壞？ → DevTools → Application → Clear Site Data
