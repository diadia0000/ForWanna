# EventBus 事件定義表

EventBus 是 Forager 中唯一的跨模組通訊管道。禁止直接 import + 呼叫其他模組的方法，所有通訊都透過事件。

> 本表是事件契約的**唯一真實來源（single source of truth）**。表格內容必須與
> `src/types/index.ts` 的 `GameEvents` 介面、以及 `src/` 內實際的 `EventBus.emit` /
> `EventBus.on` 呼叫保持一致。新增或修改事件需經架構師審核。

## 使用方式

```typescript
import { EventBus } from '@/core/EventBus'

// 發送事件
EventBus.emit('resource:collected', { playerId, type: 'wood', amount: 3 })

// 監聽事件
EventBus.on('player:moved', ({ playerId, x, y }) => {
  console.log(`Player ${playerId} moved to (${x}, ${y})`)
})

// 取消監聽
EventBus.off('player:moved', handler)
```

## 所有 EventBus 事件（不可自行新增，需架構師審核）

下列事件均已在 `src/types/index.ts` 的 `GameEvents` 介面中型別化。

| 事件名 | Payload | 發送者 | 監聽者 | 說明 |
|--------|---------|--------|--------|------|
| `player:moved` | `{ playerId, x, y }` | Player (`Player.move`) | — (型別已定義，主程式可監聽) | 玩家移動位置 |
| `player:levelup` | `{ playerId, level }` | （目前僅 EventBus 測試發送） | — | 玩家升級 |
| `player:died` | `{ playerId }` | （目前僅 EventBus 測試發送） | `main.ts`（觸發事件存檔 `requestEventSave`） | 玩家死亡 |
| `resource:collected` | `{ playerId, type, amount }` | ⚠️ **目前無 emit 點**（採集改由 `main.ts` 直接呼叫 `Inventory.add` + 任務計數，見 `main.ts` 註解） | Inventory、`main.ts`（皆已 `EventBus.on` 註冊，但因無人 emit 故永不觸發＝死監聽） | 資源被採集（型別已定義、保留備用；架構師需決定補 emit 點或移除監聽） |
| `resource:depleted` | `{ nodeId }` | ResourceNode（HP 歸零時）、Spawner 測試 | Spawner（回收/重生）、GameController、`main.ts` | 資源節點耗盡 |
| `inventory:changed` | `{ playerId, inventory }` | Inventory（add/remove）、GameController、`main.ts` | CraftingUI、InventoryUI、HotbarUI（重繪 UI） | 背包內容變更（`inventory` 為 `InventoryItem[]`） |
| `craft:success` | `{ playerId, recipeId, result }` | CraftingSystem (`craft`) | `main.ts`（任務計數，使用 `recipeId`） | 製作成功（`result` 為 `InventoryItem[]`） |
| `build:placed` | `{ playerId, buildingId, x, y }` | BuildingSystem (`place`) | `main.ts`（任務計數 + 事件存檔） | 建築被放置 |
| `building:upgraded` | `{ playerId, buildingId, newLevel }` | BuildingSystem (`upgrade`) | `main.ts`（事件存檔） | 建築升級（核心等） |
| `network:input` | `{ playerId, input }` | NetworkHost（收到 client input） | GameController、`main.ts`（套用輸入） | 網路輸入（`input` 為 `PlayerInput`） |
| `network:connected` | `{ playerId }` | NetworkHost | GameController、`main.ts`、UI | 玩家連線 |
| `network:disconnected` | `{ playerId }` | NetworkHost、NetworkClient（與 host 斷線時 `playerId: 'host'`） | GameController、`main.ts`、UI | 玩家斷線 |
| `save:request` | `{}` | HUD（存檔鈕）、`main.ts`（定時 / 事件觸發） | GameController、`main.ts`（執行存檔） | 要求儲存 |
| `save:complete` | `{}` | SaveManager、GameController、`main.ts` | GameController、`main.ts`、UI（顯示提示） | 儲存完成 |
| `ui:open_inventory` | `{}` | HUD（按鍵 / Dock） | GameController、`main.ts`（開啟背包 UI） | 開啟背包 |
| `ui:close_inventory` | `{}` | （型別已定義，目前無 emit 點） | InventoryUI（隱藏自身） | 關閉背包 |
| `ui:open_crafting` | `{}` | HUD（按鍵 / Dock） | GameController、`main.ts`（開啟合成 UI） | 開啟合成 |
| `ui:close_crafting` | `{}` | （型別已定義，目前無 emit 點） | CraftingUI（隱藏自身） | 關閉合成 |
| `treasure:opened` | `{ chestId, loot }` | TreasureSpawner (`openChest`) | `main.ts`（將 loot 入庫） | 寶箱被打開（`loot` 為 `Array<{ itemId, amount }>`） |
| `i18n:changed` | `{ lang }` | Core i18n (`I18n.setLang`) | 幾乎所有 UI（HUD、各種 UI panel、Building 標籤、DungeonScene 等）重繪 | 語言切換後請各 UI 重繪 |

