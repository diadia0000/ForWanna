---
name: main
description: 遊戲整合進入點 src/main.ts（4031 行）的重建總綱。串接所有模組、建立 PixiJS 圖層、處理鍵盤/滑鼠輸入、跑遊戲主迴圈、實作 Host/Client 權威同步。這是最致命的一塊——少了它，其他重建好的模組只是一盤散沙。重建專案、釐清模組如何被組裝、初始化順序、輸入流程、主迴圈每幀做什麼、或任何「整合層」問題，務必從這份開始，再按需展開同目錄的 reference_01～05 子檔。
---

# main.ts（整合進入點 / Integration Entry Point）

> 模組：root｜角色：唯一的進入點與整合層。一個巨大的 `async function bootstrap()`，把 core / network / world / player / resources / treasure / inventory / building / save / ui / render / combat / dungeon / quest 全部模組組裝起來，建立 PixiJS 圖層、註冊輸入、串連 EventBus、跑主迴圈，並實作 Host/Client 權威同步。
>
> 檔頭原註解：「Agent 10 負責 — src/main.ts，整合所有系統的入口，只有整合者可以修改此檔案」。

## 為什麼這份最致命
所有其他模組（各自有 SKILL）都是「零件」；main.ts 是把零件裝成整台機器的**裝配圖 + 配線圖 + 啟動程序**。少了它，重建出來的 TileMap、Player、Inventory、UI… 彼此不認識、沒有圖層、沒有輸入、沒有迴圈——一盤散沙。重建順序上，**先重建 `types/index.ts`（型別契約）與各模組，最後重建 main.ts 收口**。

## 漸進式重建：先讀本檔總綱，再按需展開 reference 子檔
本檔是索引與骨架。細節（含逐段真實程式碼）拆在同目錄五份 reference：

| 子檔 | 涵蓋行段 | 內容 |
|------|----------|------|
| `reference_01_bootstrap_render.md` | 78–581 | 初始化序列、相機/圖層堆疊、視窗/DPR 同步、鎖縮放、斷線覆蓋層、系統實例化、全域狀態與常數、地圖/小地圖、遺跡進出、手榴彈/士兵/特效、採集 XP 與浮字 |
| `reference_02_ui_world_player.md` | 582–1173 | 全部 UI 面板實例化與接線、拆除面板、UI Toast、背包暫存、放置模式、掉落物、水/節點/建築碰撞、玩家升級/重生/死亡 |
| `reference_03_interaction_input.md` | 1174–2543 | 互動偵測/瞄準/提示、採集與攻擊判定、滑鼠 pointer 處理、市場/研究/基地/兵營回呼、**鍵盤輸入大型處理器**、Host 端 `_doAttack`/`_unlockIsland`/`_goddessPray` |
| `reference_04_eventbus_gameloop.md` | 2544–3540 | EventBus 串連（事件→動作清單）、水面閃光、**主迴圈每幀子系統**（輸入/怪物/基地加成/手榴彈/士兵/農場/防禦塔/夜晚/飢餓/魔法泡泡/島嶼高亮/手持/手電筒） |
| `reference_05_start_network.md` | 3541–4031 | 難度選擇 Modal、`startGame()` Host/Client 分支、存檔還原、樹木再生、網路事件監聽、`i18n:changed` 重繪、`bootstrap()` 呼叫 |

另有可執行驗證腳本 `reconstruct.sh`（見最後一節）。

