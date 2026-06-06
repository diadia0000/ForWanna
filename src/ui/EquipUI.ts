// src/ui/EquipUI.ts — 裝備欄 UI
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

export class EquipUI {
  private el: HTMLElement
  private onUnequip: (() => void) | null = null

  // 記住目前裝備狀態，供重繪用
  private _armorState: { itemId: string; icon: string; name: string; defPct: number } | null = null

  constructor() {
    this.el = this._build()
    document.body.appendChild(this.el)

    // 語言切換時重繪
    EventBus.on('i18n:changed', () => this._rebuildInPlace())
  }

  private _rebuildInPlace(): void {
    const newEl = this._build()
    this.el.replaceWith(newEl)
    this.el = newEl
    // 恢復裝備狀態
    if (this._armorState) {
      const s = this._armorState
      this.updateArmor(s.itemId, s.icon, s.name, s.defPct)
    }
  }

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
        <button id="equip-unequip-btn" style="display:none;background:#3a0a0a;border:1px solid #aa4444;color:#ff8888;border-radius:4px;font-size:0.65rem;padding:2px 6px;cursor:pointer;">${t('ui.equip.unequip')}</button>
      </div>
    `
    el.querySelector('#equip-unequip-btn')!.addEventListener('click', () => this.onUnequip?.())
    return el
  }

  setOnUnequip(fn: () => void): void {
    this.onUnequip = fn
  }

  updateArmor(itemId: string, icon: string, name: string, defPct: number): void {
    this._armorState = { itemId, icon, name, defPct }
    const iconEl = this.el.querySelector<HTMLElement>('#equip-armor-icon')!
    const nameEl = this.el.querySelector<HTMLElement>('#equip-armor-name')!
    const defEl  = this.el.querySelector<HTMLElement>('#equip-armor-def')!
    const btn    = this.el.querySelector<HTMLElement>('#equip-unequip-btn')!
    iconEl.innerHTML = getItemIconMarkup(itemId, icon)
    nameEl.textContent = name
    defEl.textContent  = t('ui.equip.def_pct', { pct: Math.round(defPct * 100) })
    btn.style.display  = 'block'
    btn.textContent    = t('ui.equip.unequip')
  }

  clearArmor(): void {
    this._armorState = null
    const iconEl = this.el.querySelector<HTMLElement>('#equip-armor-icon')!
    const nameEl = this.el.querySelector<HTMLElement>('#equip-armor-name')!
    const defEl  = this.el.querySelector<HTMLElement>('#equip-armor-def')!
    const btn    = this.el.querySelector<HTMLElement>('#equip-unequip-btn')!
    iconEl.innerHTML = '—'
    nameEl.textContent = t('ui.equip.no_armor')
    defEl.textContent  = ''
    btn.style.display  = 'none'
  }
}
