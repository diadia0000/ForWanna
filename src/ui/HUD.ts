// src/ui/HUD.ts
import type { PlayerData } from '@/types'
import { EventBus } from '@/core/EventBus'
import { t } from '@/core/i18n'

// ── SVG 圖示（CSS 繪製，不用 emoji） ──────────────────────────
const ICON_BACKPACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 4a3 3 0 016 0"/>
  <path d="M6 8h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2z"/>
  <line x1="8" y1="14" x2="16" y2="14"/>
</svg>`

const ICON_CRAFTING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 5.5L19 10l-9 9H6v-4l9-9z"/>
  <line x1="9" y1="8.5" x2="14.5" y2="14"/>
  <circle cx="5" cy="19" r="1" fill="currentColor"/>
</svg>`

const ICON_BUILDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 21h18"/>
  <path d="M5 21V9l7-6 7 6v12"/>
  <rect x="9" y="14" width="6" height="7"/>
</svg>`

// 移動：四向方向鍵
const ICON_MOVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3l3 3h-2v4h4V8l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H7v2l-3-3 3-3v2h4V6H9l3-3z"/>
</svg>`

// 攻擊：寶劍
const ICON_ATTACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.5 4H20v5.5L8.5 21 3 21v-5.5L14.5 4z"/>
  <line x1="13" y1="6.5" x2="17.5" y2="11"/>
  <line x1="6" y1="16" x2="9" y2="19"/>
</svg>`

// 互動：手指點擊
const ICON_INTERACT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 11V5a2 2 0 014 0v6"/>
  <path d="M13 8.5a2 2 0 014 0V13"/>
  <path d="M17 11a2 2 0 014 0v5a5 5 0 01-5 5h-2.5a5 5 0 01-3.6-1.5L5 16a1.8 1.8 0 012.6-2.5L9 15"/>
</svg>`

// R：寶箱
const ICON_CHEST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="8" width="18" height="12" rx="1"/>
  <path d="M3 12h18"/>
  <path d="M3 8l2-3h14l2 3"/>
  <rect x="10.5" y="11" width="3" height="3" rx="0.5"/>
</svg>`

// U：解鎖
const ICON_UNLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="11" width="14" height="9" rx="2"/>
  <path d="M8 11V7a4 4 0 017.5-2"/>
  <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>
</svg>`

// G：盾牌（防具）
const ICON_ARMOR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/>
  <path d="M9 12l2 2 4-4"/>
</svg>`

// Q：任務捲軸
const ICON_QUEST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="3" width="14" height="18" rx="1"/>
  <line x1="8" y1="8" x2="16" y2="8"/>
  <line x1="8" y1="12" x2="16" y2="12"/>
  <line x1="8" y1="16" x2="13" y2="16"/>
</svg>`

// M：地圖
const ICON_MAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/>
  <line x1="9" y1="4" x2="9" y2="18"/>
  <line x1="15" y1="6" x2="15" y2="20"/>
</svg>`

// 拆除：垃圾桶
const ICON_DEMOLISH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 7h16"/>
  <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/>
  <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>
  <line x1="10" y1="11" x2="10" y2="17"/>
  <line x1="14" y1="11" x2="14" y2="17"/>
</svg>`

// Esc：取消
const ICON_CANCEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
  <line x1="15.5" y1="8.5" x2="8.5" y2="15.5"/>
</svg>`

// Tab：說明
const ICON_HELP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M9.5 9.5a2.5 2.5 0 014.5 1.5c0 1.5-2 2-2 3.5"/>
  <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/>
</svg>`

// 滑鼠左鍵
const ICON_MOUSE_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="3" width="12" height="18" rx="6"/>
  <path d="M12 3v6"/>
  <path d="M6 9h6" stroke-width="3"/>
</svg>`

// 滑鼠右鍵
const ICON_MOUSE_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="3" width="12" height="18" rx="6"/>
  <path d="M12 3v6"/>
  <path d="M12 9h6" stroke-width="3"/>
</svg>`

