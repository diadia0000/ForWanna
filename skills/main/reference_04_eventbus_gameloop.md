# main.ts 重建參考 04:EventBus 串連與主迴圈

> 涵蓋 src/main.ts 第 2544–3540 行

本份說明 `bootstrap()` 內「事件訂閱(EventBus / window)」、「水面閃光 timer」與「GameLoop 主迴圈每幀回呼」三大區塊。所有數值取自原始碼,未杜撰。多人採 Host/Client 權威模型,以 `RoomManager.role === 'host'` 判斷;凡涉及狀態變更/廣播者為 **Host-only**,純視覺/相機/UI 為**所有端**執行。

---

## 1. EventBus 串連(約 2544–2874)

### 1.1 事件 → 動作對照清單

| 事件名 | 來源 | Host-only? | 處理動作摘要 |
| --- | --- | --- | --- |
| `network:connected` | EventBus | 是(Host 接收連線) | 建立 `Player`、加入 `players` map 與 `playerLayer`、`Inventory.init`、還原 Client 帶來的背包、`assignPlayerSprites`、送 `state_full` 給該玩家、HUD 更新人數 |
| `network:disconnected` | EventBus | 是 | `player.destroy()`、移出 map、`GameStateManager_.removePlayer`、更新 HUD 人數 |
| `network:input` | EventBus | 是(開頭 `role !== 'host' return`) | 多 sub-type dispatcher(見 1.2) |
| `resource:depleted` | EventBus | 是 | 從 world.resources 過濾掉該節點、廣播 `removedResources` |
| `ui:open_inventory` | EventBus | 否 | `inventoryUI.show(Inventory.get(myPlayerId))` |
| `ui:open_crafting` | EventBus | 否 | `craftingUI.show(RECIPES, 背包, researchLevel)` |
| `ui:open_building` | **window.addEventListener** | 否 | `buildingUI.show(BUILDING_DEFS, 背包)`(用 window 事件繞過 GameEvents 型別限制) |
| `save:request` | EventBus | 兩端皆處理(內部分流) | Host 存世界+所有玩家;Client 只存自身 localStorage(見 1.3) |
| `save:complete` | EventBus | 否 | HUD 右下角顯示「已存檔」綠色 toast(2 秒後移除) |

> `ui:open_inventory` / `ui:open_crafting` 由 HUD 按鈕與快捷鍵(I / C)發出,事件 handler 才注入真正的背包資料。建築面板因型別限制改用 `window` 事件(B 鍵)。

### 1.2 `network:input` 子類型 dispatcher(Host 權威)

開頭即守衛:`if (RoomManager.role !== 'host') return`。各 sub-type:

| `input.type` | 動作 |
| --- | --- |
| `move` | 軸向碰撞檢查(`isMovementBlockedAt`,前探 `±10px`)→ `normalizeMove` → `player.applyInput` → 廣播 `state_delta {players:{[id]:{x,y}}}` |
| `build` | `canPlace` 驗證 → `buildingSystem.place` → 廣播 `{buildings:[building]}` |
| `attack` | 由 `getInteractionOrigin(p)` 取原點 → `_doAttack(playerId, x, y, dirX, dirY, damage, range, arc)` |
| `unlock_island` | `_unlockIsland(playerId, ix, iy)` |
| `furnace_smelt` | 熔爐冶煉驗證(見下) |
| `build_upgrade` | `buildingSystem.upgrade` → 廣播 `{buildings:{[id]:{level,hp,maxHp}}}`、刷新 hotbar |
| `demolish_building` | `buildingSystem.demolish` → 退還 75% 材料(`Math.ceil(cost*0.75)`)→ 廣播 `{demolishedBuildings:[id]}` |
| `market_buy` | 每日設計圖固定價 **100,000 金幣**,驗證金幣後給 1 個物品 |
| `market_sell` | 用 `marketPricing.getPrice` 計價,`earned = round(price*actual*100)/100`,扣物品給金幣 |
| `pray` | 女神像祈禱,冷卻 **3 分鐘**(`3*60*1000`),用 `goddessCooldowns` map 記錄;通過則 `_goddessPray` |
| `harvest` | 採集節點(見下) |