## 啟動序列（骨架，務必照順序）
```typescript
import './style.css'
// ...所有模組 import（見下方「模組裝配清單」）...

async function bootstrap() {
  await initI18n()                 // 1. 先載語系，之後 t() 才有字串
  const app = await createApp()    // 2. 建 PixiJS Application（見 core/App）
  await loadGameAssets()           // 3. 載 sprites（失敗靜默降級）
  GameLoop.start(app)              // 4. 啟動 ticker（見 core/GameLoop）

  // 5. 建相機與圖層（見 reference_01）
  // 6. 視窗同步 / 鎖縮放 / 斷線覆蓋層（reference_01）
  // 7. 實例化所有系統（reference_01）
  // 8. 實例化所有 UI（reference_02）
  // 9. 定義所有 helper（reference_01~03）
  // 10. 註冊鍵盤 / 滑鼠輸入（reference_03）
  // 11. EventBus 串連（reference_04）
  // 12. 主迴圈回呼（reference_04）
  // 13. 難度 Modal / startGame / 存檔還原（reference_05）
  // 14. 網路事件監聽 / i18n:changed / game:start（reference_05）
}

bootstrap()   // 檔案最後一行
```

## 圖層堆疊（z-order，由下而上）— 重建必對
全部掛在 `camera`（一個 `Container`，`camera.scale.set(CAMERA_ZOOM)`），移動 camera 即可跟隨玩家：
```typescript
const CAMERA_ZOOM = 1.5
const camera       = app.stage.addChild(new Container()); camera.scale.set(CAMERA_ZOOM)
const worldLayer   = camera.addChild(new Container())      // ① TileMap
const islandRingGfx= camera.addChild(new PIXI.Graphics())  // ② 鎖定島嶼圈（tile 上、物件下）
const objectsLayer = camera.addChild(new Container())      // ③ 資源/建築/玩家（共用）
objectsLayer.sortableChildren = true                       //    啟用 Y 排序做 2.5D 遮擋
const resourceLayer = buildingLayer = playerLayer = objectsLayer  // 相容舊引用，全指向 objectsLayer
const dropLayer    = camera.addChild(new Container())      // ④ 掉落物
const fxLayer      = new FxLayer(camera)                   // ⑤ 特效（世界座標）
const selectorLayer= camera.addChild(new Container())      // ⑥ 採集游標（最上層）
const dayNight     = new DayNight(app.stage, w, h)         // 螢幕座標，掛 stage 最上層（不在 camera）
```
要點：`objectsLayer.sortableChildren = true` 是 2.5D 遮擋的關鍵；resource/building/player 三層其實是同一個容器（用 `zIndex` = y 排序）。DayNight 夜晚遮罩在 `app.stage` 上、用螢幕座標，**不**進 camera。

## 模組裝配清單（import 一覽，重建配線用）
```typescript
import { createApp } from './core/App'
import { EventBus } from './core/EventBus'
import { GameLoop } from './core/GameLoop'
import { GameStateManager_ } from './core/GameState'
import { initI18n, t } from './core/i18n'
import { NetworkClient, NetworkHost, RoomManager } from './network'
import { ISLAND_UNLOCK_COST, TileMap, WORLD_CONFIG, WorldGen } from './world'
import { ClientPrediction, Player } from './player'
import { Spawner } from './resources'
import { TreasureSpawner } from './treasure'
import { CraftingSystem, ITEMS, Inventory, RECIPES } from './inventory'
import { RESEARCH_UPGRADE_COSTS } from './inventory/data/researchUpgradeCosts'
import { BUILDING_DEFS, BuildingSystem } from './building'
import { SaveManager, SyncProtocol } from './save'
import { RESOURCE_CONFIG } from './resources/resourceConfig'
import { pickResourceForSpawn } from './resources/spawnConfig'
import type { BagType } from './ui'
import { BagUI, BarracksUI, BaseCoreUI, BuildingUI, CraftingUI, EquipUI, FurnaceUI,
         HUD, HotbarUI, InventoryUI, LobbyScreen, MarketUI, ResearchUI,
         createSelectorGfx, marketPricing, paintSelectorGfx } from './ui'
import { DayNight, FxLayer } from './render'
import { loadGameAssets } from './render/AssetLoader'
import { getItemIconMarkup } from './render/ItemSpriteRegistry'
import { MonsterSpawner, getArmorDef, getArmorName, getWeaponDef } from './combat'
import { DungeonScene, generateDungeon } from './dungeon'
import { QuestSystem, QuestUI } from './quest'
import * as PIXI from 'pixi.js'
import type { Difficulty } from './combat/MonsterSpawner'
import type { PlayerId, PlayerInput, ResourceNode, ResourceType } from './types'
```

