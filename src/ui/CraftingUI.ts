// src/ui/CraftingUI.ts
import type { RecipeDef, InventoryItem, PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'

// 工具/武器數值（不直接 import combat 模組，在 UI 層維護副本）
const WEAPON_STATS: Record<string, { damage: number; resDmg: number; range: number; cooldown: number; arc: number }> = {
  fist:             { damage: 1,  resDmg: 0.5, range: 1, cooldown: 800,  arc: 180 },
  stone_sword:      { damage: 2,  resDmg: 0.5, range: 1, cooldown: 600,  arc: 180 },
  axe:              { damage: 1,  resDmg: 2,   range: 1, cooldown: 700,  arc: 90  },
  pickaxe:          { damage: 1,  resDmg: 3,   range: 1, cooldown: 800,  arc: 90  },
  iron_sword:       { damage: 4,  resDmg: 2,   range: 2, cooldown: 500,  arc: 180 },
  iron_pick:        { damage: 2,  resDmg: 5,   range: 2, cooldown: 600,  arc: 90  },
  gold_sword:       { damage: 8,  resDmg: 4,   range: 3, cooldown: 400,  arc: 220 },
  magic_sword:      { damage: 80, resDmg: 4,   range: 3, cooldown: 500,  arc: 200 },
  mithril_sword:    { damage: 25, resDmg: 6,   range: 3, cooldown: 400,  arc: 220 },
  wood_bow:         { damage: 5,  resDmg: 0,   range: 8, cooldown: 800,  arc: 20  },
  iron_bow:         { damage: 10, resDmg: 0,   range: 10, cooldown: 600, arc: 20  },
  magic_bow:        { damage: 18, resDmg: 0,   range: 14, cooldown: 500, arc: 20  },
  laser_gun:        { damage: 3,  resDmg: 3,   range: 10, cooldown: 333, arc: 30  },
  whirlwind_hammer: { damage: 30, resDmg: 8,   range: 2, cooldown: 1500, arc: 360 },
}

export class CraftingUI {
  private el: HTMLElement
  private visible = false
  private onCraft: ((recipeId: string, qty: number) => void) | null = null
  private currentRecipes: Record<string, RecipeDef> = {}
  private currentInventory: InventoryItem[] = []
  private currentLevel = 1
  private selectedId: string | null = null
  private craftQty = 1
  private playerId: PlayerId | null = null

  constructor() {
    this.el = this.buildHTML()
    document.body.appendChild(this.el)

    EventBus.on('ui:close_crafting', () => this.hide())
    EventBus.on('inventory:changed', ({ playerId, inventory }) => {
      if (this.playerId && playerId !== this.playerId) return
      if (this.visible) {
        this.currentInventory = inventory
        this.renderList()
        if (this.selectedId) this.renderDetail(this.selectedId)
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) this.hide()
    })

    // 語言切換時重建整個 UI，包含隱藏狀態下已建立的靜態文字。
    EventBus.on('i18n:changed', () => {
      this.rebuildForLocale()
    })
  }

  setOnCraft(fn: (recipeId: string, qty: number) => void): void { this.onCraft = fn }

  setPlayerId(playerId: PlayerId): void { this.playerId = playerId }

  show(recipes: Record<string, RecipeDef>, inventory: InventoryItem[], level: number): void {
    this.visible = true
    this.currentRecipes = recipes
    this.currentInventory = inventory
    this.currentLevel = level
    this.selectedId = Object.keys(recipes)[0] ?? null
    this.el.style.display = 'flex'
    this.renderList()
    if (this.selectedId) this.renderDetail(this.selectedId)
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  toggle(recipes: Record<string, RecipeDef>, inventory: InventoryItem[], level: number): void {
    if (this.visible) this.hide()
    else this.show(recipes, inventory, level)
  }

  get isVisible(): boolean { return this.visible }

  // ── HTML 結構 ─────────────────────────────────────────────

  private buildHTML(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'crafting-ui'
    div.style.display = 'none'
    div.innerHTML = `
      <div class="craft-list-col" id="crafting-list"></div>
      <div class="craft-detail-col" id="crafting-detail">
        <div class="craft-detail-empty">${t('ui.crafting.empty_hint')}</div>
      </div>
    `
    // 阻止滾輪冒泡到快捷欄
    div.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: false })
    return div
  }

  private rebuildForLocale(): void {
    const wasVisible = this.visible
    const selectedId = this.selectedId
    const newEl = this.buildHTML()
    this.el.replaceWith(newEl)
    this.el = newEl

    if (!wasVisible) return
    this.el.style.display = 'flex'
    this.selectedId = selectedId
    this.renderList()
    if (this.selectedId) {
      this.renderDetail(this.selectedId)
    }
  }

  // ── 左欄：配方列表 ────────────────────────────────────────

  private renderList(): void {
    const list = this.el.querySelector('#crafting-list')!
    const invMap = this._invMap()
    list.innerHTML = ''

    for (const [id, recipe] of Object.entries(this.currentRecipes)) {
      const locked   = this.currentLevel < recipe.unlockLevel
      const canCraft = !locked && recipe.requires.every(
        r => (invMap.get(r.itemId) ?? 0) >= r.amount
      )
      const firstProduce = recipe.produces[0]
      const def = firstProduce ? ITEMS[firstProduce.itemId] : null

      const row = document.createElement('button')
      row.className = 'craft-row'
        + (canCraft  ? ' craft-row--ok'     : '')
        + (locked    ? ' craft-row--locked' : '')
        + (this.selectedId === id ? ' craft-row--selected' : '')

      const itemName = firstProduce
        ? t('item.' + firstProduce.itemId + '.name', undefined, def?.name ?? firstProduce.itemId)
        : '?'

      row.innerHTML = `
        <span class="craft-row-icon">${firstProduce ? getItemIconMarkup(firstProduce.itemId, def?.icon ?? '?') : '?'}</span>
        <span class="craft-row-name">${itemName}</span>
        ${locked ? '<span class="craft-row-lock">🔒</span>' : ''}
      `
      row.addEventListener('click', () => {
        this.selectedId = id
        this.renderList()
        this.renderDetail(id)
      })
      list.appendChild(row)
    }
  }

  // ── 右欄：選中配方細節 ────────────────────────────────────

  private renderDetail(id: string): void {
    const detail = this.el.querySelector('#crafting-detail')!
    const recipe = this.currentRecipes[id]
    if (!recipe) return

    const invMap   = this._invMap()
    const locked   = this.currentLevel < recipe.unlockLevel
    const maxQ     = this._maxCraftable(id)
    // clamp craftQty to current max when switching recipes
    this.craftQty  = Math.max(1, Math.min(this.craftQty, maxQ || 1))
    const canCraft = !locked && maxQ >= this.craftQty && this.craftQty > 0

    const firstProduce = recipe.produces[0]
    const def = firstProduce ? ITEMS[firstProduce.itemId] : null
    const owned = invMap.get(firstProduce?.itemId ?? '') ?? 0

    const detailName = firstProduce
      ? t('item.' + firstProduce.itemId + '.name', undefined, def?.name ?? firstProduce.itemId)
      : id

    const reqsHTML = recipe.requires.map(req => {
      const rdef = ITEMS[req.itemId]
      const have = invMap.get(req.itemId) ?? 0
      const need = req.amount * this.craftQty
      const ok   = have >= need
      const reqName = t('item.' + req.itemId + '.name', undefined, rdef?.name ?? req.itemId)
      return `
        <div class="craft-req-row ${ok ? 'craft-req--ok' : 'craft-req--miss'}">
          <span>${getItemIconMarkup(req.itemId, rdef?.icon ?? '?')} ${reqName}</span>
          <span>${need} / ${have}</span>
        </div>
      `
    }).join('')

    // 工具/武器數值區塊
    const producedItemId = recipe.produces[0]?.itemId ?? ''
    const weaponStat = WEAPON_STATS[producedItemId]
    const statsHTML = weaponStat ? `
      <div class="craft-weapon-stats">
        <div class="craft-stats-title">${t('ui.crafting.weapon_title')}</div>
        <div class="craft-stats-grid">
          <span>${t('ui.crafting.stat_damage')}</span><strong>${weaponStat.damage}</strong>
          <span>${t('ui.crafting.stat_res')}</span><strong>${weaponStat.resDmg}</strong>
          <span>${t('ui.crafting.stat_range')}</span><strong>${t('ui.crafting.stat_range_val', { val: weaponStat.range })}</strong>
          <span>${t('ui.crafting.stat_cooldown')}</span><strong>${t('ui.crafting.stat_cd_val', { val: (weaponStat.cooldown / 1000).toFixed(1) })}</strong>
        </div>
      </div>
    ` : ''

    detail.innerHTML = `
      <div class="craft-detail-name">${detailName}</div>
      <div class="craft-detail-icon">${firstProduce ? getItemIconMarkup(firstProduce.itemId, def?.icon ?? '?') : '?'}</div>
      <div class="craft-detail-owned">${t('ui.crafting.owned', { qty: owned })}</div>
      <div class="craft-reqs">${reqsHTML}</div>
      ${statsHTML}
      ${locked
        ? `<div class="craft-locked-msg">${t('ui.crafting.locked_msg', { lv: recipe.unlockLevel - 1 })}</div>`
        : `
          <div class="craft-qty-row">
            <button class="btn-qty-arrow" id="cq-minus">◄</button>
            <span class="craft-qty-num">${this.craftQty}</span>
            <button class="btn-qty-arrow" id="cq-plus">►</button>
            <button class="btn-craft-extra" id="cq-half">${t('ui.common.half')}</button>
            <button class="btn-craft-extra" id="cq-max">${t('ui.common.max')}</button>
          </div>
          <button class="btn-craft-main" ${canCraft ? '' : 'disabled'}>${t('ui.crafting.craft_btn', { qty: this.craftQty })}</button>
        `
      }
    `
    if (!locked) {
      const setQty = (n: number) => {
        this.craftQty = Math.max(1, Math.min(n, maxQ || 1))
        this.renderDetail(id)
      }
      detail.querySelector('#cq-minus')?.addEventListener('click', () => setQty(this.craftQty - 1))
      detail.querySelector('#cq-plus')?.addEventListener('click',  () => setQty(this.craftQty + 1))
      detail.querySelector('#cq-half')?.addEventListener('click',  () => setQty(Math.max(1, Math.floor(maxQ / 2))))
      detail.querySelector('#cq-max')?.addEventListener('click',   () => setQty(Math.max(1, maxQ)))
      if (canCraft && this.onCraft) {
        detail.querySelector('.btn-craft-main')!
          .addEventListener('click', () => this.onCraft!(id, this.craftQty))
      }
    }
  }

  // ── 工具 ─────────────────────────────────────────────────

  private _maxCraftable(id: string): number {
    const recipe = this.currentRecipes[id]
    if (!recipe || this.currentLevel < recipe.unlockLevel) return 0
    const invMap = this._invMap()
    let max = Infinity
    for (const req of recipe.requires) {
      const have = invMap.get(req.itemId) ?? 0
      max = Math.min(max, Math.floor(have / req.amount))
    }
    return max === Infinity ? 0 : Math.max(0, max)
  }

  private _invMap(): Map<string, number> {
    const m = new Map<string, number>()
    this.currentInventory.forEach(({ itemId, amount }) => m.set(itemId, amount))
    return m
  }
}
