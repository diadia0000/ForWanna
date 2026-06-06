// Agent 3 負責 — src/world/TileMap.ts
import * as PIXI from 'pixi.js'
import type { WorldData, TileType, Chunk } from '@/types'
import { TILE_TEXTURES, GRASS_TILE_VARIANTS, GRASS_DECO_TEXTURES } from '@/render/AssetLoader'
import { createTileSpriteSync, hasAnyTileSprite } from '@/render'

const TILE_SIZE  = 48
const CHUNK_SIZE = 16

// ── Farm RPG 風格色盤 ──────────────────────────────────────────
const GRASS = { base: 0x5CC840, lt: 0x82E060, dk: 0x389820 }
const WATER = { base: 0x4AAAE8, lt: 0x7CCEF8, dk: 0x2A78C8 }
const SAND  = { base: 0xC87A30, lt: 0xE8A850, dk: 0x9A5A18 }
const STONE_T = { base: 0x788898, lt: 0xA0B4C8, dk: 0x485868 }
const SNOW  = { base: 0xD0E0F0, lt: 0xF0F8FF, dk: 0x98AEBE }

// ── Seeded RNG（與 WorldGen 同款） ────────────────────────────
function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ── TileMap ───────────────────────────────────────────────────
export class TileMap {
  private container:       PIXI.Container
  private chunkGraphics:   Map<string, PIXI.Graphics> = new Map()
  private waterWaveG:      PIXI.Graphics = new PIXI.Graphics()
  private _animTicker:     ((t: PIXI.Ticker) => void) | null = null
  private _waterPositions: { x: number; y: number }[] = []

  constructor() {
    this.container = new PIXI.Container()
    // 水面動畫 — 全程掛在 Ticker 上
    this._animTicker = () => this._drawWaterAnim(performance.now() / 1000)
    PIXI.Ticker.shared.add(this._animTicker)
  }

  get displayObject(): PIXI.Container { return this.container }

  /** 回傳所有水面格子的世界中心座標（用於水面特效） */
  getWaterPositions(): { x: number; y: number }[] { return this._waterPositions }

  render(worldData: WorldData): void {
    this.container.removeChildren()
    this.chunkGraphics.clear()
    this._waterPositions = []
    worldData.chunks.forEach(chunk => this.renderChunk(chunk))
    // 水波動畫層疊在 chunk 上方
    this.container.addChild(this.waterWaveG)
  }

  /** 銷毀時清理 Ticker，避免持續佔用 */
  destroy(): void {
    if (this._animTicker) {
      PIXI.Ticker.shared.remove(this._animTicker)
      this._animTicker = null
    }
  }