**熔爐冶煉 SMELT 表**(三種配方,iron/gold 比 3:1,gold_coin 比 1:1 且為貨幣):
```typescript
const SMELT = {
  iron:      { oreId: 'iron', ingotId: 'ingot',     ratio: 3, isCurrency: false },
  gold:      { oreId: 'gold', ingotId: 'gold_ingot', ratio: 3, isCurrency: false },
  gold_coin: { oreId: 'gold', ingotId: 'gold_coin',  ratio: 1, isCurrency: true  },
}
const def = SMELT[recipe]
const oreAvail   = inv.find(i => i.itemId === def.oreId)?.amount ?? 0
const maxIngots  = Math.floor(oreAvail / def.ratio)
const amount     = Math.min(smel.amount, maxIngots)
// amount>0 時：扣礦 amount*ratio；isCurrency→加 gold；否則 Inventory.add ingot；皆廣播 inventory(及 gold)
```

**harvest 防作弊距離檢查**(容差 `playerReach + 0.8` 格,`playerReach` 預設 1):
```typescript
const hdx = player.x - node.x, hdy = player.y - node.y
const maxDist = TILE_SIZE * (playerReach + 0.8)
if (hdx*hdx + hdy*hdy > maxDist*maxDist) return
// 先快照 node.getData() 再 hit()，避免 depleted→destroy 後取不到
const harvestDmg = Math.max(1, input.damage ?? 1)   // 魔法泡泡會帶 damage
const afterHp = nodeSnap.hp - harvestDmg
node.hit(harvestDmg, playerId)
if (afterHp <= 0) _grantHarvestXP(...)              // 耗盡：授 XP+素材，移除由 resource:depleted 處理
else broadcast state_delta {resources:{[id]:{hp: max(0,afterHp)}}}
```

### 1.3 `save:request` 分流(try/catch,失敗顯示紅色 toast)

- **Host**:
  - 把日夜狀態寫回 world:`world.nightCount = nightCount`、`world.dayCount = dayNight.currentDayCount`、`world.dayTimeS = dayNight.currentTimeS`。
  - `currentMapName` 保險預設 `world_${seed}`,`SaveManager.saveWorld(world, currentMapName)`。
  - Host 自己位置寫進 `localStorage['forager_map_pos'][seed] = {x,y}`。
  - 逐玩家存檔:金幣/XP/等級以 `GameStateManager_` 為真實來源,位置以 Player sprite 為真實來源。
  - 本機玩家(`pid === myPlayerId`)額外存 `_bags = {bag_small, bag_large}`,存檔鍵為 **`${stableId}__${world.seed}`**(每世界獨立進度),並 `SyncProtocol.saveLocalPlayer`(跨世界保留身分)。
- **Client**:只更新 per-map 位置(`forager_map_pos[worldSeed]`)與 `SyncProtocol.saveLocalPlayer(自身資料 + inventory)`。
- 結束時 `EventBus.emit('save:complete', {})`。

---

## 2. 水面閃光 timer(約 2875–2885)

獨立 `setInterval`,**每 1200ms** 從 `waterPositions` 隨機挑幾格產生 shimmer 特效。挑選數量公式:
```typescript
let waterPositions: { x: number; y: number }[] = []
setInterval(() => {
  if (waterPositions.length === 0) return
  const count = Math.min(25, Math.floor(waterPositions.length * 0.008) + 5)
  for (let i = 0; i < count; i++) {
    const wp = waterPositions[Math.floor(Math.random() * waterPositions.length)]
    fxLayer.spawnWaterShimmer(wp.x, wp.y)
  }
}, 1200)
```
數量 = `min(25, floor(水面格數*0.008)+5)`(下限 5、上限 25)。純視覺,所有端執行。

---

## 3. 主迴圈 GameLoop 回呼(約 2886–3540)

