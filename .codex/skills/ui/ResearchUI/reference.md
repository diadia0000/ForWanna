---
name: research-ui
description: Rebuild the research-lab upgrade UI — two-column list/detail, in-progress timer bar, level rollover.
---

# ui/ResearchUI.ts

> 模組：ui｜角色：工作站（研究所）升級介面，雙欄選擇式（仿 CraftingUI），含升級進度計時條

## 公開 API

- `new ResearchUI()` — append `#research-ui`
- `ResearchUI.show(currentLevel: number): void` — 啟動計時器
- `ResearchUI.hide(): void` — 停止計時器
- `ResearchUI.setUpgradeProgress(durationSecs: number): void` — 開始一次升級進度
- `ResearchUI.setOnUpgrade(fn: (toLevel: number) => void): void`

## 核心邏輯

### show — 預選第一個未完成項目

```typescript
show(currentLevel: number): void {
  this.currentLevel = currentLevel
  const firstAvail = RESEARCH_UPGRADE_COSTS.findIndex(c => c.level > currentLevel)
  this.selectedIndex = firstAvail >= 0 ? firstAvail : 0
  this._renderList(); this._renderDetail()
  this.el.style.display = 'flex'
  this._startTicker()
}
```

### 列表項：完成判定

`isDone = currentLevel >= cost.level`；完成顯示 ✅ + done-mark，否則 🔬。徽章 `Lv {currentLevel} / 10`。

### 升級進度（performance.now 計時）

```typescript
setUpgradeProgress(durationSecs: number): void {
  this.upgradeDuration = durationSecs * 1000
  this.upgradeEndTime = performance.now() + this.upgradeDuration
  this.upgradeInProgress = true
  this._renderDetail()
}
private _startTicker(): void {
  if (this.tickInterval !== null) return
  this.tickInterval = window.setInterval(() => {
    if (!this.upgradeInProgress) return
    const now = performance.now()
    const remaining = Math.max(0, (this.upgradeEndTime - now) / 1000)
    if (remaining <= 0) {
      this.upgradeInProgress = false
      this.currentLevel = Math.min(10, this.currentLevel + 1)  // 完成 → 升一級
      this._stopTicker(); this._renderList(); this._renderDetail()
    } else {
      const pct = Math.max(0, (this.upgradeDuration - (this.upgradeEndTime - now)) / this.upgradeDuration) * 100
      fillEl.style.width = pct + '%'
      leftEl.textContent = t('ui.research.time_left', { secs: remaining.toFixed(1) })
    }
  }, 100)  // 每 100ms tick
}
```

### 細節：材料/時間/金幣 + 升級按鈕

`cost.materials` 空 → 「免費」；否則逐項 icon+名+×amount。按鈕僅在 `!isDone && !upgradeInProgress` 顯示，點擊：

```typescript
private _executeUpgrade(): void {
  if (!this.onUpgrade || this.upgradeInProgress) return
  const cost = RESEARCH_UPGRADE_COSTS[this.selectedIndex]
  if (!cost) return
  this.onUpgrade(cost.level)   // 回傳選的路線 level，main.ts 決定如何處理
}
```

## EventBus 互動

- on `i18n:changed` — 可見時重繪兩欄
- `document` keydown `Escape` — 開啟時 hide
- 升級走注入回呼 `onUpgrade(toLevel)`，非事件

## 依賴

- `@/inventory/data/researchUpgradeCosts` RESEARCH_UPGRADE_COSTS / type ResearchUpgradeCost
- `@/inventory` ITEMS、`@/types` ItemId、`@/render/ItemSpriteRegistry` getItemIconMarkup
- `@/core/i18n` t、`@/core/EventBus`

## 重建提示

- `tickInterval` 必須在 `hide()` 清除（`_stopTicker`），否則 setInterval 洩漏；`_startTicker` 有 `!== null` 防重入。
- 進度條 fill 寬度算法：已過時間 / 總時長，而非剩餘時間。
- 完成升級時 UI 自行 `currentLevel + 1`（樂觀更新，上限 10）。
- 容器 `#research-ui` 顯示 `flex`；雙欄 `#research-list` + `#research-detail` 在 `.research-body` 內。
- `cost.level - 1` 用於顯示「第 n 階」（level 從 2 起算路線）。
