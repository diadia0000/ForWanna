---
name: treasure
description: 寶箱模組總綱：地表寶箱、每島生成、稀有度(common/rare/epic)與掉落表、開箱邏輯、快照存讀。重建寶箱相關先看這份，再按需展開 reference 子檔。
---

# treasure 模組總綱

本檔是 `src/treasure/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`treasure/index`](./index/reference.md) — Lookup for treasure/index.ts — complete re-export list of all public symbols from the treasure module.
- [`treasure/TreasureChest`](./TreasureChest/reference.md) — Lookup for TreasureChestEntity — sprite construction, rarity colouring, glow animation, open() loot return, and interaction model.
- [`treasure/TreasureSpawner`](./TreasureSpawner/reference.md) — Lookup for TreasureSpawner — island-based seeded placement algorithm, chest lifecycle, collision/proximity API, and snapshot sync.
- [`treasure/treasureConfig`](./treasureConfig/reference.md) — Lookup for treasureConfig — complete loot table with exact drop weights and amounts, rarity roll algorithm, and i18n label helpers.
