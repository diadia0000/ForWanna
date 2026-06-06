# Agent 權責分配表

## Agent 1 — Core Engine
- **負責目錄**：`src/core/`
- **負責檔案**：`App.ts`, `GameLoop.ts`, `EventBus.ts`, `GameState.ts`
- **輸出介面**：
  - `App.getInstance()` → PixiJS Application
  - `GameLoop.start() / stop()`
  - `EventBus.on/off/emit`
  - `GameState.get() / set() / getPlayer(id) / getWorld()`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Core Engine 完成

---

## Agent 2 — Network Layer
- **負責目錄**：`src/network/`
- **負責檔案**：`NetworkHost.ts`, `NetworkClient.ts`, `MessageTypes.ts`, `RoomManager.ts`, `index.ts`
- **輸出介面**：
  - `RoomManager.createRoom()` → `roomCode: string`
  - `RoomManager.joinRoom(code)` → `Promise<void>`
  - `NetworkHost.broadcast(msg)` / `NetworkHost.sendTo(peerId, msg)`
  - `NetworkClient.send(msg)`
- **依賴**：EventBus（透過 import，這裡允許直接 import core）
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Network Layer 完成

---

## Agent 3 — World / Map
- **負責目錄**：`src/world/`
- **負責檔案**：`WorldGen.ts`, `TileMap.ts`, `ChunkManager.ts`, `index.ts`
- **輸出介面**：
  - `WorldGen.generate(seed)` → `WorldData`
  - `TileMap.render(stage, worldData)`
  - `TileMap.getTileAt(x, y)` → `TileType`
  - `ChunkManager.loadChunk(cx, cy)`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] World/Map 完成

---

## Agent 4 — Player
- **負責目錄**：`src/player/`
- **負責檔案**：`Player.ts`, `ClientPrediction.ts`, `index.ts`
- **輸出介面**：
  - `Player` class，有 `.x .y .hp .update(delta) .applyInput(input) .sprite`
  - `ClientPrediction.predict(input)` / `.reconcile(serverState)`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Player 完成

---

## Agent 5 — Resources
- **負責目錄**：`src/resources/`
- **負責檔案**：`ResourceNode.ts`, `Spawner.ts`, `resourceConfig.ts`, `index.ts`
- **輸出介面**：
  - `ResourceNode` class，有 `.id .type .x .y .hp .hit(damage)` → 發出 `resource:collected` / `resource:depleted`
  - `Spawner.spawnAll(worldData)` → `ResourceNode[]`
  - `Spawner.respawn(nodeId, delay)`
- **依賴**：EventBus
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Resources 完成

---

## Agent 6 — Inventory + Crafting
- **負責目錄**：`src/inventory/`
- **負責檔案**：`Inventory.ts`, `CraftingSystem.ts`, `data/items.ts`, `data/recipes.ts`, `index.ts`
- **輸出介面**：
  - `Inventory.add(playerId, itemId, amount)` / `.remove()` / `.get(playerId)`
  - `CraftingSystem.canCraft(playerId, recipeId)` → `boolean`
  - `CraftingSystem.craft(playerId, recipeId)` → 發出 `craft:success`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Inventory+Crafting 完成

---

## Agent 7 — Building
- **負責目錄**：`src/building/`
- **負責檔案**：`BuildingSystem.ts`, `data/buildings.ts`, `index.ts`
- **輸出介面**：
  - `BuildingSystem.canPlace(buildingId, x, y)` → `boolean`
  - `BuildingSystem.place(playerId, buildingId, x, y)` → 發出 `build:placed`
  - `BuildingSystem.getAll()` → `Building[]`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Building 完成

---

## Agent 8 — Save System
- **負責目錄**：`src/save/`
- **負責檔案**：`GameDB.ts`, `SaveManager.ts`, `SyncProtocol.ts`, `index.ts`
- **輸出介面**：
  - `SaveManager.saveWorld(worldData)`
  - `SaveManager.loadWorld()` → `WorldData | null`
  - `SaveManager.savePlayer(playerData)`
  - `SaveManager.loadPlayer(playerId)` → `PlayerData | null`
  - `SyncProtocol.exportPlayerData(playerId)` → `string` (JSON)
  - `SyncProtocol.importPlayerData(json)` → `PlayerData`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Save System 完成

---

## Agent 9 — UI / HUD
- **負責目錄**：`src/ui/`
- **負責檔案**：`LobbyScreen.ts`, `HUD.ts`, `HotbarUI.ts`, `InventoryUI.ts`, `CraftingUI.ts`, `BuildingUI.ts`, `FurnaceUI.ts`, `index.ts`
- **輸出介面**：
  - `LobbyScreen.show() / hide()`，包含房號顯示與輸入
  - `HUD.update(playerData)`，顯示 HP、XP、金幣
  - `InventoryUI.show(inventory) / hide()`
  - `CraftingUI.show(recipes, inventory) / hide()`
- **依賴**：EventBus
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] UI/HUD 完成

---

## Agent 10 — 整合者
- **等待條件**：以上所有 Agent 的【完成狀態】全部打勾後才開始
- **負責檔案**：`src/main.ts`（唯一有權限修改）
- **任務**：
  1. 讀取所有模組的 index.ts 了解輸出介面
  2. 在 main.ts 依正確順序初始化各系統
  3. 確認 EventBus 事件流串連正確
  4. 測試 Host / Client 兩種啟動路徑
