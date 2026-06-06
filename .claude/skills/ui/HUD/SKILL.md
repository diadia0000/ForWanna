---
name: hud
description: Rebuild the top HUD (hearts/hunger/XP/gold/room code) and the TAB-hold side-dock keybind help panel.
---

# ui/HUD.ts

> 模組：ui｜角色：頂部狀態列（HP 愛心、飢餓、等級/XP、技能點、金幣、房號）＋右側可重綁按鍵說明 Dock（TAB 壓住顯示）

## 公開 API

- `new HUD()` — append `#hud` 與 `#side-dock`，`bindEvents()`
- `HUD.update(data: PlayerData): void` — 刷新愛心/飢餓/XP/SP/金幣
- `HUD.setRoomCode(code: string | null): void` — 顯示/隱藏房號區
- `HUD.setPlayerCount(current: number, max = 4): void`
- `HUD.show(): void` / `HUD.hide(): void` — hide 同時關 dock

## 核心邏輯

### update — 數值換算公式

```typescript
update(data: PlayerData): void {
  // 愛心：10 顆，依 hp/maxHp 比例 ceil
  const total = 10
  const filled = Math.max(0, Math.min(total, Math.ceil((data.hp / data.maxHp) * total)))
  hearts.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="heart ${i < filled ? 'heart--full' : 'heart--empty'}">♥</span>`).join('')
  hpTextEl.textContent = `${Math.round(data.hp)}/${data.maxHp}`

  // 飢餓條：█/░ 各 10 段（hunger 預設 100）
  const hunger = (data as any).hunger ?? 100
  const bars = Math.max(0, Math.ceil((hunger / 100) * 10))
  segsEl.textContent = '█'.repeat(bars) + '░'.repeat(10 - bars)

  // 等級/XP：下一級門檻 = floor(100 * level^1.5)
  const xpForNext = Math.floor(100 * Math.pow(data.level, 1.5))
  const pct = xpForNext > 0 ? Math.min(100, (data.xp / xpForNext) * 100) : 0
  xpBar.style.width = `${pct}%`

  // 技能點：>0 才顯示
  const sp = (data as any).skillPoints ?? 0
  spEl.style.display = sp > 0 ? '' : 'none'
  goldEl.textContent = `🪙 ${data.gold}`
}
```

### Side Dock — 可重綁按鍵 + 固定按鍵

`keyMap` 預設 `{ inventory:'KeyI', crafting:'KeyC', building:'KeyB' }`。三個「動作列」可點圖示觸發、點 `.dock-key` 重綁；其餘為固定列（移動/攻擊/互動/...滑鼠）。重綁：

```typescript
private remapKey(action: string, kbdEl: HTMLElement): void {
  kbdEl.textContent = '...'; kbdEl.classList.add('dock-key--listening')
  const handler = (e: KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.code !== 'Escape') { this.keyMap[action] = e.code; kbdEl.textContent = this.keyDisplay(e.code) }
    else kbdEl.textContent = this.keyDisplay(this.keyMap[action])
    kbdEl.classList.remove('dock-key--listening')
    window.removeEventListener('keydown', handler, true)
  }
  window.addEventListener('keydown', handler, true)  // capture phase
}
private keyDisplay(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').slice(0, 3)
}
```

點動作列時若點到的是 `.dock-key` 則 return（避免重綁同時觸發開窗）：`if ((e.target as HTMLElement).closest('.dock-key')) return`。

### TAB 顯示 Dock / 開窗鍵

```typescript
private bindEvents(): void {
  window.addEventListener('keyup', (e) => { if (e.code === 'Tab') this.dockEl.style.display = 'none' })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') { e.preventDefault(); this.dockEl.style.display = 'flex'; return }
    if (e.code === this.keyMap.inventory) EventBus.emit('ui:open_inventory', {})
    if (e.code === this.keyMap.crafting)  EventBus.emit('ui:open_crafting', {})
    if (e.code === this.keyMap.building)  window.dispatchEvent(new CustomEvent('ui:open_building'))
  })
}
```

### 房號複製

點 `#hud-room` → `navigator.clipboard.writeText(code)`，成功暫顯 `t('hud.copied')` 1.5s 後還原（期間 `pointerEvents='none'`）；失敗 fallback `prompt()`。

## EventBus 互動

- emit `save:request` `{}` — 點存檔按鈕
- emit `ui:open_inventory` / `ui:open_crafting` `{}` — 按鍵或 Dock 圖示
- on `i18n:changed` — `_rebuildHUDAndDock()`（重建兩個元素並還原 display）
- 非 EventBus：`window.dispatchEvent('ui:open_building')` 給 building 用 window 事件

## 依賴

- `@/types` PlayerData、`@/core/EventBus`、`@/core/i18n` t

## 重建提示

- 圖示全為 inline SVG 常數（`stroke="currentColor"`），不用 emoji，方便 CSS 著色。
- `_rebuildHUDAndDock` 不會 removeEventListener 舊鍵盤監聽（重綁殘留），但 keyMap 邏輯冪等所以無害——保留此設計。
- `update` 用 `(data as any).hunger / .skillPoints` 讀 PlayerData 上非型別欄位，勿改成嚴格存取否則 TS 報錯。
- HUD 顯示用 `flex`；Dock 只在 TAB 壓住時 `flex`，`show()` 不主動開 Dock。
