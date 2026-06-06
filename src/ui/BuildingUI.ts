// Agent 9 負責 — src/ui/BuildingUI.ts
import type { BuildingDef, InventoryItem } from '@/types'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

// 建築圖示（BuildingDef 沒有 icon 欄位，在這裡自行對應）
const BUILDING_ICONS: Record<string, string> = {
  chest:          '📦',
  furnace:        '🔥',
  farm:           '🌾',
  market:         '🏪',
  research_lab:   '🛠️',
  wooden_bridge:  '🌉',
  wall:           '🧱',
  tower:          '🗼',
  spike_trap:     '🔪',
  fire_trap:      '🔥',
  ice_trap:       '❄️',
  base_core:      '🏰',
  barracks:       '🏟️',
  laser_tower:    '🔵',
  cannon_tower:   '💣',
  goddess_statue: '🗿',
}

export class BuildingUI {
  private el: HTMLElement
  private visible = false
  private onStartPlacement: ((defId: string) => void) | null = null
  private currentDefs: Record<string, BuildingDef> = {}
  private currentInventory: InventoryItem[] = []

  constructor() {
    this.el = this.buildHTML()
    document.body.appendChild(this.el)

    // 語言切換時重繪（若可見）
    EventBus.on('i18n:changed', () => {
      if (this.visible) this.renderList()
    })
  }

  setOnStartPlacement(fn: (defId: string) => void): void {
    this.onStartPlacement = fn
  }

  show(defs: Record<string, BuildingDef>, inventory: InventoryItem[]): void {
    this.visible = true
    this.currentDefs = defs
    this.currentInventory = inventory
    this.el.style.display = 'flex'
    this.renderList()
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  get isVisible(): boolean { return this.visible }

  // ── HTML 結構 ─────────────────────────────────────────────

  private buildHTML(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'building-ui'
    div.style.display = 'none'
    div.innerHTML = `
      <div class="panel crafting-panel">
        <div class="panel-header">
          <span>${t('ui.building.title')}</span>
          <button id="close-building">✕</button>
        </div>
        <div id="building-list" class="building-list-scroll"></div>
      </div>
    `
    div.querySelector('#close-building')!.addEventListener('click', () => this.hide())
    // 阻止滾輪冒泡到快捷欄
    div.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: false })
    return div
  }

  // ── 渲染建築清單 ──────────────────────────────────────────

  private renderList(): void {
    const list = this.el.querySelector('#building-list')!
    list.innerHTML = ''

    const invMap = new Map<string, number>()
    this.currentInventory.forEach(({ itemId, amount }) => invMap.set(itemId, amount))

    for (const [id, def] of Object.entries(this.currentDefs)) {
      const canAfford = def.cost.every(c => (invMap.get(c.itemId) ?? 0) >= c.amount)
      const icon = BUILDING_ICONS[id] ?? '🏠'

      // 建築名稱與效果用 i18n，找不到時 fallback 到 BuildingDef 的資料
      const buildingName   = t('building.' + id + '.name',   undefined, def.name)
      const buildingEffect = t('building.' + id + '.effect', undefined, def.effect)

      const costs = def.cost.map(c => {
        const item  = ITEMS[c.itemId]
        const have  = invMap.get(c.itemId) ?? 0
        const cls   = have >= c.amount ? 'req-ok' : 'req-missing'
        return `<span class="${cls}">${getItemIconMarkup(c.itemId, item?.icon ?? '?')} ×${c.amount}<small>(${have})</small></span>`
      }).join('')

      const card = document.createElement('div')
      card.className = 'recipe-card' + (canAfford ? ' craftable' : '')
      card.innerHTML = `
        <div class="recipe-info">
          <div class="recipe-result">${icon} ${buildingName} <small style="color:#888">${t('ui.building.size', { w: def.size.x, h: def.size.y })}</small></div>
          <div class="recipe-reqs">${costs}</div>
          <div style="font-size:0.75rem;color:#888;margin-top:2px">${buildingEffect}</div>
        </div>
        <button class="btn-craft btn-place" ${canAfford ? '' : 'disabled'}>${t('ui.building.place_btn')}</button>
      `

      if (canAfford && this.onStartPlacement) {
        card.querySelector('.btn-place')!.addEventListener('click', () => {
          this.hide()
          this.onStartPlacement!(id)
        })
      }

      list.appendChild(card)
    }
  }
}
