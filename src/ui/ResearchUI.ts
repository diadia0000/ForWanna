// src/ui/ResearchUI.ts — 工作站升級介面（雙欄選擇式，仿 CraftingUI）

import type { ItemId } from '@/types'
import { RESEARCH_UPGRADE_COSTS, type ResearchUpgradeCost } from '@/inventory/data/researchUpgradeCosts'
import { ITEMS } from '@/inventory'
import { getItemIconMarkup } from '@/render/ItemSpriteRegistry'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

export class ResearchUI {
  private el: HTMLElement
  private currentLevel = 1
  private selectedIndex = 0
  private upgradeInProgress = false
  private upgradeEndTime = 0
  private upgradeDuration = 0
  private onUpgrade: ((toLevel: number) => void) | null = null
  private tickInterval: number | null = null

  constructor() {
    this.el = this._build()
    document.body.appendChild(this.el)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.el.style.display !== 'none') this.hide()
    })

    // 語言切換時重繪（若可見）
    EventBus.on('i18n:changed', () => {
      if (this.el.style.display !== 'none') {
        this._renderList()
        this._renderDetail()
      }
    })
  }

  // ── 公開 API ──────────────────────────────────────────────

  setOnUpgrade(fn: (toLevel: number) => void): void {
    this.onUpgrade = fn
  }

  show(currentLevel: number): void {
    this.currentLevel = currentLevel
    // 預選第一個可用的項目
    const firstAvail = RESEARCH_UPGRADE_COSTS.findIndex(c => c.level > currentLevel)
    this.selectedIndex = firstAvail >= 0 ? firstAvail : 0
    this._renderList()
    this._renderDetail()
    this.el.style.display = 'flex'
    this._startTicker()
  }

  hide(): void {
    this.el.style.display = 'none'
    this._stopTicker()
  }

  setUpgradeProgress(durationSecs: number): void {
    this.upgradeDuration = durationSecs * 1000
    this.upgradeEndTime = performance.now() + this.upgradeDuration
    this.upgradeInProgress = true
    this._renderDetail()
  }

  // ── 建立 DOM ──────────────────────────────────────────────

  private _build(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.id = 'research-ui'
    wrap.style.display = 'none'
    wrap.innerHTML = `
      <div class="research-panel">
        <div class="research-header">
          <span>${t('ui.research.title')}</span>
          <span id="research-level-badge" class="research-level-badge"></span>
          <button class="research-close">✕</button>
        </div>
        <div class="research-body">
          <div class="research-list-col" id="research-list"></div>
          <div class="research-detail-col" id="research-detail"></div>
        </div>
      </div>
    `
    wrap.querySelector('.research-close')!.addEventListener('click', () => this.hide())
    return wrap
  }

  // ── 左欄：選項列表 ────────────────────────────────────────

  private _renderList(): void {
    const listEl = this.el.querySelector('#research-list')!
    listEl.innerHTML = ''

    // 更新等級徽章
    const badge = this.el.querySelector('#research-level-badge')!
    badge.textContent = `Lv ${this.currentLevel} / 10`

    RESEARCH_UPGRADE_COSTS.forEach((cost, idx) => {
      const isDone    = this.currentLevel >= cost.level
      const isSelected = idx === this.selectedIndex

      const row = document.createElement('button')
      row.className = [
        'research-row',
        isDone      ? 'research-row--done' : '',
        isSelected  ? 'research-row--selected' : '',
      ].join(' ')

      row.innerHTML = `
        <span class="research-row-icon">${isDone ? '✅' : '🔬'}</span>
        <span class="research-row-text">
          <span class="research-row-title">${cost.unlocksDescription}</span>
          <span class="research-row-sub">${t('ui.research.row_sub', { n: cost.level - 1 })}</span>
        </span>
        ${isDone ? `<span class="research-row-done-mark">${t('ui.research.done_mark')}</span>` : ''}
      `
      row.addEventListener('click', () => {
        this.selectedIndex = idx
        this._renderList()
        this._renderDetail()
      })
      listEl.appendChild(row)
    })
  }

  // ── 右欄：選項詳細 ────────────────────────────────────────

  private _renderDetail(): void {
    const detailEl = this.el.querySelector('#research-detail')!

    if (RESEARCH_UPGRADE_COSTS.length === 0) {
      detailEl.innerHTML = `<div class="research-detail-empty">${t('ui.research.no_items')}</div>`
      return
    }

    const cost = RESEARCH_UPGRADE_COSTS[this.selectedIndex]
    if (!cost) { detailEl.innerHTML = ''; return }

    const isDone = this.currentLevel >= cost.level

    // 材料清單 HTML
    const materialsHTML = cost.materials.length === 0
      ? `<div class="research-mat-free">${t('ui.research.mat_free')}</div>`
      : cost.materials.map(m => {
          const def = ITEMS[m.itemId]
          const matName = t('item.' + m.itemId + '.name', undefined, def?.name ?? m.itemId)
          return `<div class="research-mat-row">
            <span class="research-mat-icon">${getItemIconMarkup(m.itemId, def?.icon ?? '?')}</span>
            <span class="research-mat-name">${matName}</span>
            <span class="research-mat-amt">×${m.amount}</span>
          </div>`
        }).join('')

    const progressHTML = this.upgradeInProgress
      ? `<div class="research-progress-wrap">
           <div>${t('ui.research.progress_label')}</div>
           <div class="research-bar-track"><div class="research-bar-fill" id="research-bar-fill" style="width:0%"></div></div>
           <div id="research-time-left" class="research-time-left"></div>
         </div>`
      : ''

    const btnHTML = (!isDone && !this.upgradeInProgress)
      ? `<button class="btn-research-upgrade" id="btn-research-upgrade">${t('ui.research.upgrade_btn')}</button>`
      : ''

    const doneHTML = isDone
      ? `<div class="research-detail-done">${t('ui.research.detail_done')}</div>`
      : ''

    detailEl.innerHTML = `
      <div class="research-detail-title">${cost.unlocksDescription}</div>
      <div class="research-detail-meta">
        <div class="research-meta-row">${t('ui.research.meta_route', { n: cost.level - 1 })}</div>
        <div class="research-meta-row">${t('ui.research.meta_time',  { secs: cost.durationSecs })}</div>
        <div class="research-meta-row">${t('ui.research.meta_gold',  { gold: cost.gold.toLocaleString() })}</div>
      </div>
      <div class="research-detail-section-label">${t('ui.research.mats_label')}</div>
      <div class="research-mats">${materialsHTML}</div>
      ${doneHTML}
      ${progressHTML}
      ${btnHTML}
    `

    if (!isDone && !this.upgradeInProgress) {
      const btn = detailEl.querySelector<HTMLButtonElement>('#btn-research-upgrade')
      btn?.addEventListener('click', () => this._executeUpgrade())
    }
  }

  // ── 執行升級 ──────────────────────────────────────────────

  private _executeUpgrade(): void {
    if (!this.onUpgrade || this.upgradeInProgress) return
    const cost = RESEARCH_UPGRADE_COSTS[this.selectedIndex]
    if (!cost) return
    this.onUpgrade(cost.level)   // 回傳選擇的路線 level；main.ts 自行決定如何處理
  }

  // ── 進度計時 ──────────────────────────────────────────────

  private _startTicker(): void {
    if (this.tickInterval !== null) return
    this.tickInterval = window.setInterval(() => {
      if (!this.upgradeInProgress) return
      const now = performance.now()
      const remaining = Math.max(0, (this.upgradeEndTime - now) / 1000)

      const fillEl = this.el.querySelector<HTMLElement>('#research-bar-fill')
      const leftEl = this.el.querySelector<HTMLElement>('#research-time-left')

      if (remaining <= 0) {
        this.upgradeInProgress = false
        this.currentLevel = Math.min(10, this.currentLevel + 1)
        this._stopTicker()
        this._renderList()
        this._renderDetail()
      } else {
        const pct = Math.max(0,
          (this.upgradeDuration - (this.upgradeEndTime - now)) / this.upgradeDuration
        ) * 100
        if (fillEl) fillEl.style.width = pct + '%'
        if (leftEl) leftEl.textContent = t('ui.research.time_left', { secs: remaining.toFixed(1) })
      }
    }, 100)
  }

  private _stopTicker(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }
}
