---
name: equip-ui
description: Rebuild the small fixed equipment widget (armor slot) — inline-styled panel, update/clear armor, unequip.
---

# ui/EquipUI.ts

> 模組：ui｜角色：右下角固定裝備欄小掛件（目前僅護甲格），顯示護甲與防禦%、卸下按鈕

## 公開 API

- `new EquipUI()` — append `#equip-ui`
- `EquipUI.updateArmor(itemId: string, icon: string, name: string, defPct: number): void`
- `EquipUI.clearArmor(): void`
- `EquipUI.setOnUnequip(fn: () => void): void`

## 核心邏輯（近乎完整 — 小檔）

### inline 樣式面板（不依賴外部 CSS）

```typescript
private _build(): HTMLElement {
  const el = document.createElement('div')
  el.id = 'equip-ui'
  el.style.cssText = [
    'position:fixed', 'bottom:90px', 'right:16px',
    'background:#0a1a10', 'border:2px solid #2eb872',
    'border-radius:8px', 'padding:8px 12px', 'z-index:60',
    'font-family:monospace', 'display:flex', 'flex-direction:column', 'gap:4px',
  ].join(';')
  el.innerHTML = `
    <div style="color:#5fdd9f;font-size:0.7rem;letter-spacing:1px">${t('ui.equip.title')}</div>
    <div id="equip-armor-slot" style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:1.2rem" id="equip-armor-icon">—</span>
      <div>
        <div style="color:#aaa;font-size:0.75rem" id="equip-armor-name">${t('ui.equip.no_armor')}</div>
        <div style="color:#4dcc4d;font-size:0.7rem" id="equip-armor-def"></div>
      </div>
      <button id="equip-unequip-btn" style="display:none;...">${t('ui.equip.unequip')}</button>
    </div>`
  el.querySelector('#equip-unequip-btn')!.addEventListener('click', () => this.onUnequip?.())
  return el
}
```

### update / clear armor

```typescript
updateArmor(itemId, icon, name, defPct): void {
  this._armorState = { itemId, icon, name, defPct }   // 記住供 i18n 重建
  iconEl.innerHTML = getItemIconMarkup(itemId, icon)
  nameEl.textContent = name
  defEl.textContent = t('ui.equip.def_pct', { pct: Math.round(defPct * 100) })  // defPct 為 0~1 小數
  btn.style.display = 'block'
}
clearArmor(): void {
  this._armorState = null
  iconEl.innerHTML = '—'; nameEl.textContent = t('ui.equip.no_armor'); defEl.textContent = ''
  btn.style.display = 'none'
}
```

### i18n 重建（保留裝備狀態）

```typescript
EventBus.on('i18n:changed', () => this._rebuildInPlace())
private _rebuildInPlace(): void {
  const newEl = this._build(); this.el.replaceWith(newEl); this.el = newEl
  if (this._armorState) { const s = this._armorState; this.updateArmor(s.itemId, s.icon, s.name, s.defPct) }
}
```

## EventBus 互動

- on `i18n:changed` — `_rebuildInPlace()`（保留 `_armorState`）
- 卸下走注入回呼 `onUnequip`，非事件

## 依賴

- `@/render/ItemSpriteRegistry` getItemIconMarkup、`@/core/i18n` t、`@/core/EventBus`

## 重建提示

- 唯一全 inline-style 的 UI（`position:fixed; bottom:90px; right:16px; z-index:60`），無外部 class 依賴。
- `defPct` 傳入是 0~1 小數，顯示時 `Math.round(defPct * 100)`。
- 重建後必須 replay `_armorState` 才不會丟失當前護甲顯示。
- 常駐顯示（無 show/hide），靠 update/clear 切換護甲格內容。
