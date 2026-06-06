---
name: world
description: 世界地圖模組總綱：程序化世界生成、tile 地圖渲染、chunk 管理。重建地圖生成、tile 查詢/渲染、chunk 載入先看這份，再按需展開 reference 子檔。
---

# world 模組總綱

本檔是 `src/world/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`world/index`](./index/reference.md) — Look up here to understand what the world module exports and how external modules import from it.
- [`world/TileMap`](./TileMap/reference.md) — Look up here to rebuild PixiJS tile rendering, three rendering tiers (JSON sprites / Anokolisa sprites / PIXI.Graphics fallback), water wave animation, and world-to-tile coordinate conversion.
- [`world/WorldGen`](./WorldGen/reference.md) — Look up here to rebuild deterministic procedural world generation, island biome/tile assignment, seeded RNG, resource spawning, and island unlock logic.
