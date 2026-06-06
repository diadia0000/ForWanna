---
name: quest-index
description: Look up here when rebuilding the quest module's public barrel export — which symbols are exported and which are intentionally omitted.
---

# quest/index.ts

> 模組：quest｜角色：Barrel export，定義 `src/quest/` 的公開介面邊界

## 公開 API

```typescript
export { QuestSystem } from './QuestSystem'
export { QuestUI }     from './QuestUI'
export { MILESTONES }  from './milestones'
```

## 核心邏輯

3 行 re-export，無邏輯。

## EventBus 互動

無。

## 依賴

- `./QuestSystem` — 主要的進度狀態機類別
- `./QuestUI` — DOM 面板 UI 類別
- `./milestones` — 里程碑資料陣列

## 重建提示

- `QuestProgress`、`QuestCompleted`（type 別名）、`Milestone`、`MilestoneCategory`、`CATEGORY_ICONS`、`CATEGORY_NAMES` 均未從 index 重新匯出；需要這些型別/常數的呼叫端必須直接從子模組 import（`@/quest/milestones`、`@/quest/QuestSystem`）。
- 外部模組（如 `main.ts`）只需從 `@/quest` import `QuestSystem` 和 `QuestUI` 即可完成整合。
- `MILESTONES` 匯出是讓整合者可以在外部統計里程碑數量或迭代，但進度追蹤邏輯仍由 `QuestSystem` 封裝。
