// src/ui/MarketUI.ts — 市場交易選單

import type { ItemId, InventoryItem } from '@/types'
import { marketPricing, BLUEPRINT_PRICE } from './MarketPricing'
import { ITEMS, ITEM_RARITY, RARITY_CONFIG } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

export class MarketUI {
  private el: HTMLElement
  private selectedItem: ItemId | null = null
  private qty = 1
  private maxStock = 0
  private inventory: InventoryItem[] = []
  private gold = 0
  private gameDay = 1
  private onSell: ((itemId: ItemId, amount: number) => void) | null = null
  private onBuy: ((itemId: string) => void) | null = null

  private _formatGold(value: number): string {
    return Math.floor(value).toLocaleString()
  }

  constructor() {
    this.el = this._build()
    document.body.appendChild(this.el)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.el.style.display !== 'none') this.hide()
    })

    // 語言切換時重建整個 UI，包含標題、欄位名稱和數量按鈕。
    EventBus.on('i18n:changed', () => {
      this._rebuildForLocale()
    })
  }

  // ── 公開 API ──────────────────────────────────────────────

  setOnSell(fn: (itemId: ItemId, amount: number) => void): void {
    this.onSell = fn
  }

  setOnBuy(fn: (itemId: string) => void): void {
    this.onBuy = fn
  }

  show(inventory: InventoryItem[], gold = 0, gameDay = 1): void {
    this.inventory = inventory
    this.gold = Math.floor(gold)
    this.gameDay = gameDay
    this._refreshItemList()
    this._refreshDaily()
    this.el.style.display = 'flex'
  }

  hide(): void {
    this.el.style.display = 'none'
    this.selectedItem = null
  }

  // ── 建立 DOM ──────────────────────────────────────────────

  private _build(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.id = 'market-ui'
    wrap.style.display = 'none'
    wrap.innerHTML = `
      <div class="market-panel">
        <div class="market-header">
          <span>${t('ui.market.title')}</span>
          <button class="market-close">✕</button>
        </div>

        <div class="market-content">
          <div class="market-left-col">
            <div class="market-daily-section" id="market-daily"></div>
            <div class="market-items-list" id="market-items"></div>
          </div>

          <div class="market-detail" id="market-detail" style="display:none;">
            <div class="market-detail-item">
              <span class="market-item-icon" id="md-icon"></span>
              <span class="market-item-name" id="md-name"></span>
            </div>

            <div class="market-price-info">
              <div>${t('ui.market.current_price')}<strong id="md-price">0</strong> ${t('ui.market.gold_unit')}</div>
              <div>${t('ui.market.owned')}<strong id="md-stock">0</strong></div>
            </div>

            <div class="craft-qty-row">
              <button class="btn-qty-arrow" id="mq-minus">◄</button>
              <span class="craft-qty-num" id="mq-num">1</span>
              <button class="btn-qty-arrow" id="mq-plus">►</button>
              <button class="btn-craft-extra" id="mq-half">${t('ui.common.half')}</button>
              <button class="btn-craft-extra" id="mq-max">${t('ui.common.max')}</button>
            </div>

            <div class="market-sell-total">
              ${t('ui.market.earn')}<strong id="md-total">0</strong>
            </div>

            <button class="btn-sell" id="md-sell">${t('ui.market.sell_btn')}</button>
          </div>
        </div>
      </div>
    `

    wrap.querySelector('.market-close')!.addEventListener('click', () => this.hide())
    wrap.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.btn-buy-blueprint') as HTMLElement | null
      if (!btn) return
      const itemId = btn.dataset.itemId
      if (itemId && this.onBuy) this.onBuy(itemId)
    })
    wrap.querySelector('#mq-minus')!.addEventListener('click', () => this._setQty(this.qty - 1))
    wrap.querySelector('#mq-plus')!.addEventListener('click', () => this._setQty(this.qty + 1))
    wrap.querySelector('#mq-half')!.addEventListener('click', () => this._setQty(Math.max(1, Math.floor(this.maxStock / 2))))
    wrap.querySelector('#mq-max')!.addEventListener('click', () => this._setQty(this.maxStock))
    wrap.querySelector('#md-sell')!.addEventListener('click', () => this._executeSell())

    return wrap
  }

  private _rebuildForLocale(): void {
    const wasVisible = this.el.style.display !== 'none'
    const selectedItem = this.selectedItem
    const qty = this.qty
    const newEl = this._build()
    this.el.replaceWith(newEl)
    this.el = newEl

    if (!wasVisible) return
    this.el.style.display = 'flex'
    this._refreshDaily()
    this._refreshItemList()

    if (selectedItem && this.inventory.some(item => item.itemId === selectedItem)) {
      this._selectItem(selectedItem)
      this._setQty(qty)
    }
  }

  private _refreshItemList(): void {
    const listEl = this.el.querySelector('#market-items')!
    listEl.innerHTML = ''

    for (const item of this.inventory) {
      const def = ITEMS[item.itemId]
      if (!def) continue

      const price = marketPricing.getPrice(item.itemId, this.gameDay)
      if (price <= 0) continue  // 跳過不可售物品

      const rarity = ITEM_RARITY[item.itemId] ?? 'common'
      const rarityConf = RARITY_CONFIG[rarity]
      const rarityColor = rarityConf.color
      const rarityLabel = rarityConf.label

      const itemName = t('item.' + item.itemId + '.name', undefined, def.name)

      const row = document.createElement('div')
      row.className = 'market-item-row'
      row.innerHTML = `
        <div class="market-row-left">
          <span class="market-row-icon">${getItemIconMarkup(item.itemId, def.icon)}</span>
          <div class="market-row-info">
            <div class="market-row-name" style="color:${rarityColor}">${itemName} <span style="font-size:0.65rem;opacity:0.8">[${rarityLabel}]</span></div>
            <div class="market-row-price">${t('ui.market.gold_per_unit', { price: this._formatGold(price) })}</div>
          </div>
        </div>
        <div class="market-row-stock">${item.amount}</div>
      `

      row.addEventListener('click', () => this._selectItem(item.itemId))
      listEl.appendChild(row)
    }

    // 如果沒有可售物品
    if (listEl.children.length === 0) {
      listEl.innerHTML = `<div class="market-empty">${t('ui.market.no_items')}</div>`
    }
  }

  private _selectItem(itemId: ItemId): void {
    this.selectedItem = itemId
    const item = this.inventory.find(i => i.itemId === itemId)
    if (!item) return

    const def = ITEMS[itemId]
    const price = marketPricing.getPrice(itemId, this.gameDay)

    this.maxStock = item.amount
    this.qty = 1

    const detailEl = this.el.querySelector('#market-detail')! as HTMLElement
    detailEl.style.display = 'block'

    const selRarity = ITEM_RARITY[itemId] ?? 'common'
    const selRarityConf = RARITY_CONFIG[selRarity]
    const itemName = t('item.' + itemId + '.name', undefined, def?.name ?? t('ui.market.blueprint_default'))
    this.el.querySelector('#md-icon')!.innerHTML = getItemIconMarkup(itemId, def?.icon || '📦')
    const mdNameEl = this.el.querySelector<HTMLElement>('#md-name')!
    mdNameEl.style.color = selRarityConf.color
    mdNameEl.innerHTML = `${itemName} <span style="font-size:0.65rem;opacity:0.8">[${selRarityConf.label}]</span>`
    this.el.querySelector('#md-price')!.textContent = this._formatGold(price)
    this.el.querySelector('#md-stock')!.textContent = String(this.maxStock)

    this._refreshDetail()
  }

  private _setQty(n: number): void {
    this.qty = Math.max(1, Math.min(n, this.maxStock))
    this._refreshDetail()
  }

  private _refreshDetail(): void {
    const price = this.selectedItem ? marketPricing.getPrice(this.selectedItem, this.gameDay) : 0
    const total = marketPricing.calculateGold(this.selectedItem || 'wood', this.qty, this.gameDay)

    this.el.querySelector('#mq-num')!.textContent = String(this.qty)
    this.el.querySelector('#md-total')!.textContent = this._formatGold(total)
  }

  private _refreshDaily(): void {
    const el = this.el.querySelector<HTMLElement>('#market-daily')
    if (!el) return
    const itemId  = marketPricing.getDailyBlueprint(this.gameDay)
    const def     = ITEMS[itemId]
    const canBuy  = this.gold >= BLUEPRINT_PRICE
    const defName = t('item.' + itemId + '.name', undefined, def?.name ?? t('ui.market.blueprint_default'))
    el.innerHTML = `
      <div class="market-daily-label">${t('ui.market.daily_label')}</div>
      <div class="market-daily-item">
        <span class="market-daily-icon">${getItemIconMarkup(itemId, def?.icon ?? '📜')}</span>
        <div class="market-daily-info">
          <div class="market-daily-name">${defName}</div>
          <div class="market-daily-price">💰 ${BLUEPRINT_PRICE.toLocaleString()} ${t('ui.market.gold_unit')}</div>
        </div>
        <button class="btn-buy-blueprint${canBuy ? '' : ' disabled'}"
                data-item-id="${itemId}"
                ${canBuy ? '' : 'disabled'}>
          ${canBuy ? t('ui.market.buy_btn') : t('ui.market.no_gold')}
        </button>
      </div>
    `
  }

  private _executeSell(): void {
    if (!this.selectedItem || this.qty <= 0 || !this.onSell) return
    const itemId = this.selectedItem
    this.onSell(itemId, this.qty)
    // 賣出後不關閉 UI，方便連續賣多次
    // 但要更新顯示，因為 inventory 已變化
    // 由外部呼叫 refresh() 來更新
  }

  /** 買入/賣出後外部呼叫，更新顯示 */
  refresh(inventory: InventoryItem[], gold = this.gold, gameDay = this.gameDay): void {
    this.gold = Math.floor(gold)
    this.gameDay = gameDay
    this.inventory = inventory
    this._refreshDaily()
    this._refreshItemList()
    // 如果當前選的物品還在背包中，更新 maxStock 和 qty
    if (this.selectedItem) {
      const item = inventory.find(i => i.itemId === this.selectedItem)
      if (item) {
        this.maxStock = item.amount
        this.qty = Math.min(this.qty, this.maxStock)
        this.el.querySelector('#md-stock')!.textContent = String(this.maxStock)
        this._refreshDetail()
      } else {
        // 物品賣完了，關掉詳情
        this.selectedItem = null
        const detailEl = this.el.querySelector('#market-detail')! as HTMLElement
        detailEl.style.display = 'none'
      }
    }
  }
}
