// src/quest/QuestUI.ts — FTB Quest 風格進度側欄
import { MILESTONES, CATEGORY_ICONS, MilestoneCategory } from './milestones'
import type { QuestSystem } from './QuestSystem'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

const CATEGORIES: MilestoneCategory[] = ['gather', 'combat', 'build', 'explore']

export class QuestUI {
  private el:      HTMLElement
  private visible  = false
  private quest:   QuestSystem
  private activeTab: MilestoneCategory = 'gather'

  constructor(quest: QuestSystem) {
    this.quest = quest
    this.el    = this._buildHTML()
    document.body.appendChild(this.el)

    // 關閉按鈕
    this.el.querySelector('#quest-close')?.addEventListener('click', () => this.hide())

    // Tab 切換
    this.el.querySelectorAll('.quest-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = (btn as HTMLElement).dataset.cat as MilestoneCategory
        this.activeTab = cat
        this.refresh()
      })
    })

    // 語言切換時重繪
    EventBus.on('i18n:changed', () => this._rebuildHeader())
  }

  toggle(): void { this.visible ? this.hide() : this.show() }

  show(): void {
    this.visible = true
    this.el.style.display = 'flex'
    this.refresh()
  }

  hide(): void {
    this.visible = false
    this.el.style.display = 'none'
  }

  refresh(): void {
    if (!this.visible) return
    // 更新 Tab 高亮
    this.el.querySelectorAll('.quest-tab').forEach(btn => {
      const active = (btn as HTMLElement).dataset.cat === this.activeTab
      btn.classList.toggle('quest-tab--active', active)
    })

    // 更新 Tab 標籤文字（語言切換後同步）
    this.el.querySelectorAll('.quest-tab').forEach(btn => {
      const cat = (btn as HTMLElement).dataset.cat as MilestoneCategory
      btn.textContent = `${CATEGORY_ICONS[cat]} ${t(`quest.category.${cat}`)}`
    })

    // 更新任務列表
    const list = this.el.querySelector<HTMLElement>('#quest-list')!
    const items = MILESTONES.filter(m => m.category === this.activeTab)
    list.innerHTML = items.map(m => {
      const cur   = Math.min(this.quest.getProgress(m.trackKey), m.goal)
      const done  = this.quest.isCompleted(m.id)
      const pct   = Math.round((cur / m.goal) * 100)
      const title = t(`quest.${m.id}.title`, undefined, m.title)
      const desc  = t(`quest.${m.id}.desc`,  undefined, m.desc)
      return `
        <div class="quest-item${done ? ' quest-item--done' : ''}">
          <span class="quest-icon">${done ? '✅' : m.icon}</span>
          <div class="quest-info">
            <div class="quest-title">${title}</div>
            <div class="quest-desc">${desc}</div>
            ${done ? '' : `
            <div class="quest-bar">
              <div class="quest-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="quest-progress">${cur} / ${m.goal}</div>
            `}
          </div>
        </div>
      `
    }).join('')

    // 更新完成比例
    const { done, total } = this.quest.getCompletionFraction()
    const head = this.el.querySelector<HTMLElement>('#quest-fraction')
    if (head) head.textContent = `${done} / ${total}`
  }

  // ── 完成彈窗通知 ────────────────────────────────────────────

  notifyComplete(milestoneId: string): void {
    const m = MILESTONES.find(x => x.id === milestoneId)
    if (!m) return
    const toastTitle = t('quest.toast.complete', undefined, '任務完成！')
    const milestoneTitle = t(`quest.${m.id}.title`, undefined, m.title)
    const toast = document.createElement('div')
    toast.className = 'quest-toast'
    toast.innerHTML = `
      <span class="quest-toast-icon">${m.icon}</span>
      <div>
        <div class="quest-toast-title">${toastTitle}</div>
        <div class="quest-toast-name">${milestoneTitle}</div>
      </div>
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.classList.add('quest-toast--show'), 10)
    setTimeout(() => {
      toast.classList.remove('quest-toast--show')
      setTimeout(() => toast.remove(), 400)
    }, 3000)
    if (this.visible) this.refresh()
  }

  // ── 語言切換重建標題文字 ───────────────────────────────────────

  private _rebuildHeader(): void {
    const titleEl = this.el.querySelector<HTMLElement>('#quest-title-text')
    if (titleEl) titleEl.textContent = t('quest.panel.title', undefined, '📋 任務進度')
    const closeEl = this.el.querySelector<HTMLElement>('#quest-close')
    if (closeEl) closeEl.textContent = t('quest.panel.close', undefined, '✕')
    this.refresh()
  }

  // ── HTML / CSS ───────────────────────────────────────────────

  private _buildHTML(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'quest-panel'
    el.style.display = 'none'

    const tabs = CATEGORIES.map(c =>
      `<button class="quest-tab" data-cat="${c}">${CATEGORY_ICONS[c]} ${t(`quest.category.${c}`)}</button>`
    ).join('')

    el.innerHTML = `
      <div id="quest-header">
        <span id="quest-title"><span id="quest-title-text">${t('quest.panel.title', undefined, '📋 任務進度')}</span> (<span id="quest-fraction">0/0</span>)</span>
        <button id="quest-close">${t('quest.panel.close', undefined, '✕')}</button>
      </div>
      <div id="quest-tabs">${tabs}</div>
      <div id="quest-list"></div>
    `

    // 注入 CSS（只注入一次）
    if (!document.getElementById('quest-styles')) {
      const style = document.createElement('style')
      style.id = 'quest-styles'
      style.textContent = `
        #quest-panel {
          position: fixed; right: 16px; top: 50px;
          width: 280px; max-height: 70vh;
          background: rgba(15,20,15,0.94);
          border: 1px solid #3a5a2a;
          border-radius: 10px;
          flex-direction: column;
          font-family: sans-serif;
          font-size: 13px;
          color: #d0e8c0;
          z-index: 100;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6);
          overflow: hidden;
        }
        #quest-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 12px;
          background: rgba(40,80,30,0.8);
          border-bottom: 1px solid #3a5a2a;
          font-weight: bold; font-size: 13px;
        }
        #quest-close {
          background: none; border: none; color: #a0c080; cursor: pointer; font-size: 14px;
        }
        #quest-tabs {
          display: flex; background: rgba(20,30,18,0.9);
          border-bottom: 1px solid #3a5a2a;
        }
        .quest-tab {
          flex: 1; padding: 5px 2px; background: none; border: none;
          color: #80a870; cursor: pointer; font-size: 11px;
          border-bottom: 2px solid transparent;
          transition: color .15s;
        }
        .quest-tab--active {
          color: #b0e890; border-bottom-color: #5a9a30;
        }
        #quest-list {
          overflow-y: auto; max-height: calc(70vh - 80px); padding: 6px 8px;
        }
        .quest-item {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 7px 6px; border-radius: 6px; margin-bottom: 4px;
          background: rgba(30,50,25,0.6);
          border: 1px solid rgba(60,100,40,0.4);
        }
        .quest-item--done { opacity: 0.55; }
        .quest-icon { font-size: 18px; flex-shrink: 0; line-height: 1.2; }
        .quest-info { flex: 1; min-width: 0; }
        .quest-title { font-weight: bold; font-size: 12px; color: #c8e8a8; }
        .quest-desc  { font-size: 10px; color: #88a878; margin-top: 1px; }
        .quest-bar   { height: 4px; background: #2a3a22; border-radius: 2px; margin-top: 4px; }
        .quest-bar-fill { height: 100%; background: #5ab030; border-radius: 2px; transition: width .3s; }
        .quest-progress { font-size: 10px; color: #88a878; text-align: right; margin-top: 1px; }

        /* 完成通知 Toast */
        .quest-toast {
          position: fixed; bottom: 80px; right: 16px;
          display: flex; align-items: center; gap: 10px;
          background: rgba(20,60,15,0.95);
          border: 1px solid #4a8a28;
          border-radius: 8px; padding: 10px 14px;
          color: #c0e8a0; font-size: 13px; z-index: 300;
          transform: translateX(120%); transition: transform .35s ease;
          box-shadow: 0 2px 12px rgba(0,0,0,0.5);
        }
        .quest-toast--show { transform: translateX(0); }
        .quest-toast-icon  { font-size: 22px; }
        .quest-toast-title { font-size: 10px; color: #88b870; }
        .quest-toast-name  { font-weight: bold; }
      `
      document.head.appendChild(style)
    }
    return el
  }
}
