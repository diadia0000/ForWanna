---
name: quest-system
description: Look up here when rebuilding the core quest progress tracking engine — state model, milestone check logic, and the callback hook for completion events.
---

# quest/QuestSystem.ts

> 模組：quest｜角色：純狀態機，不監聽 EventBus，不引用任何其他模組，只由外部呼叫 `add()`/`set()` 驅動進度

## 公開 API

- `QuestSystem.add(trackKey: string, amount?: number): void` — 累加 `trackKey` 的計數（預設 +1），之後立即做里程碑檢查
- `QuestSystem.set(trackKey: string, value: number): void` — 直接設定 `trackKey` 的數值，之後立即做里程碑檢查
- `QuestSystem.getProgress(trackKey: string): number` — 回傳目前累計值，未有記錄時回傳 0
- `QuestSystem.isCompleted(id: string): boolean` — 查詢里程碑 id 是否已完成
- `QuestSystem.getCompletionFraction(): { done: number; total: number }` — 回傳完成數與里程碑總數（total 固定 = `MILESTONES.length`）
- `QuestSystem.setCompleteCallback(fn: (id: string) => void): void` — 登錄完成通知 callback（一次只存一個）

## 核心邏輯

### 狀態結構

```typescript
export type QuestProgress = Record<string, number>  // trackKey → 累計值
export type QuestCompleted = Set<string>             // milestone id

private progress:  QuestProgress  = {}
private completed: QuestCompleted = new Set()
private _onComplete?: (id: string) => void
```

### 里程碑掃描（每次 add/set 後呼叫）

```typescript
private _checkMilestones(): void {
  for (const m of MILESTONES) {
    if (this.completed.has(m.id)) continue          // 已完成跳過，避免重複觸發
    const cur = this.progress[m.trackKey] ?? 0
    if (cur >= m.goal) {
      this.completed.add(m.id)
      this._onComplete?.(m.id)
    }
  }
}
```

### 進度累加與設定

```typescript
add(trackKey: string, amount = 1): void {
  this.progress[trackKey] = (this.progress[trackKey] ?? 0) + amount
  this._checkMilestones()
}

set(trackKey: string, value: number): void {
  this.progress[trackKey] = value
  this._checkMilestones()
}
```

## EventBus 互動

無（QuestSystem 本身不監聽也不發送任何 EventBus 事件）。外部整合者（通常是 `main.ts`）負責監聽 `resource:collected`、`craft:success`、`build:placed` 等事件，再呼叫 `QuestSystem.add()` 驅動進度。

## 依賴

- `./milestones` — 取得 `MILESTONES` 陣列用於掃描

## 重建提示

- `_checkMilestones` 在每一次 `add`/`set` 後都全掃一遍所有里程碑；因為 `completed` 已跳過，不會有效能問題，但重建時別改成「只掃最後一個 key 相關的里程碑」——多個里程碑可能共用同一個 `trackKey`（如 `kill1`/`kill10`/`kill50` 都用 `kills`）。
- `_onComplete` 只存一個 callback；若需要多個監聽者，需要在呼叫側做轉發（例如在 `main.ts` 裡用 EventBus 轉發）。
- `getProgress` 對未記錄的 key 回傳 0，不會拋例外。
- `getCompletionFraction().total` 直接取 `MILESTONES.length`，與 `completed.size` 無關，固定反映 milestone 定義檔的長度。
- 此類別無 serialize/deserialize；若需要存檔，外部需直接讀取 `progress` 和 `completed` 的狀態。
