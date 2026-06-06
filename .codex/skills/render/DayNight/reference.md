---
name: render-daynight
description: Look up the day/night cycle timing, phase thresholds, darkness curve, ambient overlay color lerp, and the HTML progress bar that fronts it.
---

# render/DayNight.ts

> 模組：render｜角色：日夜循環系統 — 用 PIXI overlay 畫夜晚暗化，並維護一條 HTML 頂部進度橫條顯示時間/天數。

## 公開 API

- `new DayNight(stage: PIXI.Container, screenW, screenH)` — 建 overlay 掛到 stage，建 HTML bar 先掛 body。
- `update(deltaMs: number): void` — 每幀推進 timeS（毫秒制），跨圈時 `dayCount++`。
- `restore(dayCount, timeS): void` — 從存檔還原（夾住 `dayCount>=1`、`timeS % CYCLE_S`）。
- `skipToMorning(): void` — 用床跳過夜晚：`timeS = 0` 且 `dayCount++`。
- `resize(w, h): void` / `destroy(): void`
- getters：`currentDayCount`、`currentTimeS`、`phase: DayPhase`、`darkness: 0~1`、`isNight: boolean`。

## 核心邏輯

### 時間常數與相位門檻

`CYCLE_S = 600`（10 分鐘一整圈）。相位/暗度以 normalized `t = timeS / CYCLE_S` 計算：

```typescript
const CYCLE_S = 600

get phase(): DayPhase {
  const t = this.timeS / CYCLE_S
  if (t < 0.25 || t >= 0.75) return 'day'
  if (t < 0.35) return 'dusk'
  if (t < 0.65) return 'night'
  return 'dawn'   // 0.65 ~ 0.75
}

get darkness(): number {   // 0=白天 1=全夜
  const t = this.timeS / CYCLE_S
  if (t < 0.25)  return 0
  if (t < 0.35)  return (t - 0.25) / 0.10            // ramp up
  if (t < 0.65)  return 1
  if (t < 0.75)  return 1 - (t - 0.65) / 0.10        // ramp down
  return 0
}

get isNight(): boolean { const p = this.phase; return p === 'night' || p === 'dusk' || p === 'dawn' }
```

### tick 推進（毫秒 delta，跨圈進天）

```typescript
update(deltaMs: number): void {
  if (!this._attached) this._tryAttach()
  const prevT = this.timeS / CYCLE_S
  this.timeS  = (this.timeS + deltaMs / 1000) % CYCLE_S
  const newT  = this.timeS / CYCLE_S
  if (newT < prevT) this.dayCount++   // wrapped past full circle
  this._apply()
}
```

### Overlay 暗化 + 顏色 lerp（黃昏橙 → 深藍 → 黎明橙）

```typescript
private _apply(): void {
  const t = this.timeS / CYCLE_S
  this.overlay.clear()
  const alpha = this.darkness
  if (alpha > 0.004) {
    let color: number
    if      (t < 0.35) color = lerpColor(0xff6600, 0x00001a, (t - 0.25) / 0.10)  // dusk 橙→藍
    else if (t < 0.65) color = 0x00001a                                          // 深夜藍黑
    else               color = lerpColor(0x00001a, 0xff6622, (t - 0.65) / 0.10)  // dawn 藍→橙
    this.overlay.rect(0, 0, this.w, this.h).fill({ color, alpha: Math.min(alpha * 0.62, 0.62) })
  }
  // HTML bar：icon 依相位、dot.left = (t*100)% 、label = DAY {dayCount}
  const icon = phase === 'night' ? '🌙' : phase === 'dusk' ? '🌆' : phase === 'dawn' ? '🌅' : '☀'
}

function lerpColor(a, b, t) {  // 逐通道線性插值，t 夾 0~1
  t = Math.max(0, Math.min(1, t))
  const ar=(a>>16)&0xff, ag=(a>>8)&0xff, ab=a&0xff, br=(b>>16)&0xff, bg=(b>>8)&0xff, bb=b&0xff
  return (Math.round(ar+(br-ar)*t)<<16) | (Math.round(ag+(bg-ag)*t)<<8) | Math.round(ab+(bb-ab)*t)
}
```

### HTML 橫條與延遲掛載

bar 先 `document.body.appendChild`，每幀 `_tryAttach()` 找 `#hud-center`，找到才搬進去（只執行一次，設 `_attached=true`）。bar innerHTML：`#dn-icon` / `#dn-day` / `#dn-track > #dn-dot`，label 用 `i18nT('render.daynight.day', { count }, 'DAY n')`。

## EventBus 互動

- 無直接 EventBus；由 GameLoop 呼叫 `update(deltaMs)`，存檔系統呼叫 `restore` / 讀 getters。

## 依賴

- `pixi.js` — overlay `PIXI.Graphics`。
- `@/core/i18n` — `t as i18nT` 翻譯天數標籤。

## 重建提示

- `update` 吃的是 **毫秒**（內部 `/1000`），別傳秒。
- overlay `eventMode = 'none'`，否則會吃掉滑鼠事件。
- alpha 上限硬封 0.62（`Math.min(alpha * 0.62, 0.62)`）— 夜晚不會全黑。
- 深夜色 `0x00001a`、黃昏 `0xff6600`、黎明 `0xff6622` — 三個都要照抄。
- 相位邊界：day 是「`t<0.25` 或 `t>=0.75`」兩段，不是連續區間。
