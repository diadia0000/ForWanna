---
name: quest-ui
description: Look up here when rebuilding the FTB-style quest sidebar panel — HTML structure, tab system, progress bar rendering, toast notifications, and i18n wiring.
---

# quest/QuestUI.ts

> 模組：quest｜角色：純 DOM UI，讀取 QuestSystem 狀態渲染進度面板，監聽 `i18n:changed` 重繪，不發送任何事件

## 公開 API

- `new QuestUI(quest: QuestSystem)` — 建構時即建立 DOM 元素並注入 `document.body`，同時注入 CSS（id: `quest-styles`，只注入一次）
- `QuestUI.show(): void` — 顯示面板並呼叫 `refresh()`
- `QuestUI.hide(): void` — 隱藏面板
- `QuestUI.toggle(): void` — 切換顯示/隱藏
- `QuestUI.refresh(): void` — 重繪 tab 高亮、任務列表、完成比例（visible=false 時提早返回）
- `QuestUI.notifyComplete(milestoneId: string): void` — 顯示完成 toast，3 秒後自動移除；若面板可見則同時 `refresh()`

## 核心邏輯

### Tab 與類別順序

固定四個 tab，順序不可更動：

```typescript
const CATEGORIES: MilestoneCategory[] = ['gather', 'combat', 'build', 'explore']
```

預設啟動 tab 為 `'gather'`。

### 任務列表渲染（refresh 內）

```typescript
const items = MILESTONES.filter(m => m.category === this.activeTab)
list.innerHTML = items.map(m => {
  const cur   = Math.min(this.quest.getProgress(m.trackKey), m.goal)  // 上限 clamp 到 goal
  const done  = this.quest.isCompleted(m.id)
  const pct   = Math.round((cur / m.goal) * 100)
  const title = t(`quest.${m.id}.title`, undefined, m.title)
  const desc  = t(`quest.${m.id}.desc`,  undefined, m.desc)
  return `
    <div class="quest-item${done ? ' quest-item--done' : ''}">
      <span class="quest-icon">${done ? '✅' : m.icon}</span>
      <div class="quest-info">
        <div class="quest-title">${title}</div>
        <div class="quest-desc">${desc}</div>
        ${done ? '' : `
        <div class="quest-bar">
          <div class="quest-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="quest-progress">${cur} / ${m.goal}</div>
        `}
      </div>
    </div>
  `
}).join('')
```

完成後的項目：icon 改為 `✅`、class 加 `quest-item--done`（opacity 0.55）、不渲染進度條。

### 完成 Toast 動畫時序

```typescript
notifyComplete(milestoneId: string): void {
  // ...建立 toast DOM...
  document.body.appendChild(toast)
  setTimeout(() => toast.classList.add('quest-toast--show'), 10)    // 10ms 後滑入
  setTimeout(() => {
    toast.classList.remove('quest-toast--show')
    setTimeout(() => toast.remove(), 400)                           // 400ms 滑出動畫後移除
  }, 3000)                                                          // 顯示 3 秒
}
```

### i18n 重繪

```typescript
EventBus.on('i18n:changed', () => this._rebuildHeader())
```

`_rebuildHeader()` 更新 `#quest-title-text` 和 `#quest-close` 文字，然後呼叫 `refresh()`（tab 文字在 refresh 內一併更新）。

### DOM 結構

```
#quest-panel (display: flex, flex-direction: column)
  #quest-header
    #quest-title
      #quest-title-text
      #quest-fraction  ← "done / total"
    #quest-close (button)
  #quest-tabs
    .quest-tab[data-cat="gather"]
    .quest-tab[data-cat="combat"]
    .quest-tab[data-cat="build"]
    .quest-tab[data-cat="explore"]
  #quest-list  ← 動態 innerHTML
```

### CSS 關鍵數值

| 選擇器 | 屬性 | 值 |
|--------|------|----|
| `#quest-panel` | width / max-height | 280px / 70vh |
| `#quest-panel` | position | fixed, right: 16px, top: 50px |
| `#quest-panel` | z-index | 100 |
| `#quest-list` | max-height | calc(70vh - 80px) |
| `.quest-bar` | height | 4px |
| `.quest-bar-fill` | background | #5ab030 |
| `.quest-toast` | position | fixed, bottom: 80px, right: 16px, z-index: 300 |
| `.quest-toast` | transition | transform .35s ease |
| 滑入 class | `.quest-toast--show` | translateX(0)（預設 translateX(120%)） |
| `.quest-item--done` | opacity | 0.55 |

## EventBus 互動

- on `i18n:changed` — 呼叫 `_rebuildHeader()` 重繪面板標題與 tab 文字

## 依賴

- `./milestones` — `MILESTONES`、`CATEGORY_ICONS`、`MilestoneCategory`
- `./QuestSystem` — 型別引用（`type QuestSystem`），用於讀取進度
- `@/core/i18n` — `t()` 翻譯函數，fallback 為 milestone 定義內的中文 title/desc
- `@/core/EventBus` — 訂閱 `i18n:changed`

## 重建提示

- CSS 只注入一次，guard 是 `document.getElementById('quest-styles')`；重建時別移除這個 guard，否則多次建構會重複注入。
- `refresh()` 在 `visible = false` 時提早返回——`notifyComplete` 呼叫 `refresh()` 前有 `if (this.visible)` 判斷，別省略。
- 進度條的 `cur` 用 `Math.min(progress, goal)` clamp，避免超過 100% 寬度。
- `t('quest.${m.id}.title', undefined, m.title)` 的第三參數是 fallback 中文字串，不可省略，否則沒有 i18n key 時顯示空白。
- Toast 的 `show` 動畫要在 `10ms` 後觸發（讓瀏覽器先渲染初始狀態），不能改成同步 `classList.add`。
- Tab 文字在 `refresh()` 內更新（不只在 `_rebuildHeader()`），確保語言切換後重新計算文字。
- `#quest-fraction` 在 `_buildHTML` 初始化時顯示 `0/0`；`refresh()` 每次都更新它。
