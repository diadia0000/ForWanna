---
name: player-index
description: player 模組的公開出口點，重新匯出 Player 與 ClientPrediction；其他模組或整合層需要 import player 功能時，一律從這個 index 進入。
---

# player/index.ts

> 模組：player｜角色：barrel export，將 `Player` 和 `ClientPrediction` 統一從同一路徑對外暴露，隱藏內部檔案結構。

## 公開 API

- `Player` — re-export 自 `./Player`，見 `player/Player.ts` SKILL。
- `ClientPrediction` — re-export 自 `./ClientPrediction`，見 `player/ClientPrediction.ts` SKILL。

## 核心邏輯

僅兩行 re-export，無任何邏輯。

```typescript
export { Player } from './Player'
export { ClientPrediction } from './ClientPrediction'
```

外部使用：

```typescript
import { Player, ClientPrediction } from '@/player'
```

## EventBus 互動

無

## 依賴

- `./Player`：Player 類別。
- `./ClientPrediction`：ClientPrediction 類別。

## 重建提示

- 新增 player 模組的 export（例如未來的 PlayerManager）時，在這裡加一行 re-export 即可，外部呼叫路徑不變。
- 若省略這個 index，其他模組需要寫 `@/player/Player` 路徑，會洩漏目錄結構且不符合 barrel 慣例。
