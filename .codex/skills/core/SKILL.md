---
name: core
description: 核心層總綱：PixiJS App、GameLoop、EventBus、GameState、i18n。這是唯一可被各模組直接 import 的基礎層；重建主程式生命週期、事件匯流排、全域狀態、語言切換先看這份，再按需展開 reference 子檔。
---

# core 模組總綱

本檔是 `src/core/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`core/i18n/index`](./i18n/index/reference.md) — i18n 模組的公開出口（barrel re-export）。重建時若要決定 i18n 對外暴露哪些 API、或設定 import 路徑（@/core/i18n），參考這份。
- [`core/App`](./App/reference.md) — 實作 PixiJS Application 的建立與全域單例存取（createApp / getApp）。重建專案時，凡是要初始化 PIXI 畫布、設定背景色 / resize / DPR、或任何模組要拿到 app 實例，務必先參考這份。
- [`core/EventBus`](./EventBus/reference.md) — 實作型別安全的全域事件匯流排（on / off / emit / once），是所有跨模組通訊的唯一合法管道。重建任何「模組 A 通知模組 B」的功能前，先讀這份理解訂閱機制與型別綁定。
- [`core/GameLoop`](./GameLoop/reference.md) — 實作固定 60 tick/s 的主迴圈，包裝 PixiJS Ticker、每幀遞增全域 tick、並分發 (delta, tick) 給註冊的 callbacks。重建任何需要「每幀更新」的系統（移動、戰鬥、怪物 AI、同步節流）前先讀這份。
- [`core/GameState`](./GameState/reference.md) — 實作全域單一真實來源（GameState 單例）以及戰鬥/研究等級門檻、屬性成長公式。重建任何讀寫玩家/世界狀態、等級換算、HP/ATK/DEF 計算、tick 推進的功能前，務必先讀這份拿到所有關鍵數值。
- [`core/i18n/I18n`](./i18n/I18n/reference.md) — 實作 i18n 執行核心：載入語系字典、巢狀攤平成 dotted key、t() 翻譯與 {param} 插值、切換語系並廣播事件。重建任何顯示文字、多語切換、翻譯 key 查詢的功能前必讀。
- [`core/i18n/detect`](./i18n/detect/reference.md) — 實作初始語系偵測（localStorage 優先、其次瀏覽器語言、最後 fallback）。重建 i18n 啟動流程、決定預設語言、或處理語系記憶時先讀這份。