- **依賴**：所有其他 Agent
- **禁止動**：src/main.ts 以外的任何檔案
- **完成狀態**：[x] 整合完成

---

## Agent 11 — Combat
- **負責目錄**：`src/combat/`
- **負責檔案**：`Monster.ts`, `MonsterSpawner.ts`, `WeaponDefs.ts`, `index.ts`
- **輸出介面**：
  - `Monster` class，AI 狀態機（idle/wander/chase/attack）
  - `MonsterSpawner.spawn()` → 野怪生成
  - `MonsterSpawner.spawnSiege()` → 守城怪生成
- **依賴**：EventBus
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Combat 完成

---

## Agent 12 — Quest
- **負責目錄**：`src/quest/`
- **負責檔案**：`QuestSystem.ts`, `QuestUI.ts`, `milestones.ts`, `index.ts`
- **輸出介面**：
  - `QuestSystem.track()` → 進度追蹤
  - `QuestUI.show() / hide()`
- **依賴**：EventBus
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Quest 完成

---

## Agent 13 — Render
- **負責目錄**：`src/render/`
- **負責檔案**：`FxLayer.ts`, `DayNight.ts`, `AssetLoader.ts`, `index.ts`
- **輸出介面**：
  - `FxLayer.emit()` → 粒子特效
  - `DayNight.update(delta)` → 日夜循環
- **依賴**：EventBus
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Render 完成

---

## Agent 14 — Dungeon（遺跡）
- **負責目錄**：`src/dungeon/`
- **負責檔案**：`DungeonGenerator.ts`, `DungeonScene.ts`, `index.ts`
- **對應 skills**：`skills/dungeon/`
- **輸出介面**：
  - `DungeonGenerator.generate(seed, originX, originY)` → `DungeonLayout`（含 `bossRoomId`，最長分支末端為 Boss 房）
  - `DungeonScene.setup(layout, seed)` / `.hitEnemy(id, dmg)` / `.openChest(id)` / `.findNearbyEnemy()` / `.findNearbyChest()` / `.isFloor(x, y)` / `.setBossKillCallback(fn)`
- **依賴**：EventBus、`@/render`（EntitySpriteDriver）、`@/treasure`（generateLoot）
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Dungeon 完成

---

## Agent 15 — Treasure（寶箱）
- **負責目錄**：`src/treasure/`
- **負責檔案**：`TreasureChest.ts`, `TreasureSpawner.ts`, `treasureConfig.ts`, `index.ts`
- **對應 skills**：`skills/treasure/`
- **輸出介面**：
  - `TreasureSpawner.spawnAll(world)` / `.openChest(id)` → loot（發出 `treasure:opened`）/ `.removeChest(id)` / `.getAllChestsData()` / `.restoreFromSnapshot(data)`
  - `treasureConfig`：`generateLoot(rarity)`、`rollLootRarity(rng)`、`LootRarity` 型別、各品級顏色
- **依賴**：EventBus
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] Treasure 完成

---

## Agent 16 — i18n / 多語系
- **負責目錄**：`src/core/i18n/` ＋ `src/locales/`
- **負責檔案**：`core/i18n/{I18n,detect,index}.ts`、`locales/index.ts`、`locales/{zh-TW,en}/*.ts`（各 22 個 namespace）
- **對應 skills**：`skills/core/i18n/`、`skills/locales/`
- **輸出介面**：
  - `t(key, params?, fallback?)` → `string`（翻譯查詢）
  - `I18n.setLang(lang)` → 切換語言並發出 `i18n:changed`
  - `detect()` → 偵測系統/儲存的語言偏好
- **依賴**：EventBus（emit `i18n:changed`）
- **注意**：`src/core/i18n/` 雖在 core 目錄下，但由本 agent 獨立負責（自 Agent 1 Core Engine 切出）；翻譯字串內容見 `skills/locales`
- **禁止動**：src/ 其他所有目錄
- **完成狀態**：[x] i18n 完成

---

## Event Architect — 架構師（跨模組契約守門人）
- **負責檔案**：`src/types/index.ts`、`.claude/claudemd/events.md`（**唯一有權修改這兩者者**）
- **角色**：所有共用型別（`PlayerData`/`WorldData`/`NetMessage`/`GameEvents`…）與 EventBus 事件契約的唯一真實來源
- **對應 skills**：`skills/types/index/`
- **任務**：
  1. 維護 `GameEvents` 介面，確保所有事件完整型別化（出現 `as any` 即代表契約缺失）
  2. 維持 `events.md` 與 `src/` 內實際 `emit`/`on` 呼叫一致
  3. 審核任何新增事件 / payload 變更 / 共用型別變更
- **啟動順序**：**最先**——其他所有 agent 都依賴此契約，須先定死再並行開發
- **禁止動**：其他 agent 一律不得修改 `src/types/index.ts`
- **完成狀態**：[x] 契約定義完成

---

## 設計原則

### 信息隔離
每個 Agent 只修改自己負責的目錄。禁止跨目錄直接修改（包括 import + 呼叫）。

### 事件驅動
跨模組通訊一律透過 `EventBus.emit/on/off`，詳見 `events.md`。

### 權責明確
代碼審查時，只允許 Agent 在自己的目錄內提交。其他目錄的改動必須由對應 Agent 完成。