  private renderChunk(chunk: Chunk): void {
    if (hasAnyTileSprite()) {
      this._renderChunkJsonSprites(chunk)
      return
    }
    // ── 有 Anokolisa tile sprites：用 Sprite 渲染 ─────────────
    if (TILE_TEXTURES['grass']) {
      this._renderChunkSprites(chunk)
      return
    }
    // ── 降級：PIXI.Graphics ────────────────────────────────────
    const g = new PIXI.Graphics()
    const rng = seededRandom(
      ((chunk.seed ^ (chunk.cx * 1000003)) ^ (chunk.cy * 999983)) >>> 0
    )
    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const tileType = chunk.tiles[ty][tx]
        const px = (chunk.cx * CHUNK_SIZE + tx) * TILE_SIZE
        const py = (chunk.cy * CHUNK_SIZE + ty) * TILE_SIZE
        this.drawTile(g, tileType, px, py, rng)
        if (tileType === 'water')
          this._waterPositions.push({ x: px + TILE_SIZE / 2, y: py + TILE_SIZE / 2 })
      }
    }
    this.container.addChild(g)
    this.chunkGraphics.set(`${chunk.cx}_${chunk.cy}`, g)
  }

  private _renderChunkJsonSprites(chunk: Chunk): void {
    const container = new PIXI.Container()
    const fallback = new PIXI.Graphics()
    container.addChild(fallback)
    const rng = seededRandom(
      ((chunk.seed ^ (chunk.cx * 1000003)) ^ (chunk.cy * 999983)) >>> 0
    )
    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const tileType = chunk.tiles[ty][tx]
        const px = (chunk.cx * CHUNK_SIZE + tx) * TILE_SIZE
        const py = (chunk.cy * CHUNK_SIZE + ty) * TILE_SIZE
        const worldTx = chunk.cx * CHUNK_SIZE + tx
        const worldTy = chunk.cy * CHUNK_SIZE + ty
        const variantSeed = (chunk.seed ^ Math.imul(worldTx, 374761393) ^ Math.imul(worldTy, 668265263)) >>> 0
        const sprite = createTileSpriteSync(tileType, TILE_SIZE, variantSeed)
        if (sprite) {
          sprite.x = px
          sprite.y = py
          container.addChild(sprite)
        } else {
          this.drawTile(fallback, tileType, px, py, rng)
        }
        if (tileType === 'water') {
          this._waterPositions.push({ x: px + TILE_SIZE / 2, y: py + TILE_SIZE / 2 })
        }
      }
    }
    this.container.addChild(container)
    this.chunkGraphics.set(`${chunk.cx}_${chunk.cy}`, null as unknown as PIXI.Graphics)
  }

  /** Sprite 版 chunk 渲染（使用 Anokolisa 16×16 tiles，×3 = 48×48） */
  private _renderChunkSprites(chunk: Chunk): void {
    const container = new PIXI.Container()
    const decoG     = new PIXI.Graphics()   // 草葉筆觸（PIXI.Graphics）
    const rng = seededRandom(
      ((chunk.seed ^ (chunk.cx * 1000003)) ^ (chunk.cy * 999983)) >>> 0
    )

    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const tileType = chunk.tiles[ty][tx]
        const px = (chunk.cx * CHUNK_SIZE + tx) * TILE_SIZE
        const py = (chunk.cy * CHUNK_SIZE + ty) * TILE_SIZE

        // ── rng call 1：草地 variant / 其他一致消耗 ──────────────
        // 水面：PIXI.Graphics 三層底（亮面 / 主色 / 暗深），wave 動畫才看得見
        if (tileType === 'water') {
          const TS = TILE_SIZE
          decoG.rect(px, py, TS, TS).fill(0x1A7ABE)                                               // 主藍
          decoG.rect(px, py, TS, Math.round(TS * 0.42)).fill({ color: 0x50A8D8, alpha: 0.30 })    // 上半亮面
          decoG.rect(px, py + Math.round(TS * 0.62), TS, Math.round(TS * 0.38))                   // 下半暗深
            .fill({ color: 0x083870, alpha: 0.22 })
          rng()   // 消耗 call 1
        } else {
          let tex: PIXI.Texture | undefined
          if (tileType === 'grass' && GRASS_TILE_VARIANTS.length > 0) {
            const idx = Math.floor(rng() * GRASS_TILE_VARIANTS.length)
            tex = GRASS_TILE_VARIANTS[idx]
          } else {
            tex = TILE_TEXTURES[tileType]
            rng()
          }
          if (tex) {
            const spr = new PIXI.Sprite(tex)
            spr.scale.set(3)
            spr.x = px
            spr.y = py
            container.addChild(spr)
          } else {
            decoG.rect(px, py, TILE_SIZE, TILE_SIZE).fill(0x888888)
          }
        }

        // ── rng call 2：裝飾種類  rng call 3：裝飾位置（每 tile 固定消耗）
        const decoRoll = rng()
        const posRoll  = rng()

        if (tileType === 'grass') {
          if (decoRoll < 0.032 && GRASS_DECO_TEXTURES.white) {
            // 白色菊花（原 8%→3.2%，降低 60%）
            const fspr = new PIXI.Sprite(GRASS_DECO_TEXTURES.white)
            fspr.scale.set(2)
            fspr.x = px + 8
            fspr.y = py + 8
            container.addChild(fspr)
          } else if (decoRoll < 0.056 && GRASS_DECO_TEXTURES.orange) {
            // 橙色花（原 6%→2.4%）
            const fspr = new PIXI.Sprite(GRASS_DECO_TEXTURES.orange)
            fspr.scale.set(2)
            fspr.x = px + 8
            fspr.y = py + 8
            container.addChild(fspr)
          } else if (decoRoll < 0.30) {
            // 草葉筆觸（2～3 條斜線，深綠）
            const bx = px + 5 + Math.floor(posRoll * 22)
            const by = py + 10
            const DG = 0x2A6E10
            decoG.rect(bx,     by,     2, 9).fill({ color: DG, alpha: 0.82 })
            decoG.rect(bx + 1, by - 3, 2, 7).fill({ color: DG, alpha: 0.68 })
            decoG.rect(bx + 7, by + 2, 2, 8).fill({ color: DG, alpha: 0.75 })
          }
        }

        if (tileType === 'water')
          this._waterPositions.push({ x: px + TILE_SIZE / 2, y: py + TILE_SIZE / 2 })
      }
    }

    container.addChild(decoG)

    this.container.addChild(container)
    // 存一個 null 標記讓舊 chunkGraphics key 不爆
    this.chunkGraphics.set(`${chunk.cx}_${chunk.cy}`, null as unknown as PIXI.Graphics)
  }

  /**
   * 每種 tile 固定消耗的 rng() 次數（確保後續 tile 亂數不錯位）：
   *   water : 4 次
   *   sand  : 10 次
   *   grass : 3 次（幾乎純色；少數花紋）
   *   stone : 4 次
   *   snow  : 6 次
   */
  private drawTile(
    g: PIXI.Graphics,
    type: TileType,
    px: number, py: number,
    rng: () => number
  ): void {
    const S = TILE_SIZE

    switch (type) {

      // ── 水面（無格線；動畫波紋由 waterWaveG 每幀重繪） ────────
      case 'water': {
        g.rect(px, py, S, S).fill(WATER.base)
        // 極輕微的中央淡色（水面透光，不畫格線邊框）
        g.rect(px+3, py+3, S-6, S-6).fill({ color: WATER.lt, alpha: 0.10 })
        // 4 次 rng（消耗用，維持後續 tile 亂數一致）
        for (let d = 0; d < 2; d++) { rng(); rng() }
        break
      }

      // ── 沙灘 ─────────────────────────────────────────────────
      case 'sand': {
        g.rect(px, py, S, S).fill(SAND.base)
        // bevel（左上亮、右下暗）
        g.rect(px,     py,     S, 1).fill({ color: SAND.lt, alpha: 0.75 })
        g.rect(px,     py,     1, S).fill({ color: SAND.lt, alpha: 0.60 })
        g.rect(px,     py+S-1, S, 1).fill({ color: SAND.dk, alpha: 0.65 })
        g.rect(px+S-1, py,     1, S).fill({ color: SAND.dk, alpha: 0.55 })
        // 沙粒細節（5 點，10 次 rng）
        for (let d = 0; d < 5; d++) {
          const dx = 2 + Math.floor(rng() * (S-4))
          const dy = 2 + Math.floor(rng() * (S-4))
          g.rect(px+dx, py+dy, 2, 2)
            .fill({ color: d < 3 ? SAND.dk : SAND.lt, alpha: 0.50 })
        }
        break
      }

      // ── 草地（Farm RPG：亮綠底 + bevel + 小白花/草葉裝飾） ────
      case 'grass': {
        g.rect(px, py, S, S).fill(GRASS.base)
        // bevel（左上亮、右下暗，Farm RPG 格子感）
        g.rect(px,     py,     S, 2).fill({ color: GRASS.lt, alpha: 0.55 })
        g.rect(px,     py,     2, S).fill({ color: GRASS.lt, alpha: 0.40 })
        g.rect(px,     py+S-2, S, 2).fill({ color: GRASS.dk, alpha: 0.60 })
        g.rect(px+S-2, py,     2, S).fill({ color: GRASS.dk, alpha: 0.50 })
        // 3 次 rng：8% 小白花，12% 草葉暗紋
        const roll = rng()
        const fx = 6 + Math.floor(rng() * (S - 12))
        const fy = 6 + Math.floor(rng() * (S - 12))
        if (roll < 0.032) {
          // 小白花：中心白點 + 4 個花瓣
          g.circle(px+fx,   py+fy,   2).fill({ color: 0xFFFFFF, alpha: 0.90 })
          g.circle(px+fx-3, py+fy,   1).fill({ color: 0xFFDDEE, alpha: 0.75 })
          g.circle(px+fx+3, py+fy,   1).fill({ color: 0xFFDDEE, alpha: 0.75 })
          g.circle(px+fx,   py+fy-3, 1).fill({ color: 0xFFDDEE, alpha: 0.75 })
          g.circle(px+fx,   py+fy+3, 1).fill({ color: 0xFFDDEE, alpha: 0.75 })
        } else if (roll < 0.056) {
          // 深綠草葉（Farm RPG 式暗紋小葉）
          const DK2 = 0x289010
          g.roundRect(px+fx,     py+fy,   6, 3, 1).fill({ color: DK2, alpha: 0.65 })
          g.roundRect(px+fx+2,   py+fy-3, 4, 3, 1).fill({ color: DK2, alpha: 0.48 })
        }
        break
      }

      // ── 岩石地板 ──────────────────────────────────────────────
      case 'stone': {
        g.rect(px, py, S, S).fill(STONE_T.base)
        // bevel
        g.rect(px,     py,     S, 1).fill({ color: STONE_T.lt, alpha: 0.65 })
        g.rect(px,     py,     1, S).fill({ color: STONE_T.lt, alpha: 0.50 })
        g.rect(px,     py+S-1, S, 1).fill({ color: STONE_T.dk, alpha: 0.60 })
        g.rect(px+S-1, py,     1, S).fill({ color: STONE_T.dk, alpha: 0.50 })
        // 裂縫（4 次 rng）
        const crX = 4 + Math.floor(rng() * 16)
        const crY = 3 + Math.floor(rng() * 14)
        const crL = 6 + Math.floor(rng() * 14)
        const crA = 0.28 + rng() * 0.26
        g.rect(px+crX, py+crY, crL, 1).fill({ color: STONE_T.dk, alpha: crA })
        break
      }

      // ── 雪地 ──────────────────────────────────────────────────
      case 'snow': {
        g.rect(px, py, S, S).fill(SNOW.base)
        // bevel
        g.rect(px,     py,     S, 1).fill({ color: SNOW.lt, alpha: 0.85 })
        g.rect(px,     py,     1, S).fill({ color: SNOW.lt, alpha: 0.70 })
        g.rect(px,     py+S-1, S, 1).fill({ color: SNOW.dk, alpha: 0.55 })
        g.rect(px+S-1, py,     1, S).fill({ color: SNOW.dk, alpha: 0.50 })
        // 雪影 + 閃光（6 次 rng）
        for (let d = 0; d < 2; d++) {
          const dx = 2 + Math.floor(rng() * (S-6))
          const dy = 2 + Math.floor(rng() * (S-6))
          g.rect(px+dx, py+dy, 6, 2).fill({ color: SNOW.dk, alpha: 0.18 })
        }
        const spX = 2 + Math.floor(rng() * (S-4))
        const spY = 2 + Math.floor(rng() * (S-4))
        g.rect(px+spX, py+spY, 2, 2).fill({ color: SNOW.lt, alpha: 0.92 })
        break
      }
    }
  }

  // ── 水面動畫（每格獨立相位，波峰附近才畫，避免全面條紋） ──────
  private _drawWaterAnim(t: number): void {
    const wg  = this.waterWaveG
    const S   = TILE_SIZE
    const lim = Math.min(this._waterPositions.length, 800)
    wg.clear()

    for (let i = 0; i < lim; i++) {
      const { x, y } = this._waterPositions[i]
      const px = x - S / 2
      const py = y - S / 2

      // 每格獨立 tilePhase（依格座標雜湊，相鄰格相位不同）
      const tx = Math.round(px / S)
      const ty = Math.round(py / S)
      const tilePhase = ((tx * 17 + ty * 13) & 0xFFFF) / 0xFFFF * Math.PI * 2

      // 動畫相位：全局時間 + 格子偏移
      const anim = t * 0.65 + tilePhase
      const s1   = Math.sin(anim)
      const s2   = Math.sin(anim + Math.PI * 0.65)

      // ── 主波紋：只在波峰附近（s1 > 0.35，約 38% 的格子可見） ──
      if (s1 > 0.35) {
        const alpha  = (s1 - 0.35) / 0.65 * 0.72
        // 波紋寬度與 X 位置依格子各有不同
        const dashW  = Math.round(S * (0.38 + Math.abs(Math.sin(tilePhase * 1.7)) * 0.22))
        const dashX  = Math.round((S - dashW) * (0.20 + Math.sin(tilePhase * 0.9 + 0.5) * 0.25 + 0.25))
        const dashY  = Math.round(S * (0.30 + Math.sin(tilePhase * 2.1) * 0.13))
        wg.rect(px + dashX, py + dashY, dashW, 2)
          .fill({ color: 0x8CCEF4, alpha })
        if (s1 > 0.65) {
          wg.rect(px + dashX + 2, py + dashY - 1, dashW - 4, 1)
            .fill({ color: 0xCCEEFF, alpha: (s1 - 0.65) / 0.35 * 0.50 })
        }
      }

      // ── 副波紋：不同相位，更短小 ─────────────────────────────
      if (s2 > 0.55) {
        const alpha2 = (s2 - 0.55) / 0.45 * 0.45
        const dash2W = Math.round(S * (0.22 + Math.abs(Math.sin(tilePhase * 2.3)) * 0.18))
        const dash2X = Math.round((S - dash2W) * (0.30 + Math.sin(tilePhase * 1.3 + 1.0) * 0.25 + 0.25))
        const dash2Y = Math.round(S * (0.60 + Math.sin(tilePhase * 1.8 + 0.8) * 0.12))
        wg.rect(px + dash2X, py + dash2Y, dash2W, 1)
          .fill({ color: 0x70BCEE, alpha: alpha2 })
      }
    }
  }

  getTileAt(worldX: number, worldY: number, worldData: WorldData): TileType | null {
    const tx = Math.floor(worldX / TILE_SIZE)
    const ty = Math.floor(worldY / TILE_SIZE)
    const cx = Math.floor(tx / CHUNK_SIZE)
    const cy = Math.floor(ty / CHUNK_SIZE)
    const chunk = worldData.chunks.find(c => c.cx === cx && c.cy === cy)
    if (!chunk) return null
    const localX = tx % CHUNK_SIZE
    const localY = ty % CHUNK_SIZE
    return chunk.tiles[localY]?.[localX] ?? null
  }
}
