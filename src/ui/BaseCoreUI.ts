// src/ui/BaseCoreUI.ts — 基地核心升級介面
import { BUILDING_UPGRADES } from '@/building/data/buildings'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import type { InventoryItem } from '@/types'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

// 與 main.ts 基地核心加成公式保持同步
function calcBuffs(lv: number): { hpPct: number; atkPct: number; regen: number } {
  const hpPct  = lv > 1 ? Math.round((0.10 + (lv - 2) * 0.10) * 100) : 0
  const atkPct = lv > 1 ? Math.round((0.10 + (lv - 2) * 0.08) * 100) : 0
  const regen  = ([0, 5, 8, 10, 12, 15, 18, 22, 28, 35] as number[])[lv - 1] ?? 0
  return { hpPct, atkPct, regen }
}

export class BaseCoreUI {
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
    this.buildingId    = buildingId
    this.currentLevel  = level
    this.inventory     = inventory
    this.visible       = true
    this._refresh()
    this.el.style.display = 'flex'
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  get isVisible(): boolean { return this.visible }

  // ── 建立 DOM ──────────────────────────────────────────────

  private _build(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.id = 'base-core-ui'
    wrap.style.display = 'none'
    wrap.innerHTML = `
      <div class="base-core-panel">
        <div class="base-core-header">
          <span>${t('ui.base_core.title')}</span>
          <button class="base-core-close">✕</button>
        </div>
        <div class="base-core-content" id="bcu-content"></div>
      </div>
    `
    wrap.querySelector('.base-core-close')!.addEventListener('click', () => this.hide())
    return wrap
  }

  private _refresh(): void {
    const lv      = this.currentLevel
    const upgrades = BUILDING_UPGRADES['base_core']
    const { hpPct, atkPct, regen } = calcBuffs(lv)

    const content = this.el.querySelector('#bcu-content')!

    const invMap = new Map<string, number>()
    this.inventory.forEach(({ itemId, amount }) => invMap.set(itemId, amount))

    let upgradeHTML = ''
    if (lv >= 10 || !upgrades || lv >= upgrades.length) {
      upgradeHTML = `<div class="bcu-max">${t('ui.base_core.max')}</div>`
    } else {
      const nextUpgrade = upgrades[lv]  // upgrades[currentLevel] = 升至 lv+1 的成本
      const canAfford   = nextUpgrade.cost.every(c => (invMap.get(c.itemId) ?? 0) >= c.amount)

      const costsHTML = nextUpgrade.cost.length === 0
        ? `<span class="bcu-free">${t('ui.common.free')}</span>`
        : nextUpgrade.cost.map(c => {
            const def  = ITEMS[c.itemId]
            const have = invMap.get(c.itemId) ?? 0
            const cls  = have >= c.amount ? 'req-ok' : 'req-missing'
            const name = t('item.' + c.itemId + '.name', undefined, def?.name ?? c.itemId)
            return `<div class="${cls}">
              ${getItemIconMarkup(c.itemId, def?.icon ?? '?')} ${t('ui.base_core.req_have', { name, need: c.amount, have })}
            </div>`
          }).join('')

      // 下一等級加成預覽
      const nextBuffs = calcBuffs(lv + 1)
      upgradeHTML = `
        <div class="bcu-next-title">${t('ui.base_core.upgrade_title', { lv: lv + 1 })}</div>
        <div class="bcu-next-preview">
          ${t('ui.base_core.preview_hp',   { pct: nextBuffs.hpPct })}
          &nbsp;${t('ui.base_core.preview_atk',  { pct: nextBuffs.atkPct })}
          &nbsp;${t('ui.base_core.preview_regen', { val: nextBuffs.regen })}
        </div>
        <div class="bcu-costs">${costsHTML}</div>
        <button class="btn-upgrade-core" ${canAfford ? '' : 'disabled'}>${t('ui.base_core.upgrade_btn')}</button>
      `
    }

    content.innerHTML = `
      <div class="bcu-level">${t('ui.base_core.level_row', { lv })}</div>
      <div class="bcu-buffs">
        <div>${t('ui.base_core.hp_bonus',  { pct: hpPct })}</div>
        <div>${t('ui.base_core.atk_bonus', { pct: atkPct })}</div>
        <div>${t('ui.base_core.regen',     { val: regen })}</div>
      </div>
      <hr class="bcu-divider" />
      ${upgradeHTML}
    `

    if (lv < 10) {
      const btn = content.querySelector<HTMLButtonElement>('.btn-upgrade-core')
      if (btn && !btn.disabled && this.onUpgrade) {
        btn.addEventListener('click', () => {
          this.onUpgrade!(this.buildingId)
          this.hide()
        })
      }
    }
  }
}
