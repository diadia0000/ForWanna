---
name: player
description: 玩家模組總綱：Player 實體、stats(hp/x/y)、輸入套用、精靈、client-side prediction/reconciliation。重建玩家移動與預測校正先看這份，再按需展開 reference 子檔。
---

# player 模組總綱

本檔是 `src/player/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`player/index`](./index/reference.md) — player 模組的公開出口點，重新匯出 Player 與 ClientPrediction；其他模組或整合層需要 import player 功能時，一律從這個 index 進入。
- [`player/ClientPrediction`](./ClientPrediction/reference.md) — 實作 client-side prediction 與 server reconciliation：本地立即預測玩家移動、收到 Host 確認後修正誤差；只要重建多人移動不卡頓，就必須先來這裡。
- [`player/Player`](./Player/reference.md) — 玩家實體的核心類別：管理 PixiJS sprite 渲染（fallback 幾何圖形 + EntitySpriteDriver manifest 動畫）、移動輸入、朝向、手持工具揮砍動畫，以及從 Host 同步狀態；重建玩家視覺與邏輯時必讀。
