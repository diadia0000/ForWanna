// Agent 5+ 負責（新增）— 寶箱實體
import * as PIXI from 'pixi.js'
import type { NodeId } from '@/types'
import { rollLootRarity, generateLoot, type LootRarity } from './treasureConfig'

export interface TreasureChestData {
  id: NodeId
  x: number
  y: number
  rarity: LootRarity  // 預先決定的稀有度
  loot: Array<{ itemId: string; amount: number }>
  opened: boolean
}

export class TreasureChestEntity {
  readonly id: string
  readonly sprite: PIXI.Container
  private data: TreasureChestData
  private gfx: PIXI.Graphics
  private glowTicker: (() => void) | null = null
  private glowAlpha = 0
  private glowDirection = 1

  constructor(data: TreasureChestData) {
    this.id = data.id
    this.data = { ...data }

    this.sprite = new PIXI.Container()
    this.gfx = new PIXI.Graphics()

    this._buildSprite()
    this.sprite.x = data.x
    this.sprite.y = data.y
    // 不使用 click 開箱，改為靠近按 R 開啟
    this.sprite.eventMode = 'none'
  }

  private _buildSprite(): void {
    // ── 寶箱基礎圖形（2×2 格，像素風格） ─────────────────────
    this.gfx.clear()

    // 寶箱外觀：根據稀有度著色
    const colors = {
      common: 0x8b7355,  // 棕色
      rare: 0x4169e1,    // 皇家藍
      epic: 0xffd700,    // 金色
    }
    const glows = {
      common: 0xc9a468,
      rare: 0x6fa8ff,
      epic: 0xffec80,
    }

    const color = colors[this.data.rarity]
    const glowColor = glows[this.data.rarity]
    // 2×2 格 = 96px，視覺居中
    const TW = 88   // 寬度（留 4px 邊距）
    const TH = 72   // 高度

    // 陰影
    this.gfx.ellipse(0, TH * 0.55, TW * 0.5, 8).fill({ color: 0x000000, alpha: 0.25 })

    // 箱體主體
    this.gfx.roundRect(-TW / 2, -TH * 0.35, TW, TH * 0.65, 6).fill({ color, alpha: 0.95 })
    this.gfx.roundRect(-TW / 2, -TH * 0.35, TW, TH * 0.65, 6).stroke({ color: 0x000000, width: 1.5, alpha: 0.6 })

    // 箱蓋
    this.gfx.roundRect(-TW / 2, -TH * 0.52, TW, TH * 0.25, 6).fill({ color: glowColor, alpha: 1.0 })
    this.gfx.roundRect(-TW / 2, -TH * 0.52, TW, TH * 0.25, 6).stroke({ color: 0x000000, width: 1.5, alpha: 0.6 })

    // 中央鎖扣
    this.gfx.rect(-8, -TH * 0.18, 16, 14).fill({ color: 0xffd700, alpha: 0.9 })
    this.gfx.rect(-8, -TH * 0.18, 16, 14).stroke({ color: 0x000000, width: 1 })
    this.gfx.circle(0, -TH * 0.06, 5).fill(0x111111)

    // 裝飾條紋（橫向加固帶）
    this.gfx.rect(-TW / 2, -TH * 0.02, TW, 5).fill({ color: 0x000000, alpha: 0.25 })
    this.gfx.rect(-TW / 2, TH * 0.12, TW, 5).fill({ color: 0x000000, alpha: 0.25 })

    // 高光
    this.gfx.roundRect(-TW / 2 + 4, -TH * 0.48, TW * 0.4, 5, 2).fill({ color: 0xffffff, alpha: 0.35 })

    this.sprite.addChild(this.gfx)
    // 更新 zIndex（稍微高一點讓寶箱顯示在地板物件之上）
    this.sprite.zIndex = this.data.y + 60

    // ── 發光動畫 ──────────────────────────────────────────────
    this.glowAlpha = 0
    this.glowTicker = () => {
      this.glowAlpha += this.glowDirection * 0.025
      if (this.glowAlpha > 0.8) this.glowDirection = -1
      if (this.glowAlpha < 0)   this.glowDirection = 1
      this.gfx.alpha = 0.9 + this.glowAlpha * 0.12
    }
  }

  /**
   * 更新發光效果
   */
  update(): void {
    if (this.glowTicker && !this.data.opened) {
      this.glowTicker()
    }
  }

  /**
   * 打開寶箱，返回掉落物品
   */
  open(): Array<{ itemId: string; amount: number }> {
    if (this.data.opened) return []

    this.data.opened = true
    this.glowTicker = null
    this.gfx.alpha = 0.5  // 打開後變暗

    // 可加視覺特效（如爆炸、金幣飛出等）
    return this.data.loot
  }

  /**
   * 取得寶箱資料（供 Host 廣播用）
   */
  getData(): TreasureChestData {
    return { ...this.data }
  }

  /**
   * 是否已打開
   */
  isOpened(): boolean {
    return this.data.opened
  }

  /**
   * 銷毀（移除 sprite）
   */
  destroy(): void {
    this.glowTicker = null
    this.sprite.removeAllListeners()
    this.gfx.destroy()
    this.sprite.destroy()
  }
}
