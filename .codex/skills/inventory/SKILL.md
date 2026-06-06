---
name: inventory
description: 背包與合成模組總綱：背包增刪、可合成性檢查、合成執行、物品/配方/研究升級成本資料。重建背包與製作系統先看這份，再按需展開 reference 子檔。
---

# inventory 模組總綱

本檔是 `src/inventory/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`inventory/index`](./index/reference.md) — inventory 模組的公開出口彙整 — 定義外部可 import 的所有符號；重建 inventory 模組入口或確認哪些 symbol 對外暴露時參考此檔案。
- [`inventory/CraftingSystem`](./CraftingSystem/reference.md) — 合成系統主控邏輯 — 驗證材料、扣除材料、給予產物並發射事件；需要重建合成功能時首先參考此檔案。
- [`inventory/Inventory`](./Inventory/reference.md) — 背包核心系統 — 管理所有玩家的主背包狀態、監聽資源採集事件、提供增刪查 API；需要重建背包存取或資源轉換邏輯時首先參考此檔案。
- [`inventory/data/itemKinds`](./data/itemKinds/reference.md) — 物品手持類型分類系統 — 定義所有手持類型 union 並提供 itemId → HeldItemKind 的查詢函數；需要判斷玩家手持物品類型（影響攻擊/採集/裝備行為）時必看此檔案。
- [`inventory/data/items`](./data/items/reference.md) — 全物品定義表與稀有度系統 — 包含每個 itemId 的名稱/圖示/maxStack/賣價，以及 5 級稀有度設定；重建任何物品 UI、交易、背包疊加上限邏輯時必看此檔案。
- [`inventory/data/recipes`](./data/recipes/reference.md) — 全合成配方定義表 — 按解鎖等級分層列出所有配方的材料需求與產出；需要新增/調整合成配方或確認哪些配方在哪個等級解鎖時必看此檔案。
- [`inventory/data/researchUpgradeCosts`](./data/researchUpgradeCosts/reference.md) — 研究所升級成本配置表 — 定義 Lv 2~10 每個研究等級所需材料、黃金和升級時間；需要重建研究系統升級邏輯或 UI 顯示升級成本時必看此檔案。
