import * as PIXI from 'pixi.js'
import type { BuildingDef, PlayerId } from '@/types'
import type { BuildingSystem } from './BuildingSystem'
import { t } from '@/core/i18n'
import { EventBus } from '@/core/EventBus'

const TILE_SIZE = 48

export class BuildingPlacer {
  private placingDefId: string | null = null
  private ghost: PIXI.Container
  private myPlayerId: PlayerId = ''
  private onPlaceCb: ((defId: string, x: number, y: number) => void) | null = null
  /** 目前 ghost label（語言切換時重設文字） */
  private ghostLabel: PIXI.Text | null = null
  /** 目前預覽中的 BuildingDef（語言切換時重用） */
  private currentDef: BuildingDef | null = null

  constructor(
    private app: PIXI.Application,
    private camera: PIXI.Container,
    buildingLayer: PIXI.Container,
    private buildingSystem: BuildingSystem,
  ) {
    this.ghost = new PIXI.Container()
    this.ghost.visible = false
    this.ghost.alpha = 0.65
    buildingLayer.addChild(this.ghost)
    this.setupPointerEvents()

    // 語言切換時更新 ghost 標籤文字
    EventBus.on('i18n:changed', () => {
      if (this.ghostLabel && this.placingDefId && this.currentDef) {
        this.ghostLabel.text = t(
          `building.${this.placingDefId}.name`,
          undefined,
          this.currentDef.name,
        )
      }
    })
  }

  setPlayerId(id: PlayerId): void {
    this.myPlayerId = id
  }

  setOnPlace(cb: (defId: string, x: number, y: number) => void): void {
    this.onPlaceCb = cb
  }

  start(defId: string, def: BuildingDef): void {
    this.placingDefId = defId
    this.currentDef = def
    this.ghost.removeChildren()
    const g = new PIXI.Graphics()
    const w = def.size.x * TILE_SIZE
    const h = def.size.y * TILE_SIZE
    g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.55 })
    g.rect(0, 0, w, h).stroke({ color: 0xffffff, width: 2 })
    const label = new PIXI.Text({
      text: t(`building.${defId}.name`, undefined, def.name),
      style: { fontSize: 9, fill: 0xffffff },
    })
    label.x = 3
    label.y = 2
    this.ghostLabel = label
    this.ghost.addChild(g, label)
    this.ghost.visible = true
    document.body.style.cursor = 'crosshair'
  }

  cancel(): void {
    this.placingDefId = null
    this.currentDef = null
    this.ghostLabel = null
    this.ghost.visible = false
    document.body.style.cursor = ''
  }

  isPlacing(): boolean {
    return this.placingDefId !== null
  }

  private screenToWorld(clientX: number, clientY: number) {
    const rect = this.app.canvas.getBoundingClientRect()
    const sx = (clientX - rect.left) / rect.width  * this.app.screen.width
    const sy = (clientY - rect.top)  / rect.height * this.app.screen.height
    return { x: sx - this.camera.x, y: sy - this.camera.y }
  }

  private setupPointerEvents(): void {
    this.app.canvas.addEventListener('pointermove', (e) => {
      if (!this.placingDefId) return
      const { x, y } = this.screenToWorld(e.clientX, e.clientY)
      const sx = Math.floor(x / TILE_SIZE) * TILE_SIZE
      const sy = Math.floor(y / TILE_SIZE) * TILE_SIZE
      this.ghost.x = sx
      this.ghost.y = sy
      const ok = this.myPlayerId
        ? this.buildingSystem.canPlace(this.placingDefId, sx, sy, this.myPlayerId)
        : false
      this.ghost.tint = ok ? 0x88ff88 : 0xff6666
    })

    this.app.canvas.addEventListener('pointerdown', (e) => {
      if (!this.placingDefId || !this.myPlayerId || e.button !== 0) return
      const { x, y } = this.screenToWorld(e.clientX, e.clientY)
      const sx = Math.floor(x / TILE_SIZE) * TILE_SIZE
      const sy = Math.floor(y / TILE_SIZE) * TILE_SIZE
      if (!this.buildingSystem.canPlace(this.placingDefId, sx, sy, this.myPlayerId)) return
      this.onPlaceCb?.(this.placingDefId, sx, sy)
      this.cancel()
    })
  }
}
