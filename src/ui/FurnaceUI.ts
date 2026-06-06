// src/ui/FurnaceUI.ts
// 熔爐冶煉選單：鐵礦→鐵錠（3:1）、金礦→金錠（1:1）
// 垂直兩欄佈局：左欄配方列表 + 右欄詳細
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

type SmeltRecipe = 'iron' | 'gold' | 'gold_coin'

type SmeltDef = {
  oreId: string; ingotId: string; oreIcon: string; ingotIcon: string;
  oreNameKey: string; ingotNameKey: string; ratio: number; isCurrency?: boolean
}

const SMELT_RECIPES: Record<SmeltRecipe, SmeltDef> = {
  iron:      { oreId: 'iron', ingotId: 'ingot',      oreIcon: '⛏️', ingotIcon: '🔩', oreNameKey: 'ui.furnace.ore_name_iron',   ingotNameKey: 'ui.furnace.ingot_name_iron', ratio: 3 },
  gold:      { oreId: 'gold', ingotId: 'gold_ingot', oreIcon: '🟨', ingotIcon: '🏅', oreNameKey: 'ui.furnace.ore_name_gold',   ingotNameKey: 'ui.furnace.ingot_name_gold', ratio: 3 },
  gold_coin: { oreId: 'gold', ingotId: 'gold_coin',  oreIcon: '🟨', ingotIcon: '🪙', oreNameKey: 'ui.furnace.ore_name_gold',   ingotNameKey: 'ui.furnace.coin_name',       ratio: 1, isCurrency: true },
}

export class FurnaceUI {
  private el: HTMLElement
  private qty = 1
  private maxOre = 0
  private oreCounts: Record<SmeltRecipe, number> = { iron: 0, gold: 0, gold_coin: 0 }
  private activeRecipe: SmeltRecipe = 'iron'
  private onSmelt: ((recipe: SmeltRecipe, amount: number) => void) | null = null

