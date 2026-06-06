import * as PIXI from 'pixi.js'
import { t as i18nT } from '@/core/i18n'

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn'

// 一個完整晝夜循環的秒數
const CYCLE_S = 600   // 10 分鐘

/**
 * 日夜循環系統。
 * - PIXI overlay：仍掛在 stage，負責畫面夜晚深藍暗化
 * - HTML bar：頂部橫條，顯示時間進度（替代飄動太陽/月亮）
 */
export class DayNight {
  private overlay:     PIXI.Graphics
  private timeS      = 0
  private dayCount   = 1
  private w: number
  private h: number
  private barEl:      HTMLElement
  private _attached  = false   // 是否已注入 HUD

  constructor(stage: PIXI.Container, screenW: number, screenH: number) {
    this.w = screenW
    this.h = screenH

    this.overlay = new PIXI.Graphics()
    this.overlay.eventMode = 'none'
    stage.addChild(this.overlay)

    this.barEl = this._createBar()
    // 先掛在 body；HUD 出現後自動移入（見 _tryAttach）
    document.body.appendChild(this.barEl)

    this._apply()
  }

  // ── 公開 API ──────────────────────────────────────────────

  /** 從存檔還原日夜狀態 */
  restore(dayCount: number, timeS: number): void {
    this.dayCount = Math.max(1, dayCount)
    this.timeS    = Math.max(0, timeS) % CYCLE_S
    this._apply()
  }

  get currentDayCount(): number { return this.dayCount }
  get currentTimeS():    number { return this.timeS    }
  get cycleSeconds():    number { return CYCLE_S      }

  get phase(): DayPhase {
    const t = this.timeS / CYCLE_S
    if (t < 0.25 || t >= 0.75) return 'day'
    if (t < 0.35) return 'dusk'
    if (t < 0.65) return 'night'
    return 'dawn'
  }

  /** 0~1：夜晚程度（0=白天，1=全夜） */
  get darkness(): number {
    const t = this.timeS / CYCLE_S
    if (t < 0.25)  return 0
    if (t < 0.35)  return (t - 0.25) / 0.10
    if (t < 0.65)  return 1
    if (t < 0.75)  return 1 - (t - 0.65) / 0.10
    return 0
  }

  update(deltaMs: number): void {
    // HUD 就緒後自動移入，讓橫條融入 HUD flex row（只執行一次）
    if (!this._attached) this._tryAttach()

    const prevT = this.timeS / CYCLE_S
    this.timeS  = (this.timeS + deltaMs / 1000) % CYCLE_S
    const newT  = this.timeS / CYCLE_S
    if (newT < prevT) this.dayCount++  // 完成一整圈
    this._apply()
  }

  fastForward(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const total = this.timeS + seconds
    const dayDelta = Math.floor(total / CYCLE_S)
    this.timeS = total % CYCLE_S
    this.dayCount += dayDelta
    this._apply()
  }

  setTime(dayCount: number, timeS: number): void {
    this.dayCount = Math.max(1, Math.floor(dayCount || 1))
    this.timeS = ((timeS % CYCLE_S) + CYCLE_S) % CYCLE_S
    this._apply()
  }

  private _tryAttach(): void {
    const center = document.querySelector<HTMLElement>('#hud-center')
    if (!center) return
    this.barEl.remove()
    center.appendChild(this.barEl)
    this._attached = true
  }

  /** 跳過夜晚（使用床）：重置到清晨（timeS=0），並增加一天 */
  skipToMorning(): void {
    // 只有在傍晚/夜晚/黎明才有效；白天用床沒意義但也不阻擋
    this.timeS = 0       // t=0 → day phase (bright morning)
    this.dayCount++
    this._apply()
  }

  /** 當前是否為夜晚（可使用床） */
  get isNight(): boolean {
    const phase = this.phase
    return phase === 'night' || phase === 'dusk' || phase === 'dawn'
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this._apply()
  }

  destroy(): void {
    this.barEl.remove()
  }

  // ── HTML 橫條 ────────────────────────────────────────────

  private _createBar(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'daynight-bar'
    el.innerHTML = `
      <span id="dn-icon">☀</span>
      <span id="dn-day">${i18nT('render.daynight.day', { count: 1 }, 'DAY 1')}</span>
      <div id="dn-track"><div id="dn-dot"></div></div>
    `
    return el
  }

  // ── 每幀更新 ──────────────────────────────────────────────

  private _apply(): void {
    const t = this.timeS / CYCLE_S

    // ── PIXI 覆蓋層（夜晚暗化） ──
    this.overlay.clear()
    const alpha = this.darkness
    if (alpha > 0.004) {
      let color: number
      if      (t < 0.35) color = lerpColor(0xff6600, 0x00001a, (t - 0.25) / 0.10)
      else if (t < 0.65) color = 0x00001a
      else               color = lerpColor(0x00001a, 0xff6622, (t - 0.65) / 0.10)
      this.overlay.rect(0, 0, this.w, this.h)
        .fill({ color, alpha: Math.min(alpha * 0.62, 0.62) })
    }

    // ── HTML 進度橫條 ──
    const phase = this.phase
    const icon  = phase === 'night' ? '🌙' : phase === 'dusk' ? '🌆' : phase === 'dawn' ? '🌅' : '☀'
    const pct   = (t * 100).toFixed(2)

    const dot = this.barEl.querySelector<HTMLElement>('#dn-dot')
    const lbl = this.barEl.querySelector<HTMLElement>('#dn-day')
    const ico = this.barEl.querySelector<HTMLElement>('#dn-icon')
    if (dot) dot.style.left = `${pct}%`
    if (lbl) lbl.textContent = i18nT('render.daynight.day', { count: this.dayCount }, `DAY ${this.dayCount}`)
    if (ico) ico.textContent = icon
  }
}

// ── 工具 ─────────────────────────────────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8)  |
     Math.round(ab + (bb - ab) * t)
  )
}
