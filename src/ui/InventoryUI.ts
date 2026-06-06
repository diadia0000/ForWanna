// Agent 9 負責 — src/ui/InventoryUI.ts
import type { InventoryItem, PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'

const TOTAL_SLOTS = 18   // 9 × 2 固定格數

export class InventoryUI {
  private el: HTMLElement
  private visible = false
  private playerId: PlayerId | null = null

  // ── 拖曳狀態 ───────────────────────────────────────────────
  private slots: (InventoryItem | null)[] = Array(TOTAL_SLOTS).fill(null)
  private dragFrom: number | null = null
  private ghost: HTMLElement | null = null
  private onReorder: ((newInv: InventoryItem[]) => void) | null = null
  // 背包拖曳放入用：暴露當前拖曳物品
  dragItem: { itemId: string; amount: number; fromIdx: number } | null = null
  /** 拖曳被背包格子接受時呼叫 — 移除來源格子 */
  onBagAccept: ((fromIdx: number) => void) | null = null

  constructor() {
    this.el = this.buildHTML()
    document.body.appendChild(this.el)

    EventBus.on('ui:close_inventory', () => this.hide())
    EventBus.on('inventory:changed', ({ playerId, inventory }) => {
      if (this.playerId && playerId !== this.playerId) return
      if (this.visible) this._loadSlots(inventory)
    })
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        e.stopPropagation()
        this.hide()
      }
    })

    // 語言切換時重繪（若可見）
    EventBus.on('i18n:changed', () => {
      if (this.visible) this._renderSlots()
    })
  }

  // ── 公開 API ───────────────────────────────────────────────

  setOnReorder(fn: (newInv: InventoryItem[]) => void): void { this.onReorder = fn }

  setPlayerId(playerId: PlayerId): void { this.playerId = playerId }

  show(inventory: InventoryItem[] | null): void {
    this.visible = true
    this.el.style.display = 'flex'
    if (inventory) this._loadSlots(inventory)
  }

  hide(): void {
    this._cancelDrag()
    this.visible = false
    this.el.style.display = 'none'
  }

  toggle(inventory: InventoryItem[]): void {
    if (this.visible) this.hide()
    else this.show(inventory)
  }

  get isVisible(): boolean { return this.visible }

  /** 舊版 render()：外部仍可呼叫 */
  render(inventory: InventoryItem[]): void { this._loadSlots(inventory) }

  /**
   * HotbarUI 背包格子接受拖曳時呼叫：移除來源格子、觸發 onReorder、清除拖曳狀態
   * 回傳被移走的物品（用於放入背包），若已取消或找不到則回傳 null
   */
  acceptBagDrop(): InventoryItem | null {
    const drag = this.dragItem
    if (!drag) return null
    const item = this.slots[drag.fromIdx]
    if (!item) { this._cancelDrag(); return null }
    // 移除該格子
    this.slots[drag.fromIdx] = null
    const newInv = this.slots.filter((s): s is InventoryItem => s !== null && s.amount > 0)
    this.onReorder?.(newInv)
    this._cancelDrag()
    return item
  }

  // ── 內部 ───────────────────────────────────────────────────

  private buildHTML(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'inventory-ui'
    div.style.display = 'none'
    div.innerHTML = `
      <div class="inv-container">
        <div id="inventory-grid" class="item-grid"></div>
      </div>
    `
    return div
  }

  /** 把 inventory 陣列展開成固定 18 格 */
  private _loadSlots(inventory: InventoryItem[]): void {
    this.slots = Array(TOTAL_SLOTS).fill(null)
    inventory.slice(0, TOTAL_SLOTS).forEach((item, i) => { this.slots[i] = item })
    this._renderSlots()
  }

  private _renderSlots(): void {
    const grid = this.el.querySelector('#inventory-grid')!
    grid.innerHTML = ''

    this.slots.forEach((item, i) => {
      const slot = document.createElement('div')
      slot.className = 'item-slot' + (item ? ' has-item' : '')
      slot.dataset.idx = String(i)

      if (item) {
        const def = ITEMS[item.itemId]
        const itemName = t('item.' + item.itemId + '.name', undefined, def?.name ?? t('ui.common.unknown'))
        if (itemName) slot.title = itemName
        slot.innerHTML = `
          <span class="item-icon">${getItemIconMarkup(item.itemId, def?.icon ?? '📦')}</span>
          <span class="item-amount">×${item.amount}</span>
          <span class="item-label">${itemName}</span>
        `
        slot.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return  // 只接受左鍵
          e.preventDefault()
          this._startDrag(i, item, slot, e)
        })
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault()  // 禁止右鍵選單，避免 ghost 卡住
        })
      }

      // 接受 drop（含空格）
      slot.addEventListener('mouseup',    () => this._drop(i))
      slot.addEventListener('mouseenter', () => {
        if (this.dragFrom !== null && this.dragFrom !== i)
          slot.classList.add('item-slot--dragover')
      })
      slot.addEventListener('mouseleave', () => {
        slot.classList.remove('item-slot--dragover')
      })

      grid.appendChild(slot)
    })
  }

  // ── 拖曳 ─────────────────────────────────────────────────

  private _startDrag(idx: number, item: InventoryItem, slotEl: HTMLElement, e: MouseEvent): void {
    // 防護：先清除任何遺留的 ghost / 拖曳狀態
    this._cancelDrag()
    // 防護：清除頁面上所有殘留的 .drag-ghost 元素
    document.querySelectorAll('.drag-ghost').forEach(el => el.remove())

    this.dragFrom = idx
    this.dragItem = { itemId: item.itemId, amount: item.amount, fromIdx: idx }
    const def = ITEMS[item.itemId]

    // 浮動 ghost
    this.ghost = document.createElement('div')
    this.ghost.className = 'drag-ghost'
    this.ghost.innerHTML = `<span class="item-icon">${getItemIconMarkup(item.itemId, def?.icon ?? '📦')}</span>`
    this._moveGhost(e.clientX, e.clientY)
    document.body.appendChild(this.ghost)

    slotEl.classList.add('item-slot--dragging')

    const onMove = (ev: MouseEvent) => this._moveGhost(ev.clientX, ev.clientY)
    const onUp   = () => {
      this._cancelDrag()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  private _moveGhost(cx: number, cy: number): void {
    if (!this.ghost) return
    this.ghost.style.left = `${cx - 32}px`
    this.ghost.style.top  = `${cy - 32}px`
  }

  private _drop(toIdx: number): void {
    const from = this.dragFrom
    this._cancelDrag()
    if (from === null || from === toIdx) return

    // 交換格子
    const newSlots = [...this.slots]
    const temp      = newSlots[from]
    newSlots[from]  = newSlots[toIdx]
    newSlots[toIdx] = temp
    this.slots = newSlots

    // 壓縮（過濾空格）後通知外部
    const newInv = newSlots
      .filter((s): s is InventoryItem => s !== null && s.itemId !== '' && s.amount > 0)
    if (this.onReorder) this.onReorder(newInv)

    this._renderSlots()
  }

  private _cancelDrag(): void {
    this.dragFrom = null
    this.dragItem = null
    this.ghost?.remove()
    this.ghost = null
    // 強制清除頁面上所有殘留的 .drag-ghost（防止卡住）
    document.querySelectorAll('.drag-ghost').forEach(el => el.remove())
    this.el.querySelectorAll('.item-slot--dragover, .item-slot--dragging')
      .forEach(el => el.classList.remove('item-slot--dragover', 'item-slot--dragging'))
  }
}