### ⚠️ 已在程式碼出現但**尚未型別化**的事件（需補進 `GameEvents` 或移除）

下列事件在 `BuildingSystem.ts` 中以 `EventBus.emit('...' as any, ...)` 發送，
繞過了 `GameEvents` 型別檢查，目前**沒有任何監聽者**。架構師需決定：
補進 `src/types/index.ts` 並指派監聽者（例如 Render 做受傷閃爍、UI 做血條），
或從程式碼移除。

| 事件名 | Payload | 發送者 | 監聽者 | 狀態 |
|--------|---------|--------|--------|------|
| `building:damaged` | `{ buildingId, hp, maxHp }` | BuildingSystem (`takeDamage`) | 無 | ⚠️ 未型別化（`as any`），無監聽者 |
| `building:destroyed` | `{ buildingId, defId }` | BuildingSystem (`takeDamage`，HP≤0) | 無 | ⚠️ 未型別化（`as any`），無監聽者 |
| `building:repaired` | `{ buildingId, hp }` | BuildingSystem (`repair`) | 無 | ⚠️ 未型別化（`as any`），無監聽者 |

## window CustomEvent（非 EventBus 的跨模組協調）

部分跨模組訊號使用瀏覽器原生 `window.dispatchEvent(new CustomEvent(...))` 傳遞，
而非 EventBus（多半因為需要在 DOM / 非 PixiJS 層銜接，或 client 端狀態同步）。
這些**不在** `GameEvents` 型別內，payload 放在 `CustomEvent.detail`。

| 事件名 | `detail` Payload | 發送者 | 監聽者 | 說明 |
|--------|------------------|--------|--------|------|
| `client:state_full` | 完整 `GameState` | NetworkClient（收到 `state_full`） | GameController、`main.ts` | client 收到 host 全量狀態，重新渲染世界 |
| `client:state_delta` | `StateDelta` 訊息 | NetworkClient（收到 `state_delta`） | GameController、`main.ts` | client 收到增量狀態更新 |
| `client:player_list` | `PlayerData[]` | NetworkClient（收到 `player_list`） | GameController、`main.ts` | client 收到玩家清單，補建/更新 sprite |
| `peer:signaling-lost` | 無 | RoomManager | `main.ts`（顯示重連 overlay） | PeerJS signaling 連線中斷 |
| `peer:signaling-restored` | 無 | RoomManager | `main.ts`（隱藏重連 overlay） | PeerJS signaling 連線恢復 |
| `ui:open_building` | 無 | HUD（按鍵 / Dock） | GameController、`main.ts`（開啟建築模式） | 開啟建築 UI（注意：此事件走 window，非 EventBus） |
| `game:start` | `{ role: 'host' \| 'client'; mapName?; playerName?; roomCode? }` | LobbyScreen（建房 / 加入） | `main.ts`（啟動遊戲場景） | 從大廳進入遊戲 |

## 新增事件的流程

1. 確認是否真的需要新事件（避免重複或濫用）
2. 在此表格中加入新事件定義
3. 同步更新 `src/types/index.ts` 的 `GameEvents` 介面，使事件完整型別化
4. 通知架構師審核
5. 更新 CLAUDE.md（若為重大跨模組決策）

## 注意事項

- **命名規範**：`模組:動作`（如 `player:moved`）、`模組:動作:狀態`（如 `network:connected`）、UI 操作用 `ui:動作`
- **Payload 設計**：盡量簡潔，只包含監聽者真正需要的資訊
- **監聽者註冊時機**：在 `main.ts`（或 GameController）統一註冊，不要分散在各模組 constructor
- **事件順序**：不要假設事件順序，除非明確文件化
- **型別一致性**：所有 EventBus 事件都應在 `GameEvents` 內型別化；出現 `as any` 即代表契約缺失，需補上