## 系統實例化（單例，bootstrap 內各持一份）
```typescript
const tileMap         = new TileMap()
const spawner         = new Spawner(resourceLayer)
const treasureSpawner = new TreasureSpawner(objectsLayer)
const buildingSystem  = new BuildingSystem(buildingLayer)
const craftingSystem  = new CraftingSystem()
const players         = new Map<PlayerId, Player>()
const prediction      = new ClientPrediction()
const monsterSpawner  = new MonsterSpawner(objectsLayer)
const questSystem     = new QuestSystem()
const questUI         = new QuestUI(questSystem)
const dungeonScene    = new DungeonScene(objectsLayer)
// UI：lobby/hud/hotbarUI/inventoryUI/craftingUI/buildingUI/barracksUI/baseCoreUI/
//     furnaceUI/marketUI/researchUI/equipUI/bagUI…（接線見 reference_02）
```

## 全域可變狀態（跨 helper 共享，重建時要先宣告）
這些 `let/const` 定義在 `bootstrap()` 頂層，被眾多 helper 與主迴圈共用——**漏宣告會導致一連串 ReferenceError**：
- 身分/輸入：`myPlayerId=''`、`inputState={up,down,left,right}`、`selectedDir={dx:1,dy:0}`、`selectedPoint={x,y,clientX,clientY,hasPointer}`、`selectorFlashUntil`、`currentMapName`、`clientPlayerHydrationChecked`
- 戰鬥/視覺：`lastAttackMs`、`lastNightState`、`laserLastHitMs`、`laserOrbGfx`、`flashlightGfx/On/Mask`、`playerReach=1`
- 集合：`drops:Map`、`grenades:[]`、`soldiers:[]`、`openedChests:Set`、`goddessCooldowns:Map`、`barracksSpawnTimer:Map`、`farmProduceTimer:Map`
- 遺跡：`inDungeon`、`dungeonReturnX/Y`、`currentDungeonKey`
- 難度/夜晚/飢餓:`currentDifficulty:'normal'`、`nightCount`、`lastHungerDecay`、`lastHungerRegen`、`foodBiteCount`、`lastFoodItemId`

### 關鍵常數（魔術數字，務必照抄）
```typescript
const CAMERA_ZOOM = 1.5
const GRENADE_FUSE_MS = 1500
const GRENADE_RADIUS  = 48 * 3          // TILE_SIZE * 3
const SOLDIER_SPAWN_INTERVAL = 30_000
const FARM_PRODUCE_INTERVAL  = 30_000   // 每 30 秒掉 2 顆漿果
const SOLDIER_MAX_PER_BARRACKS = 3
const SOLDIER_HP = 50, SOLDIER_ATK = 8, SOLDIER_SPEED = 80   // px/s
const SOLDIER_ATTACK_RANGE = 48 * 1.4   // TILE_SIZE * 1.4
const SOLDIER_ATTACK_CD_MS = 1200
const SOLDIER_RESPAWN_MS = 60_000
const PLAYER_SPRITE_IDS = ['player','player.monk2','player.boy','player.eskimo'] as const
// FOOD_DEFS：berry/tomato/purple_grape/onion/carrot/pumpkin/watermelon
//   每項 { bites:3, hungerRestore:30, icon:emoji }
// HARVEST_XP：type → [min,max]（採集給經驗，見 reference_01）
```

