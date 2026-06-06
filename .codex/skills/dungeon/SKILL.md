---
name: dungeon
description: 遺跡模組總綱：程序化地城生成、地城場景、Boss 房機制、地城敵人/Boss 生成與 AI、寶箱放置、進出實例化地城。重建地城相關先看這份，再按需展開 reference 子檔。
---

# dungeon 模組總綱

本檔是 `src/dungeon/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`dungeon/index`](./index/reference.md) — Look up here when rebuilding the dungeon module's public export surface — what to import and from where.
- [`dungeon/DungeonGenerator`](./DungeonGenerator/reference.md) — Look up here when rebuilding procedural dungeon room/corridor layout, RNG seeding, branch-based room placement, and boss-room selection logic.
- [`dungeon/DungeonScene`](./DungeonScene/reference.md) — Look up here when rebuilding PixiJS dungeon rendering, enemy/chest/boss spawning, per-frame AI movement, hit detection, chest loot, and portal exit logic.
