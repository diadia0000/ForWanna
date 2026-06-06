// src/ui/BagUI.ts — 背包 UI（小背包 / 大背包）
import type { InventoryItem } from '@/types'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

export type BagType = 'bag_small' | 'bag_large'

export const BAG_MAX_ITEMS: Record<BagType, number> = {
  bag_small: 999,
  bag_large: Infinity,
}

export class BagUI {
  private el: HTMLElement
  private visible = false
  private bagType: BagType = 'bag_small'
  private contents: Record<string, number> = {}   // itemId → amount
  private inventory: InventoryItem[] = []

  // 回呼
  private onPutIn:  ((itemId: string, amount: number) => void) | null = null
  private onTakeOut:((itemId: string, amount: number) => void) | null = null

  constructor() {
    this.el = this._buildHTML()
    document.body.appendChild(this.el)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) this.hide()
    })

    // 語言切換時重繪（若可見）
    EventBus.on('i18n:changed', () => {
      if (this.visible) this._render()
    })
  }

  // ── 公開 API ──────────────────────────────────────────────────

  setOnPutIn(fn: (itemId: string, amount: number) => void): void  { this.onPutIn  = fn }
  setOnTakeOut(fn: (itemId: string, amount: number) => void): void { this.onTakeOut = fn }

  get isVisible(): boolean { return this.visible }

  show(type: BagType, contents: Record<string, number>, inventory: InventoryItem[]): void {
    this.visible   = true
    this.bagType   = type
    this.contents  = { ...contents }
    this.inventory = [...inventory]
    this.el.style.display = 'flex'
    this._render()
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  toggle(type: BagType, contents: Record<string, number>, inventory: InventoryItem[]): void {
    if (this.visible && this.bagType === type) this.hide()
    else this.show(type, contents, inventory)
  }

  /** 背包或物品欄有變動時更新顯示 */
  update(contents: Record<string, number>, inventory: InventoryItem[]): void {
    this.contents  = { ...contents }
    this.inventory = [...inventory]
    if (this.visible) this._render()
  }

  // ── 計算容量 ──────────────────────────────────────────────────

  private _usedCapacity(): number {
    return Object.values(this.contents).reduce((a, b) => a + b, 0)
  }

  private _remainingCapacity(): number {
    const max = BAG_MAX_ITEMS[this.bagType]
    return max === Infinity ? Infinity : max - this._usedCapacity()
  }

  // ── HTML 結構 ─────────────────────────────────────────────────

  private _buildHTML(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'bag-ui'
    div.style.display = 'none'
    div.innerHTML = `
      <div class="bag-header">
        <span id="bag-title">${t('ui.bag.title')}</span>
        <span id="bag-capacity"></span>
        <button id="bag-close" class="bag-close-btn">✕</button>
      </div>
      <div class="bag-body">
        <div class="bag-section">
          <div class="bag-section-label" id="bag-put-in-label">${t('ui.bag.put_in_label')}</div>
          <div id="bag-inv-list" class="bag-inv-list"></div>
        </div>
        <div class="bag-section">
          <div class="bag-section-label" id="bag-contents-label">${t('ui.bag.contents_label')}</div>
          <div id="bag-contents-list" class="bag-contents-list"></div>
        </div>
      </div>
    `
    div.querySelector('#bag-close')!.addEventListener('click', () => this.hide())
    return div
  }

  // ── 渲染 ─────────────────────────────────────────────────────

  private _render(): void {
    const bagDef  = ITEMS[this.bagType]
    const title   = document.getElementById('bag-title')!
    const capEl   = document.getElementById('bag-capacity')!
    const used    = this._usedCapacity()
    const max     = BAG_MAX_ITEMS[this.bagType]
    const remain  = this._remainingCapacity()

    const bagName = t('item.' + this.bagType + '.name', undefined, bagDef?.name ?? t('ui.bag.title'))
    title.innerHTML  = `${getItemIconMarkup(this.bagType, bagDef?.icon ?? '🎒')} ${bagName}`

    // 更新靜態標籤
    const putInLabel = document.getElementById('bag-put-in-label')
    if (putInLabel) putInLabel.textContent = t('ui.bag.put_in_label')
    const contentsLabel = document.getElementById('bag-contents-label')
    if (contentsLabel) contentsLabel.textContent = t('ui.bag.contents_label')

    capEl.textContent  = max === Infinity
      ? t('ui.bag.capacity_inf', { used })
      : t('ui.bag.capacity', { used, max })
    capEl.style.color  = remain <= 0 ? '#ff6060' : remain < 50 ? '#ffcc44' : '#a8d8a0'

    this._renderInventory()
    this._renderContents()
  }

  private _renderInventory(): void {
    const list = document.getElementById('bag-inv-list')!
    list.innerHTML = ''

    const filteredInv = this.inventory.filter(item => {
      const def = ITEMS[item.itemId]
      if (!def) return false
      // 背包和特殊建築不可放入
      if (['bag_small', 'bag_large', 'furnace'].includes(item.itemId)) return false
      return true
    })

    if (filteredInv.length === 0) {
      list.innerHTML = `<div class="bag-empty-hint">${t('ui.bag.empty')}</div>`
      return
    }

    for (const item of filteredInv) {
      const def = ITEMS[item.itemId]
      const itemName = t('item.' + item.itemId + '.name', undefined, def?.name ?? item.itemId)
      const row = document.createElement('div')
      row.className = 'bag-inv-row'
      row.innerHTML = `
        <span class="bag-inv-icon">${getItemIconMarkup(item.itemId, def?.icon ?? '📦')}</span>
        <span class="bag-inv-name">${itemName}</span>
        <span class="bag-inv-amount">×${item.amount}</span>
        <button class="bag-put-btn" data-item="${item.itemId}" data-max="${item.amount}">${t('ui.bag.put_in_btn')}</button>
      `
      const btn = row.querySelector('.bag-put-btn') as HTMLButtonElement
      const remain = this._remainingCapacity()
      if (remain <= 0) btn.disabled = true

      btn.addEventListener('click', () => {
        const maxCanPut = Math.min(item.amount, remain === Infinity ? item.amount : remain)
        if (maxCanPut <= 0) return
        const amount = maxCanPut === 1 ? 1 : this._promptAmount(
          t('ui.bag.prompt_put', { name: itemName }), 1, maxCanPut
        )
        if (amount <= 0) return
        this.onPutIn?.(item.itemId, amount)
      })
      list.appendChild(row)
    }
  }

  private _renderContents(): void {
    const list = document.getElementById('bag-contents-list')!
    list.innerHTML = ''

    const entries = Object.entries(this.contents).filter(([, amt]) => amt > 0)
    if (entries.length === 0) {
      list.innerHTML = `<div class="bag-empty-hint">${t('ui.bag.empty')}</div>`
      return
    }

    for (const [itemId, amount] of entries) {
      const def = ITEMS[itemId]
      const itemName = t('item.' + itemId + '.name', undefined, def?.name ?? itemId)
      const row = document.createElement('div')
      row.className = 'bag-content-row'
      row.innerHTML = `
        <span class="bag-ci">${getItemIconMarkup(itemId, def?.icon ?? '📦')}</span>
        <span class="bag-cn">${itemName}</span>
        <span class="bag-ca">×${amount}</span>
        <button class="bag-take-one" data-item="${itemId}">${t('ui.bag.take_one_btn')}</button>
        <button class="bag-take-all" data-item="${itemId}" data-amount="${amount}">${t('ui.bag.take_all_btn')}</button>
      `
      const takeOne = row.querySelector('.bag-take-one') as HTMLButtonElement
      const takeAll = row.querySelector('.bag-take-all') as HTMLButtonElement

      takeOne.addEventListener('click', () => this.onTakeOut?.(itemId, 1))
      takeAll.addEventListener('click', () => this.onTakeOut?.(itemId, amount))

      list.appendChild(row)
    }
  }

  // ── 數量輸入提示 ──────────────────────────────────────────────

  private _promptAmount(msg: string, min: number, max: number): number {
    if (max <= 1) return max
    const input = window.prompt(`${msg}（${min}～${max}）`, String(max))
    if (!input) return 0
    const n = parseInt(input, 10)
    if (isNaN(n) || n < min || n > max) return 0
    return n
  }
}