`GameLoop.addCallback((_delta, tick) => {...})`。開頭 `if (!myPlayerId) return`。`_delta` 為 GameLoop 步進量,另多處用 `app.ticker.deltaMS`(毫秒)與 `nowMs = performance.now()`。**以下按每幀實際執行順序**列出。

### 3.0 Client sprite hydration(一次性)
旗標 `clientPlayerHydrationChecked`,首幀若 Client 尚無本機 sprite,呼叫 `assignPlayerSprites()` + `upsertPlayerSprite(...)`。

### 3.1 本地玩家連續移動輸入(所有端)
- 先 `emit('interaction:prompt', getCurrentInteractionPrompt())`。
- 由 `inputState` 算 `dx/dy`(右-左、下-上)。
- 碰撞:`inDungeon` 時用 `dungeonScene.isFloor`(含 `PLAYER_COLLISION_RADIUS` 三點檢查);否則 `isMovementBlockedAt(±10px)` 軸向擋。
- `normalizeMove` 後:
  - **Host**:`applyInput` 並廣播 `{players:{[me]:{x,y}}}`。
  - **Client**:`prediction.predict(input, x, y, tick)` 客端預測 → `syncFromServer(predicted)`,並 `NetworkClient.send({type:'input', ...})`。

### 3.2 玩家動畫 + Y 排序(所有端)
```typescript
players.forEach(p => { p.update(_delta); p.sprite.zIndex = p.y + 22 })  // +22 腳底對齊基線
```

### 3.3 各子系統 update(所有端)
- `fxLayer.update(_delta)`
- `!inDungeon` 時 `monsterSpawner.update(_delta)`(視覺更新)
- 夜晚遮罩尺寸安全網:畫面尺寸(含縮放)變動就 `dayNight.resize`
- `dayNight.update(app.ticker.deltaMS)`、`treasureSpawner.update()`、`buildingSystem.update()`

### 3.4 遺跡每幀更新(所有端,`inDungeon`)
`dungeonScene.update(x, y, deltaMS, onDamage)`。受傷回呼計算護甲減免 `dmg*(1-defPct)`(四捨五入到小數第一位),扣 HP、飄字、HUD 更新;HP<=0 加入 `deadPlayers`,2 秒後 `_respawnPlayer`。

### 3.5 怪物系統 AI + 廣播(**Host-only**,`!inDungeon`)
- `setDifficulty(currentDifficulty)`、`setNightCount(nightCount)`。
- 算本機玩家所在「環」:`stridePx = ISLAND_STRIDE*TILE_SIZE`,`ring = round(max(|ix|,|iy|))` → `setPlayerRing`。
- `monsterSpawner.tick(nowMs, pMap)` 取得 deltas。
- **每 4 tick 廣播一次**(降網路壓力):`if (tick % 4 === 0 && deltas.length > 0)` → broadcast `{monsters: deltas}`。

### 3.6 基地核心加成(**Host-only**,每幀計算)
範圍 `CORE_RANGE = 8*TILE_SIZE`,找最近 `base_core`(hp>0):
```typescript
const lv = nearestCore.b.level
const hpBonus  = lv > 1 ? (0.10 + (lv - 2) * 0.10) : 0  // lv2 起每級 +10% 最大 HP
const atkBonus = lv > 1 ? (0.10 + (lv - 2) * 0.08) : 0  // lv2 起每級 +攻擊
const regenPerSec = [0,5,8,10,12,15,18,22,28,35][lv - 1] ?? 0  // 各級每秒回血查表
const REGEN_INTERVAL = 5000  // 被動回血每 5 秒結算一次
// baseMaxHp = 100 + (level-1)*15；maxHp = baseMaxHp*(1+hpBonus)
// 旗標 _coreRegenNext 控制節流；atkBonus 存到 globalThis.__coreAtkBonus 供 _doAttack 用
```
不在範圍內則 `__coreAtkBonus = 0`。