  constructor() {
    this.el = this._build()
    document.body.appendChild(this.el)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.el.style.display !== 'none') this.hide()
    })

    // 語言切換時重建整個 UI（含靜態標籤）
    EventBus.on('i18n:changed', () => {
      if (this.el.style.display !== 'none') {
        const iron = this.oreCounts.iron
        const gold = this.oreCounts.gold
        const active = this.activeRecipe
        const qty    = this.qty

        const newEl = this._build()
        this.el.replaceWith(newEl)
        this.el = newEl

        // 恢復狀態
        this.oreCounts = { iron, gold, gold_coin: gold }
        this.qty = qty
        this._switchRecipe(active)
        this.el.style.display = 'flex'
      }
    })
  }

  // ── 公開 API ──────────────────────────────────────────────

  setOnSmelt(fn: (recipe: SmeltRecipe, amount: number) => void): void {
    this.onSmelt = fn
  }

  show(ironCount: number, goldCount: number): void {
    this.oreCounts = { iron: ironCount, gold: goldCount, gold_coin: goldCount }
    // 自動切換到有礦的配方
    this.activeRecipe = goldCount > 0 ? 'gold' : 'iron'
    this._switchRecipe(this.activeRecipe)
    this.el.style.display = 'flex'
  }

  hide(): void { this.el.style.display = 'none' }

  // ── 建立 DOM ──────────────────────────────────────────────

  private _build(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.id = 'furnace-ui'
    wrap.style.display = 'none'

    // 阻止滾輪事件冒泡到快捷欄
    wrap.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: false })

    wrap.innerHTML = `
      <div class="furnace-panel">
        <!-- 左欄：配方列表 -->
        <div class="craft-list-col furnace-list-col" id="furnace-recipe-list">
          <div class="furnace-list-title">${t('ui.furnace.title')}</div>
          <button class="craft-row furnace-recipe-btn active" data-recipe="iron">
            <span class="craft-row-icon">${getItemIconMarkup('iron', '⛏️')}</span>
            <span class="craft-row-name">${t('ui.furnace.iron_recipe')}</span>
          </button>
          <button class="craft-row furnace-recipe-btn" data-recipe="gold">
            <span class="craft-row-icon">${getItemIconMarkup('gold', '🟨')}</span>
            <span class="craft-row-name">${t('ui.furnace.gold_recipe')}</span>
          </button>
          <button class="craft-row furnace-recipe-btn" data-recipe="gold_coin">
            <span class="craft-row-icon">${getItemIconMarkup('gold', '🪙')}</span>
            <span class="craft-row-name">${t('ui.furnace.coin_recipe')}</span>
          </button>
        </div>

        <!-- 右欄：詳細資訊 -->
        <div class="craft-detail-col furnace-detail-col">
          <div class="furnace-detail-close-row">
            <button class="furnace-close">✕</button>
          </div>

          <div class="furnace-recipe-display">
            <div class="furnace-item">
              <span class="furnace-item-icon" id="f-ore-icon">⛏️</span>
              <span class="furnace-item-name" id="f-ore-name">${t('ui.furnace.ore_name_iron')}</span>
            </div>
            <span class="furnace-arrow">→</span>
            <div class="furnace-item">
              <span class="furnace-item-icon" id="f-ingot-icon">🔩</span>
              <span class="furnace-item-name" id="f-ingot-name">${t('ui.furnace.ingot_name_iron')}</span>
            </div>
          </div>

          <div class="furnace-ratio-row">
            ${t('ui.furnace.ratio')}<strong id="f-ratio">3:1</strong>
          </div>

          <div class="furnace-stock">
            ${t('ui.furnace.ore_held')}<strong id="furnace-ore-count">0</strong>
            &nbsp;｜&nbsp;
            ${t('ui.furnace.can_produce')}<strong id="furnace-ingot-result">0</strong>
          </div>

          <div class="craft-qty-row">
            <button class="btn-qty-arrow" id="fq-minus">◄</button>
            <span class="craft-qty-num" id="fq-num">1</span>
            <button class="btn-qty-arrow" id="fq-plus">►</button>
            <button class="btn-craft-extra" id="fq-half">${t('ui.common.half')}</button>
            <button class="btn-craft-extra" id="fq-max">${t('ui.common.max')}</button>
          </div>
          <button class="btn-smelt" id="fq-smelt">${t('ui.furnace.smelt_btn', { name: t('ui.furnace.ingot_name_iron'), qty: 1 })}</button>
        </div>
      </div>
    `

    wrap.querySelector('.furnace-close')!.addEventListener('click', () => this.hide())
    wrap.querySelector('#fq-minus')!.addEventListener('click', () => this._setQty(this.qty - 1))
    wrap.querySelector('#fq-plus')!.addEventListener('click',  () => this._setQty(this.qty + 1))
    wrap.querySelector('#fq-half')!.addEventListener('click',  () => this._setQty(Math.max(1, Math.floor(this.maxOre / 2))))
    wrap.querySelector('#fq-max')!.addEventListener('click',   () => this._setQty(Math.max(1, this.maxOre)))
    wrap.querySelector('#fq-smelt')!.addEventListener('click', () => {
      if (this.qty > 0 && this.onSmelt) {
        this.onSmelt(this.activeRecipe, this.qty)
        this.hide()
      }
    })

    wrap.querySelectorAll<HTMLButtonElement>('.furnace-recipe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._switchRecipe(btn.dataset.recipe as SmeltRecipe)
      })
    })

    return wrap
  }

  private _switchRecipe(recipe: SmeltRecipe): void {
    this.activeRecipe = recipe
    const def = SMELT_RECIPES[recipe]
    const ratio = def.ratio

    // 更新按鈕選中狀態
    this.el.querySelectorAll('.furnace-recipe-btn').forEach(btn => {
      const isActive = (btn as HTMLButtonElement).dataset.recipe === recipe
      btn.classList.toggle('active', isActive)
      btn.classList.toggle('craft-row--selected', isActive)
    })

    // 更新配方顯示
    this.el.querySelector('#f-ore-icon')!.innerHTML     = getItemIconMarkup(def.oreId, def.oreIcon)
    this.el.querySelector('#f-ore-name')!.textContent   = t(def.oreNameKey)
    this.el.querySelector('#f-ingot-icon')!.innerHTML   = getItemIconMarkup(def.ingotId, def.ingotIcon)
    this.el.querySelector('#f-ingot-name')!.textContent = t(def.ingotNameKey)
    this.el.querySelector('#f-ratio')!.textContent      = `${ratio}:1`

    // 持有礦石數決定最大可冶煉「錠數」
    this.maxOre = Math.floor(this.oreCounts[recipe] / ratio)
    this.qty = Math.max(0, Math.min(this.qty, this.maxOre))
    if (this.qty <= 0 && this.maxOre > 0) this.qty = 1
    this._refresh()
  }

  private _setQty(n: number): void {
    this.qty = Math.max(0, Math.min(n, this.maxOre))
    this._refresh()
  }

  private _refresh(): void {
    const def     = SMELT_RECIPES[this.activeRecipe]
    const oreEl   = this.el.querySelector<HTMLElement>('#furnace-ore-count')!
    const resEl   = this.el.querySelector<HTMLElement>('#furnace-ingot-result')!
    const numEl   = this.el.querySelector<HTMLElement>('#fq-num')!
    const smeltEl = this.el.querySelector<HTMLButtonElement>('#fq-smelt')!

    oreEl.textContent   = String(this.oreCounts[this.activeRecipe])
    resEl.textContent   = String(this.maxOre)
    numEl.textContent   = String(this.qty)
    smeltEl.textContent = t('ui.furnace.smelt_btn', { name: t(def.ingotNameKey), qty: this.qty })
    smeltEl.disabled    = this.qty <= 0 || this.maxOre <= 0
  }
}
