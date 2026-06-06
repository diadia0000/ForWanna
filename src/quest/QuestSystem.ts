// src/quest/QuestSystem.ts
import { MILESTONES } from './milestones'

export type QuestProgress = Record<string, number>  // trackKey → 累計值
export type QuestCompleted = Set<string>             // milestone id

export class QuestSystem {
  private progress:  QuestProgress  = {}
  private completed: QuestCompleted = new Set()
  private _onComplete?: (id: string) => void

  setCompleteCallback(fn: (id: string) => void): void {
    this._onComplete = fn
  }

  // ── 進度更新 ────────────────────────────────────────────────

  add(trackKey: string, amount = 1): void {
    this.progress[trackKey] = (this.progress[trackKey] ?? 0) + amount
    this._checkMilestones()
  }

  set(trackKey: string, value: number): void {
    this.progress[trackKey] = value
    this._checkMilestones()
  }

  // ── 查詢 ────────────────────────────────────────────────────

  getProgress(trackKey: string): number {
    return this.progress[trackKey] ?? 0
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id)
  }

  getCompletionFraction(): { done: number; total: number } {
    return { done: this.completed.size, total: MILESTONES.length }
  }

  // ── 內部 ────────────────────────────────────────────────────

  private _checkMilestones(): void {
    for (const m of MILESTONES) {
      if (this.completed.has(m.id)) continue
      const cur = this.progress[m.trackKey] ?? 0
      if (cur >= m.goal) {
        this.completed.add(m.id)
        this._onComplete?.(m.id)
      }
    }
  }
}