## 輸入總表（鍵盤）— 細節見 reference_03
用 `e.code`（非 `e.key`）判定，分 `keydown`/`keyup` 兩個 window listener：
- 移動：`KeyW/A/S/D` 或方向鍵 → 設 `inputState` 並更新 `selectedDir`（朝向）
- `Escape`：關面板 / 取消放置
- `KeyQ`：切換任務面板 `questUI.toggle()`
- `Backspace`/`Delete`：拆除確認面板
- `KeyE`：**主互動鍵**（依面前格子：進/出遺跡、熔爐冶煉 3:1、市場賣資源、工作站升研究、基地核心升級、兵營、床、女神像祈禱、開寶箱「優先級最高」、修陷阱）
- `KeyF`/`Space`：攻擊
- `KeyR`：手電筒開關（手持手電筒時）/ 食物咬食
- `KeyU`、`KeyG`(非 Ctrl)、`KeyM`：其他功能（見 reference_03）
- 數字鍵 hotbar 選格由 `HotbarUI` 自己監聽
滑鼠：`app.canvas` 上 `pointermove`（更新選格/瞄準）、`pointerdown`（採集/攻擊/放置）、`contextmenu`（右鍵，阻預設）、`pointerleave`。

## Host / Client 權威模型（貫穿全檔）
- `RoomManager.role` 決定身分。**Host 是唯一權威**：跑怪物 AI、資源耗盡、攻擊結算、解鎖島嶼、女神祈禱、樹木再生、士兵/農場/防禦塔等，算完用 `SyncProtocol`/state_delta 廣播。
- **Client** 送 `PlayerInput` 給 Host，主要做視覺與本地預測（`ClientPrediction`），透過 `state_full`/`state_delta`/`player_list` 套用 Host 狀態。
- 視覺型效果（手榴彈飛行/爆炸動畫、粒子）所有端都跑；**權威型結算只 Host 跑**。重建每個子系統時都要分清這條界線（各 reference 會標 Host-only）。

## 重建提示（全域層級）
- **最後重建、且要先有型別與各模組**：main.ts 依賴幾乎所有模組與 `types/index.ts`；先把它們重建好，再收口 main。
- **嚴守初始化順序**：`initI18n → createApp → loadGameAssets → GameLoop.start → 圖層 → 系統 → UI → helper → 輸入 → EventBus → 主迴圈 → 啟動流程`。順序錯（例如 t() 在 initI18n 前、UI 在 app 前）會 runtime 爆。
- **PixiJS v8**：`app.canvas`（非 v7 `app.view`）、`app.renderer.resize(w,h,dpr)`；DPR 要在 resize 時跟著更新，否則縮放後整個畫面糊掉、夜晚遮罩只蓋半邊（見 reference_01 的 `syncViewportSize`）。
- **圖層共用**:resource/building/player 是同一個 `objectsLayer`（靠 `sortableChildren` + zIndex 做深度），別拆成三個容器。
- **`e.code` 不是 `e.key`**：按鍵判定用實體鍵碼，才不受輸入法/大小寫影響。
- **全域狀態先宣告**:bootstrap 內的 `let/const` 是眾多閉包 helper 的共享狀態；重建時先把這份清單擺上，再貼 helper，避免 TDZ/ReferenceError。
- **已知 dead code**:檔尾 `client:state_full` handler 在 `syncClientFullState(state); return` 之後還有一段不可達程式碼——重建時可省略那段（見 reference_05）。
- **GameController.ts 不在此圖中**:該檔未被 main.ts 或任何檔 import（dead code），不參與整合；不要把它接進來。

## reconstruct.sh（可執行驗證腳本）
同目錄附 `reconstruct.sh`：列出重建檢查清單，並在重建後跑 `tsc --noEmit` 與 build 驗證 main.ts 能編譯、所有 import 對得上。用法：
```bash
bash .claude/skills/main/reconstruct.sh          # 印出重建檢查清單
bash .claude/skills/main/reconstruct.sh --verify # 跑 tsc 與 build 驗證
```
