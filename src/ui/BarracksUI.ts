// src/ui/BarracksUI.ts — 兵營管理介面

import { BUILDING_UPGRADES } from '@/building/data/buildings'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import type { InventoryItem } from '@/types'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

// 和 main.ts 保持同步的士兵常數
const SOLDIER_MAX_PER_BARRACKS = 3
const SOLDIER_HP     = 50
const SOLDIER_ATK    = 8
const SOLDIER_SPEED  = 80
const SOLDIER_SPAWN_INTERVAL = 30    // 秒
const SOLDIER_RESPAWN_MS     = 60    // 秒

// 每級的屬性加成
function calcSoldierStats(lv: number): { maxSoldiers: number; hp: number; atk: number; speed: number; interval: number } {
  return {
    maxSoldiers : SOLDIER_MAX_PER_BARRACKS + (lv - 1),          // 每升 1 級多 1 名
    hp          : Math.round(SOLDIER_HP  * (1 + (lv - 1) * 0.3)),  // +30% HP/Lv
    atk         : Math.round(SOLDIER_ATK * (1 + (lv - 1) * 0.25)), // +25% ATK/Lv
    speed       : Math.round(SOLDIER_SPEED * (1 + (lv - 1) * 0.1)),// +10% SPD/Lv
    interval    : Math.max(10, SOLDIER_SPAWN_INTERVAL - (lv - 1) * 4), // 每級少 4 秒
  }
}

export class BarracksUI {
  private el: HTMLElement
  private visible = false
  private buildingId = ''
  private currentLevel = 1
  private inventory: InventoryItem[] = []
  private onUpgrade: ((buildingId: string) => void) | null = null

  constructor() {
    this.el = this._build()
    document.body.appendChild(this.el)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) this.hide()
    })

    // 語言切換時重繪（若可見）
    EventBus.on('i18n:changed', () => {
      if (this.visible) this._refresh()
    })
  }

  // ── 公開 API ──────────────────────────────────────────────

  setOnUpgrade(fn: (buildingId: string) => void): void { this.onUpgrade = fn }

  show(buildingId: string, level: number, inventory: InventoryItem[]): void {
    this.buildingId   = buildingId
    this.currentLevel = level
    this.inventory    = inventory
    this.visible      = true
    this._refresh()
    this.el.style.display = 'flex'
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  get isVisible(): boolean { return this.visible }

  // ── DOM ──────────────────────────────────────────────────

  private _build(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.id = 'barracks-ui'
    wrap.style.display = 'none'
    wrap.innerHTML = `
      <div class="barracks-panel">
        <div class="barracks-header">
          <span>${t('ui.barracks.title')}</span>
          <button class="barracks-close">✕</button>
        </div>
        <div class="barracks-content" id="barracks-content"></div>
      </div>
    `
    wrap.querySelector('.barracks-close')!.addEventListener('click', () => this.hide())
    return wrap
  }

  private _refresh(): void {
    const lv       = this.currentLevel
    const upgrades = BUILDING_UPGRADES['barracks'] ?? []
    const stats    = calcSoldierStats(lv)
    const content  = this.el.querySelector('#barracks-content')!

    const invMap = new Map<string, number>()
    this.inventory.forEach(({ itemId, amount }) => invMap.set(itemId, amount))

    // ── 當前士兵屬性 ──
    const statsHTML = `
      <div class="barracks-section-title">${t('ui.barracks.stats_title')}</div>
      <div class="barracks-stats-grid">
        <div class="barracks-stat"><span class="barracks-stat-label">${t('ui.barracks.stat_max_soldiers')}</span><strong>${stats.maxSoldiers}</strong></div>
        <div class="barracks-stat"><span class="barracks-stat-label">${t('ui.barracks.stat_hp')}</span><strong>${stats.hp}</strong></div>
        <div class="barracks-stat"><span class="barracks-stat-label">${t('ui.barracks.stat_atk')}</span><strong>${stats.atk}</strong></div>
        <div class="barracks-stat"><span class="barracks-stat-label">${t('ui.barracks.stat_speed')}</span><strong>${stats.speed}</strong></div>
        <div class="barracks-stat"><span class="barracks-stat-label">${t('ui.barracks.stat_spawn')}</span><strong>${stats.interval}s</strong></div>
        <div class="barracks-stat"><span class="barracks-stat-label">${t('ui.barracks.stat_respawn')}</span><strong>${SOLDIER_RESPAWN_MS}s</strong></div>
      </div>
    `

    // ── 升級區 ──
    const maxLv = upgrades.length
    let upgradeHTML = ''
    if (lv >= maxLv || !upgrades[lv]) {
      upgradeHTML = `<div class="barracks-max">${t('ui.barracks.max', { lv })}</div>`
    } else {
      const nextUpgrade  = upgrades[lv]  // upgrades[lv] = 升至 lv+1 的成本
      const nextStats    = calcSoldierStats(lv + 1)
      const canAfford    = nextUpgrade.cost.every(c => (invMap.get(c.itemId) ?? 0) >= c.amount)

      const costsHTML = nextUpgrade.cost.map(c => {
        const def  = ITEMS[c.itemId]
        const have = invMap.get(c.itemId) ?? 0
        const cls  = have >= c.amount ? 'req-ok' : 'req-missing'
        const name = t('item.' + c.itemId + '.name', undefined, def?.name ?? c.itemId)
        return `<div class="${cls}">
          ${getItemIconMarkup(c.itemId, def?.icon ?? '?')} ${t('ui.barracks.req_have', { name, need: c.amount, have })}
        </div>`
      }).join('') || `<span class="bcu-free">${t('ui.common.free')}</span>`

      upgradeHTML = `
        <hr class="barracks-divider" />
        <div class="barracks-section-title">${t('ui.barracks.upgrade_title', { lv: lv + 1 })}</div>
        <div class="barracks-next-preview">
          ${t('ui.barracks.preview', {
            diff:    nextStats.maxSoldiers - stats.maxSoldiers,
            hp_from: stats.hp,   hp_to:  nextStats.hp,
            atk_from: stats.atk, atk_to: nextStats.atk,
            int_from: stats.interval, int_to: nextStats.interval,
          })}
        </div>
        <div class="barracks-costs">${costsHTML}</div>
        <button class="btn-upgrade-barracks" ${canAfford ? '' : 'disabled'}>${t('ui.barracks.upgrade_btn')}</button>
      `
    }

    content.innerHTML = `
      <div class="barracks-level-row">${t('ui.barracks.level_row', { lv, max: maxLv })}</div>
      ${statsHTML}
      ${upgradeHTML}
    `

    if (lv < maxLv) {
      const btn = content.querySelector<HTMLButtonElement>('.btn-upgrade-barracks')
      if (btn && !btn.disabled && this.onUpgrade) {
        btn.addEventListener('click', () => {
          this.onUpgrade!(this.buildingId)
          this.hide()
        })
      }
    }
  }
}
