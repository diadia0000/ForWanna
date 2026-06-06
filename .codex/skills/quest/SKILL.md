---
name: quest
description: 任務/里程碑模組總綱：進度追蹤、里程碑定義、任務面板 UI。重建任務系統先看這份，再按需展開 reference 子檔。
---

# quest 模組總綱

本檔是 `src/quest/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`quest/index`](./index/reference.md) — Look up here when rebuilding the quest module's public barrel export — which symbols are exported and which are intentionally omitted.
- [`quest/QuestSystem`](./QuestSystem/reference.md) — Look up here when rebuilding the core quest progress tracking engine — state model, milestone check logic, and the callback hook for completion events.
- [`quest/QuestUI`](./QuestUI/reference.md) — Look up here when rebuilding the FTB-style quest sidebar panel — HTML structure, tab system, progress bar rendering, toast notifications, and i18n wiring.
- [`quest/milestones`](./milestones/reference.md) — Look up here when rebuilding the milestone data — full schema, every entry with exact id/trackKey/goal values, category icons, and category names.