// 滑鼠滾輪
const ICON_MOUSE_WHEEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="3" width="12" height="18" rx="6"/>
  <line x1="12" y1="8" x2="12" y2="11"/>
</svg>`

export class HUD {
  private el:      HTMLElement
  private dockEl:  HTMLElement
  private keyMap: Record<string, string> = {
    inventory: 'KeyI',
    crafting:  'KeyC',
    building:  'KeyB',
  }

  constructor() {
    this.el     = this.buildHUD()
    this.dockEl = this.buildDock()
    document.body.appendChild(this.el)
    document.body.appendChild(this.dockEl)
    this.bindEvents()

    // 語言切換時重繪 HUD 與 Dock
    EventBus.on('i18n:changed', () => this._rebuildHUDAndDock())
  }

  // ── 語言切換後重建 HUD 和 Dock ────────────────────────────

  private _rebuildHUDAndDock(): void {
    const hudVisible  = this.el.style.display !== 'none'
    const dockVisible = this.dockEl.style.display !== 'none'

    const newHud  = this.buildHUD()
    const newDock = this.buildDock()

    this.el.replaceWith(newHud)
    this.dockEl.replaceWith(newDock)
    this.el     = newHud
    this.dockEl = newDock

    if (!hudVisible)  this.el.style.display     = 'none'
    if (!dockVisible) this.dockEl.style.display = 'none'
    // bindEvents 重新綁定鍵盤監聽（舊監聽器會因 window.removeEventListener 缺少 ref 殘留，但 keyMap 邏輯冪等）
  }

  // ── HUD 頂部 ──────────────────────────────────────────────

  private buildHUD(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'hud'
    div.innerHTML = `
      <div class="hud-left">
        <div class="hud-vitals">
          <div class="hud-hearts-row">
            <div id="hud-hearts"></div>
            <span id="hud-hp-text" class="hud-hp-text">100/100</span>
          </div>
          <div id="hud-hunger-row" title="${t('hud.hunger_title')}">🍖 <span id="hud-hunger-segs">██████████</span></div>
        </div>
        <div class="hud-xp-block">
          <div class="hud-xp-label">
            <span id="hud-level">Lv.1</span>
            <span id="hud-xp-text">0/100 XP</span>
            <span id="hud-sp" style="color:#ffd700;display:none">✨ SP: 0</span>
          </div>
          <div id="hud-xp-bar-track"><div id="hud-xp-bar"></div></div>
        </div>
        <span id="hud-gold">🪙 0</span>
      </div>
      <div id="hud-center"></div>
      <div class="hud-right">
        <button id="btn-save" class="hud-save-btn">${t('hud.save_btn')}</button>
        <div id="hud-room" title="${t('hud.copy_prompt')}" style="display:none">
          ${t('hud.room_prefix')}<strong id="hud-room-code"></strong>
          <span id="hud-player-count" style="margin-left:6px;opacity:.75"></span>
        </div>
      </div>
    `

    div.querySelector('#btn-save')!.addEventListener('click', () =>
      EventBus.emit('save:request', {}))

    div.querySelector('#hud-room')!.addEventListener('click', () => {
      const codeEl = div.querySelector<HTMLElement>('#hud-room-code')!
      const code   = codeEl.textContent ?? ''
      if (!code) return
      navigator.clipboard.writeText(code).then(() => {
        const roomEl = div.querySelector<HTMLElement>('#hud-room')!
        const orig   = roomEl.innerHTML
        roomEl.innerHTML = t('hud.copied')
        roomEl.style.pointerEvents = 'none'
        setTimeout(() => { roomEl.innerHTML = orig; roomEl.style.pointerEvents = '' }, 1500)
      }).catch(() => { prompt(t('hud.copy_prompt'), code) })
    })

    return div
  }

  // ── 右側 Dock ─────────────────────────────────────────────

  private buildDock(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'side-dock'
    div.style.display = 'none'

    const panel = document.createElement('div')
    panel.className = 'dock-panel'
    panel.innerHTML = `<div class="dock-title">${t('hud.dock_title')}</div>`
    const grid = document.createElement('div')
    grid.className = 'dock-grid'
    panel.appendChild(grid)

    // 可重新綁定的面板開關（點圖示開啟、點按鍵重綁）
    const actionRows: Array<{ action: string; icon: string; fnKey: string }> = [
      { action: 'inventory', icon: ICON_BACKPACK, fnKey: 'hud.action_inventory' },
      { action: 'crafting',  icon: ICON_CRAFTING, fnKey: 'hud.action_crafting' },
      { action: 'building',  icon: ICON_BUILDING, fnKey: 'hud.action_building' },
    ]
    for (const item of actionRows) {
      const row = document.createElement('div')
      row.className = 'dock-row dock-row--action'
      row.innerHTML = `
        <span class="dock-keys"><kbd class="dock-key" data-action="${item.action}">${this.keyDisplay(this.keyMap[item.action])}</kbd></span>
        <span class="dock-row-icon">${item.icon}</span>
        <span class="dock-fn">${t(item.fnKey)}</span>
      `
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.dock-key')) return
        this.triggerAction(item.action)
      })
      row.querySelector('.dock-key')!.addEventListener('click', (e) => {
        e.stopPropagation()
        this.remapKey(item.action, row.querySelector('.dock-key') as HTMLElement)
      })
      grid.appendChild(row)
    }

    // 固定按鍵（同一按鍵的多個功能合併在同一格）
    const fixedRows: Array<{ keys: string[]; icon: string; fnKey: string }> = [
      { keys: ['WASD', '↑↓←→'],          icon: ICON_MOVE,        fnKey: 'hud.key_move' },
      { keys: ['F', 'Space'],            icon: ICON_ATTACK,      fnKey: 'hud.key_attack' },
      { keys: ['E'],                     icon: ICON_INTERACT,    fnKey: 'hud.key_interact' },
      { keys: ['R'],                     icon: ICON_CHEST,       fnKey: 'hud.key_chest' },
      { keys: ['U'],                     icon: ICON_UNLOCK,      fnKey: 'hud.key_unlock' },
      { keys: ['G'],                     icon: ICON_ARMOR,       fnKey: 'hud.key_armor' },
      { keys: ['Q'],                     icon: ICON_QUEST,       fnKey: 'hud.key_quest' },
      { keys: ['M'],                     icon: ICON_MAP,         fnKey: 'hud.key_map' },
      { keys: ['Backspace', 'Delete'],   icon: ICON_DEMOLISH,    fnKey: 'hud.key_demolish' },
      { keys: ['Esc'],                   icon: ICON_CANCEL,      fnKey: 'hud.key_cancel' },
      { keys: ['Tab'],                   icon: ICON_HELP,        fnKey: 'hud.key_help' },
      { keys: [t('hud.mouse_left_label')],  icon: ICON_MOUSE_LEFT,  fnKey: 'hud.mouse_left' },
      { keys: [t('hud.mouse_right_label')], icon: ICON_MOUSE_RIGHT, fnKey: 'hud.mouse_right' },
      { keys: [t('hud.mouse_wheel_label')], icon: ICON_MOUSE_WHEEL, fnKey: 'hud.mouse_wheel' },
    ]
    for (const item of fixedRows) {
      const row = document.createElement('div')
      row.className = 'dock-row'
      const kbds = item.keys.map(k => `<kbd class="dock-key dock-key--static">${k}</kbd>`).join('')
      row.innerHTML = `
        <span class="dock-keys">${kbds}</span>
        <span class="dock-row-icon">${item.icon}</span>
        <span class="dock-fn">${t(item.fnKey)}</span>
      `
      grid.appendChild(row)
    }

    div.appendChild(panel)
    return div
  }

  private triggerAction(action: string): void {
    if (action === 'inventory') EventBus.emit('ui:open_inventory', {})
    if (action === 'crafting')  EventBus.emit('ui:open_crafting', {})
    if (action === 'building')  window.dispatchEvent(new CustomEvent('ui:open_building'))
  }

  private remapKey(action: string, kbdEl: HTMLElement): void {
    kbdEl.textContent = '...'
    kbdEl.classList.add('dock-key--listening')
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code !== 'Escape') {
        this.keyMap[action] = e.code
        kbdEl.textContent   = this.keyDisplay(e.code)
      } else {
        kbdEl.textContent = this.keyDisplay(this.keyMap[action])
      }
      kbdEl.classList.remove('dock-key--listening')
      window.removeEventListener('keydown', handler, true)
    }
    window.addEventListener('keydown', handler, true)
  }

  private keyDisplay(code: string): string {
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').slice(0, 3)
  }

  // ── Events ────────────────────────────────────────────────

  private bindEvents(): void {
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') this.dockEl.style.display = 'none'
    })

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault()
        this.dockEl.style.display = 'flex'
        return
      }
      if (e.code === this.keyMap.inventory) EventBus.emit('ui:open_inventory', {})
      if (e.code === this.keyMap.crafting)  EventBus.emit('ui:open_crafting', {})
      if (e.code === this.keyMap.building)  window.dispatchEvent(new CustomEvent('ui:open_building'))
    })
  }

  // ── Update ───────────────────────────────────────────────

  update(data: PlayerData): void {
    // ── 愛心 ────────────────────────────────────────────────────
    const hearts = this.el.querySelector('#hud-hearts')!
    const total  = 10
    const filled = Math.max(0, Math.min(total, Math.ceil((data.hp / data.maxHp) * total)))
    hearts.innerHTML = Array.from({ length: total }, (_, i) =>
      `<span class="heart ${i < filled ? 'heart--full' : 'heart--empty'}">♥</span>`
    ).join('')
    const hpTextEl = this.el.querySelector<HTMLElement>('#hud-hp-text')
    if (hpTextEl) hpTextEl.textContent = `${Math.round(data.hp)}/${data.maxHp}`

    // ── 飢餓條 ──────────────────────────────────────────────────
    const hunger  = (data as any).hunger ?? 100
    const bars    = Math.max(0, Math.ceil((hunger / 100) * 10))
    const segsEl  = this.el.querySelector('#hud-hunger-segs')
    if (segsEl) segsEl.textContent = '█'.repeat(bars) + '░'.repeat(10 - bars)

    // ── 等級 / XP 條 ────────────────────────────────────────────
    const xpForNext = Math.floor(100 * Math.pow(data.level, 1.5))
    this.el.querySelector('#hud-level')!.textContent     = `Lv.${data.level}`
    this.el.querySelector('#hud-xp-text')!.textContent   = `${data.xp}/${xpForNext} XP`
    const pct = xpForNext > 0 ? Math.min(100, (data.xp / xpForNext) * 100) : 0
    ;(this.el.querySelector('#hud-xp-bar') as HTMLElement).style.width = `${pct}%`

    // ── Skill Points ─────────────────────────────────────────────
    const sp    = (data as any).skillPoints ?? 0
    const spEl  = this.el.querySelector<HTMLElement>('#hud-sp')!
    spEl.textContent  = `✨ SP: ${sp}`
    spEl.style.display = sp > 0 ? '' : 'none'

    // ── 金幣 ─────────────────────────────────────────────────────
    this.el.querySelector('#hud-gold')!.textContent = `🪙 ${Math.floor(data.gold ?? 0).toLocaleString()}`
  }

  setRoomCode(code: string | null): void {
    const el = this.el.querySelector<HTMLElement>('#hud-room')!
    if (code) {
      this.el.querySelector('#hud-room-code')!.textContent = code
      el.style.display = ''
    } else {
      el.style.display = 'none'
    }
  }

  setPlayerCount(current: number, max = 4): void {
    const el = this.el.querySelector('#hud-player-count')
    if (el) el.textContent = t('hud.player_count', { current, max })
  }

  show(): void {
    this.el.style.display = 'flex'
    // dockEl 只在 TAB hold 時顯示，不在 show() 裡主動開啟
  }
  hide(): void {
    this.el.style.display     = 'none'
    this.dockEl.style.display = 'none'
  }
}