### 3.7 手榴彈飛行 + 爆炸(視覺所有端,傷害 Host-only)
反向遍歷 `grenades`。拋物線:x 線性,y 帶 `-sin(tProgress*PI)*40` 弧度,`rotation = tProgress*PI*4`,`tProgress = min(elapsed/fuseMs, 1)`。`elapsed >= fuseMs` 爆炸:飄字 + `spawnDepletionBurst('gold')` + 銷毀 sprite。**Host** 計算傷害:
```typescript
const GRENADE_DMG = 60
// GRENADE_RADIUS = 48*3 = 144px（檔頭常數）
if (dist < GRENADE_RADIUS) {
  const dmg = Math.floor(GRENADE_DMG * (1 - dist / GRENADE_RADIUS * 0.4))  // 邊緣最多 -40%
  monsterSpawner.hitMonster(m.id, dmg, myPlayerId)
}
```

### 3.8 士兵系統(**Host-only**)
相關常數(檔頭):`SOLDIER_MAX_PER_BARRACKS = 3`、`SOLDIER_SPAWN_INTERVAL = 30_000`、`SOLDIER_ATK = 8`、`SOLDIER_SPEED = 80`(px/s)、`SOLDIER_ATTACK_RANGE = 48*1.4`、`SOLDIER_ATTACK_CD_MS = 1200`、`SOLDIER_RESPAWN_MS = 60_000`。
- **生成**:每座 `barracks`(hp>0)存活士兵 < 3 且 `nowMs >= barracksSpawnTimer`,`spawnSoldier`,計時 +30s。
- **重生**:死亡士兵 `nowMs >= respawnAt` 回到兵營中心、滿血復活。
- **AI**(`dtSec = deltaMS/1000`):追擊範圍 `TILE_SIZE*12`,找最近怪;距離 > `SOLDIER_ATTACK_RANGE` 則以 `SOLDIER_SPEED*dtSec` 移動靠近;否則每 `SOLDIER_ATTACK_CD_MS` 攻擊(`hitMonster(SOLDIER_ATK)`)。同步 sprite,`zIndex = y+21`。
- **受傷**:近戰範圍內每 `CD*1.5` 受 `floor(monster.damage*0.5)`;HP<=0 死亡並設 `respawnAt = nowMs + 60_000`。
- **清理**:兵營已不存在的士兵銷毀並移出陣列。

### 3.9 農場產出(**Host-only**,士兵區塊內)
`FARM_PRODUCE_INTERVAL = 30_000`。每座 `farm`(hp>0)每 30 秒在 2×2 中心(`x+TILE_SIZE, y+TILE_SIZE`)`spawnDropByItemId(cx, cy, 'berry', 2)` 並飄字。

### 3.10 防禦塔自動攻擊(**Host-only**)
針對 `['tower','laser_tower','cannon_tower']`(hp>0)。中心 `(x+TILE_SIZE/2, y+TILE_SIZE/2)`。屬性表(隨等級 `lv` 縮放):
```typescript
const CONFIG = {
  tower:        { range: TILE_SIZE * 4,  dmg: 15,           cd: 2000, aoe: 0 },
  laser_tower:  { range: TILE_SIZE * 15, dmg: 50 + lv * 20, cd: 2000, aoe: 0 },
  cannon_tower: { range: TILE_SIZE * 8,  dmg: 20 + lv * 8,  cd: 3500, aoe: TILE_SIZE * 2 },
}
```
- 冷卻:用建築上的動態鍵 `__tshot_${b.id}` 記上次射擊,`nowMs - lastShotMs < cfg.cd` 則跳過。
- 目標選擇:**菁英/Boss 優先**(過濾 `isElite||isBoss` 取最近),否則一般怪最近者;`distToTarget > cfg.range` 跳過。
- `aoe > 0`(加農砲):範圍爆炸,`d < TILE_SIZE` 全傷、否則半傷(`floor(dmg*0.5)`)。
- `aoe === 0`(瞭望/雷射):單體 `hitMonster(cfg.dmg)`,飄字區分 ⚡(雷射)/🏹(瞭望)。

