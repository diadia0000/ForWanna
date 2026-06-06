---
name: types
description: 共享型別總綱：src/types/index.ts 的型別契約導覽。注意此檔只有架構師可改；查詢或重建跨模組型別先看這份，再按需展開 reference 子檔。
---

# types 模組總綱

本檔是 `src/types/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`types/index`](./index/reference.md) — 全模組共用的 TypeScript 型別契約（Vec2 / PlayerData / InventoryItem / ResourceNode / Building / GameState / PlayerInput / NetMessage / StateDelta / GameEvents 等）。重建專案時這是最優先、最基礎的一塊——少了它所有模組都無法編譯；任何模組要 import 共用型別、定義 EventBus 事件、或對齊網路訊息格式，務必先參考並完整重建這份。
