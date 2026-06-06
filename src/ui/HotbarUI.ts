// src/ui/HotbarUI.ts
import type { InventoryItem, PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { getHeldItemKind, ITEMS } from '@/inventory'
import type { HeldItemKind } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import type { InventoryUI } from './InventoryUI'
import { t } from '@/core/i18n'

const BAG_ITEM_IDS = new Set(['bag_small', 'bag_large'])

export class HotbarUI {
  private el:        HTMLElement
  private slotEls:   HTMLElement[] = []
  private activeSlot = 0
  private inventory: InventoryItem[] = []
  private visible    = false
  private playerId: PlayerId | null = null

  // 背包相關回呼（由 main.ts 注入）
  private onBagRightClick: ((bagType: 'bag_small' | 'bag_large') => void) | null = null
  private invUI: InventoryUI | null = null

  constructor() {
    this.el = this.buildHTML()
    document.body.appendChild(this.el)

    // TAB 壓住時隱藏，放開恢復
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' && this.visible) this.el.style.display = 'none'
    })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab' && this.visible) this.el.style.display = 'flex'
    })

    // 滾輪切換格子
    window.addEventListener('wheel', (e) => {
      if (!this.visible) return
      this.activeSlot = e.deltaY > 0
        ? (this.activeSlot + 1) % 9
        : (this.activeSlot - 1 + 9) % 9
      this.updateActive()
    }, { passive: true })

    // 背包變動時同步
    EventBus.on('inventory:changed', ({ playerId, inventory }) => {
      if (this.playerId && playerId !== this.playerId) return
      this.inventory = inventory
      if (this.visible) this.render()
    })

    // 語言切換時重繪（若可見）
    EventBus.on('i18n:changed', () => {
      if (this.visible) this.render()
    })
  }

  /** 注入 InventoryUI 參考（用於拖曳放入背包） */
  setInventoryUI(invUI: InventoryUI): void {
    this.invUI = invUI
  }

  setPlayerId(playerId: PlayerId): void {
    this.playerId = playerId
  }

  /** 注入：快捷欄背包格子被右鍵時觸發 */
  setOnBagRightClick(fn: (bagType: 'bag_small' | 'bag_large') => void): void {
    this.onBagRightClick = fn
  }

  private buildHTML(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'hotbar'
    div.style.display = 'none'

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div')
      slot.className = 'hotbar-slot'
      slot.dataset.idx = String(i)

      // 左鍵：切換選中格子
      slot.addEventListener('click', () => {
        this.activeSlot = i
        this.updateActive()
      })

      // 右鍵：背包格子 → 開啟 BagUI
      slot.addEventListener('contextmenu', (e) => {
        const item = this.inventory[i]
        if (item && BAG_ITEM_IDS.has(item.itemId)) {
          e.preventDefault()
          e.stopPropagation()
          this.onBagRightClick?.(item.itemId as 'bag_small' | 'bag_large')
        }
      })

      // mouseup：InventoryUI 拖曳放入背包
      slot.addEventListener('mouseup', () => {
        if (!this.invUI?.dragItem) return
        const item = this.inventory[i]
        if (!item || !BAG_ITEM_IDS.has(item.itemId)) return
        // 背包格子接受拖曳
        const dropped = this.invUI.acceptBagDrop()
        if (!dropped) return
        // 發出事件給 main.ts 處理實際資料轉移
        ;(EventBus as any).emit('bag:drag_drop', {
          bagType: item.itemId as 'bag_small' | 'bag_large',
          itemId: dropped.itemId,
          amount: dropped.amount,
        })
        // 高亮提示
        slot.classList.add('hotbar-slot--bag-flash')
        setTimeout(() => slot.classList.remove('hotbar-slot--bag-flash'), 300)
      })

      // mouseenter 拖曳時高亮背包格子
      slot.addEventListener('mouseenter', () => {
        if (!this.invUI?.dragItem) return
        const item = this.inventory[i]
        if (item && BAG_ITEM_IDS.has(item.itemId)) {
          slot.classList.add('hotbar-slot--bag-hover')
        }
      })
      slot.addEventListener('mouseleave', () => {
        slot.classList.remove('hotbar-slot--bag-hover')
      })

      div.appendChild(slot)
      this.slotEls.push(slot)
    }
    return div
  }

  private render(): void {
    this.slotEls.forEach((slot, i) => {
      const item = this.inventory[i]
      if (item) {
        const def = ITEMS[item.itemId]
        const isBag = BAG_ITEM_IDS.has(item.itemId)
        const itemName = t('item.' + item.itemId + '.name', undefined, def?.name ?? t('ui.hotbar.unknown'))
        slot.innerHTML = `
          <span class="hotbar-icon">${getItemIconMarkup(item.itemId, def?.icon ?? '📦')}</span>
          <span class="hotbar-count">${item.amount}</span>
          <span class="hotbar-name">${itemName}${isBag ? ` <small style="opacity:.6">${t('ui.hotbar.bag_hint')}</small>` : ''}</span>
        `
      } else {
        slot.innerHTML = ''
      }
    })
  }

  private updateActive(): void {
    this.slotEls.forEach((slot, i) =>
      slot.classList.toggle('hotbar-slot--active', i === this.activeSlot))
  }

  /** 目前選中的格子索引（供採集/互動系統使用） */
  get activeIndex(): number { return this.activeSlot }

  /** 目前選中格子的物品 */
  get activeItem(): InventoryItem | undefined { return this.inventory[this.activeSlot] }

  get activeItemKind(): HeldItemKind { return getHeldItemKind(this.activeItem?.itemId) }

  show(inventory: InventoryItem[]): void {
    this.visible   = true
    this.inventory = inventory
    this.el.style.display = 'flex'
    this.render()
    this.updateActive()
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  update(inventory: InventoryItem[]): void {
    this.inventory = inventory
    if (this.visible) this.render()
  }
}