### 3.11 夜晚計數(所有端)
`isNightNow = dayNight.phase === 'night'`。日→夜:`questSystem.add('nights', 1)` 且 `nightCount++`。夜→日:`emit('save:request', {})`(守城結束自動存檔;handler 內已 host 守衛)。以 `lastNightState` 偵測邊緣。

### 3.12 飢餓系統(所有端,僅影響本機 pd)
- **衰減**:每 10 秒(`nowMs - lastHungerDecay > 10_000`)`hunger -= 2`(0~100,10 格)。
- **回血**:每 2 秒(`> 2_000`)若 `hunger > 80` 且未滿血,`hp = round(min(maxHp, hp+5)*10)/10`(回 5 HP),飄字 `+5 ❤️`;**Host** 額外廣播 `{players:{[me]:{hp}}}`。

### 3.13 魔法泡泡自動採集 + 旋轉(視覺所有端,採集 Host 直執行/Client 送 input)
僅在 `hotbarUI.activeItem?.itemId === 'laser_orb'` 時:
- 旋轉光球 `laserOrbGfx`(lazy 建立):`orbAngle = performance.now()/380`,`orbScale = 0.85 + sin(now/190)*0.15`,軌道 `cos*32 / sin*22`。
- 採集節流:`getWeaponDef('laser_orb')` 的 `cooldown`;射程 `laserDef.range * TILE_SIZE`。找範圍內最近活節點:
  - **Host**:快照後 `closest.hit(laserDef.resDmg)`,未耗盡則廣播 hp delta。
  - **Client**:`NetworkClient.send` 一筆 `harvest` input(帶 `damage: laserDef.resDmg`)。
- 切換到別格時 `laserOrbGfx.visible = false`。

### 3.14 掉落物自動撿取(**Host-only**)
`drops.size > 0` 時遍歷:任一玩家距 drop `< TILE_SIZE*2` 即撿。`Inventory.add` → 更新 `GameStateManager_` → 非本機者 `sendTo` inventory delta、飄字 `spawnHarvest`、移除 sprite。最後廣播 `{removedDrops: ids}`。

### 3.15 相機跟隨(所有端)
```typescript
camera.x = Math.round(app.screen.width  / 2 - me.x * CAMERA_ZOOM)
camera.y = Math.round(app.screen.height / 2 - me.y * CAMERA_ZOOM)
```

### 3.16 選格(selector)位置更新(所有端)
非放置模式(`!placingDefId`)時更新 `selectedPoint`:無滑鼠則沿 `selectedDir` 取 `getInteractionRadius()`;有滑鼠則 `screenToWorld` 後夾在互動半徑內。`selectorFlashUntil` 控制 invalid/normal 上色。放置中則隱藏。

### 3.17 鎖定島嶼圈高亮 + 費用標籤(所有端)
`islandRingGfx.clear()` 後掃 `ix,iy ∈ [-4,4]`(共用 `ISLAND_LABEL_POOL_SIZE = 12` 個 DOM 標籤,超過 `break outer`)。
- 偵測範圍 `DETECT_RANGE = ISLAND_STRIDE*TILE_SIZE*0.9`(~950px,靠近才顯示)。
- 圈半徑 `RING_R = (ISLAND_SAND_R + 2)*TILE_SIZE`。
- 跳過已解鎖(`unlockedIslands`,預設 `['0,0']`)。費用 `ISLAND_UNLOCK_COST[ring]`(查不到 9999);`canAfford = gold >= cost` 決定綠(0x44ee88)/橘(0xdd7733)。
- 標籤定位用 `window.innerWidth/Height`(避免 `app.screen` 一幀延遲),夾在邊界 70/40px 內。未用完的標籤 `display:none`。

### 3.18 手持物品顯示(所有端,本機)
`setHeldToolItem(activeItem?.itemId, activeItemKind)`、`setHeldToolAim(selectedPoint - origin)`。

### 3.19 手電筒光束(所有端,本機)
條件:`flashlightOn && 背包有 flashlight && dayNight.darkness > 0.1`。
- `flashlightGfx`(`blendMode='add'`,疊加提亮)+ `flashlightMask`(三角形+圓形遮罩),掛在 `app.stage`(夜晚暗化層之上)。
- 朝向由 `currentFacingDir` 換成角度(RIGHT=0、LEFT=π、DOWN=π/2、UP=-π/2)。
- 扇形:前方 10 格(`coneLen = TILE_SIZE*10*CAMERA_ZOOM`)、半角 32 度;圓罩半徑 `TILE_SIZE*3.2*CAMERA_ZOOM`。
- 光亮度 `alpha = 0.95 * darkness`(越暗越亮),整片 rect 被遮罩裁切以避免重疊處過亮。世界座標需 `*CAMERA_ZOOM + camera` 轉螢幕座標。
- 不符合條件則 `flashlightGfx.visible = false`。

### 3.20 HUD 更新(所有端)
`hud.update(GameStateManager_.getPlayer(myPlayerId))`,放在每幀最後。

---

## 4. 重建提示 / 易踩雷

- **每幀順序很重要**:移動輸入要先於玩家 `update`/zIndex 排序,排序又要先於相機跟隨;選格/手持/手電筒依賴最新玩家位置與 `selectedPoint`,故放在後段。HUD 放最後,確保讀到本幀所有狀態變更。
- **Host vs Client 分工**:Host 跑「權威/狀態變更」——怪物 AI、基地核心回血、士兵、農場、防禦塔、手榴彈傷害、掉落撿取、所有 `state_delta` 廣播;Client 只跑本地預測移動(`prediction.predict`)並把 input 送給 Host,其餘等 Host 廣播再 `syncFromServer`。
- **視覺(所有端)vs 權威(僅 Host)的同一系統會雙軌**:手榴彈飛行/爆炸動畫所有端各自跑(對齊本地時間),但傷害只 Host 算;魔法泡泡旋轉視覺所有端,採集 Host 直接 hit、Client 改送 `harvest` input。重建時別把視覺也包進 host 守衛,否則 Client 看不到動畫。
- **deltaTime / 節流用法**:位移用 `app.ticker.deltaMS/1000`(秒)乘速度確保幀率無關(士兵);計時/冷卻一律用 `performance.now()`(`nowMs`)與絕對時間戳(`nextSpawn`、`_coreRegenNext`、`__tshot_${id}`、`lastHungerDecay`),不要用累加 delta。怪物廣播 `tick % 4` 降頻;水面閃光是獨立 `setInterval(1200)` 不在主迴圈內。
- **動態屬性鍵**:防禦塔冷卻、核心回血都用掛在物件上的私有鍵(`(b as any).__tshot_${b.id}`、`(pd as any)._coreRegenNext`),`__coreAtkBonus` 經 `globalThis` 傳給 `_doAttack`——重建攻擊計算時別漏讀這個全域。
- **關鍵魔術數字速查**:核心範圍 8 格/回血每 5 秒/回血查表 `[0,5,8,10,12,15,18,22,28,35]`;手榴彈 144px、傷害 60(邊緣 -40%);士兵 3 名上限、生成/重生 30s/60s、追擊 12 格、攻速 1200ms、傷 8、速 80px/s;農場每 30 秒掉 2 漿果;塔射程/冷卻見 3.10 CONFIG;飢餓每 10 秒 -2、>80 每 2 秒 +5HP;市場設計圖 100,000 金、拆除退 75%、女神冷卻 3 分鐘、熔爐比 3:1(金幣 1:1);島嶼偵測 0.9 步長、標籤池 12。
- **存檔鍵格式**:本機玩家以 `${stableId}__${world.seed}` 存檔達成「每世界獨立進度」,`SyncProtocol.saveLocalPlayer` 只保跨世界身分;`forager_map_pos[seed]` 存每地圖位置。夜→日邊緣會自動觸發 `save:request`。
