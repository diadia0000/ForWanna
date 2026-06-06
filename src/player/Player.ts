import { EventBus } from '@/core/EventBus'
import type { HeldItemKind } from '@/inventory'
import { EntitySpriteDriver, hasEntitySpriteManifest } from '@/render'
import type { PlayerData, PlayerInput } from '@/types'
import * as PIXI from 'pixi.js'

const SPEED = 3
const HEAD_R = 12
const SKIN_COLOR = 0xffcc80
const SHADOW_ALPHA = 0.22
const WALK_FRAMES = 4
const TICKS_PER_FRAME = 12

const LEG_OFFSETS: [number, number][] = [
  [0, 0],
  [-5, 5],
  [0, 0],
  [5, -5],
]

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type HeldToolKind = Extract<HeldItemKind, 'sword' | 'pickaxe' | 'axe'>

const HELD_TOOL_TEXTURES: Record<HeldToolKind, string> = {
  sword: '/assets/main_resources/player/playerTake/sword.png',
  pickaxe: '/assets/main_resources/player/playerTake/pickaxe.png',
  axe: '/assets/main_resources/player/playerTake/axe.png',
}

const HELD_TOOL_KINDS = new Set<HeldItemKind>(['sword', 'pickaxe', 'axe'])
const HELD_TOOL_RADIUS = 16
const HELD_TOOL_SCALE = 1.875
const HELD_TOOL_SWING_MS = 130
const HELD_TOOL_SWING_RAD = Math.PI * 0.62

export class Player {
  readonly id: string
  sprite: PIXI.Container
  private body: PIXI.Container
  private leftLeg: PIXI.Graphics
  private rightLeg: PIXI.Graphics
  private nameLabel: PIXI.Text
  private data: PlayerData
  private walkFrame = 0
  private frameTicks = 0
  private isMoving = false
  private facingLeft = false
  private facingDir: Dir = 'DOWN'
  private driver: EntitySpriteDriver | null = null
  private spriteManifestId: string
  private heldItemLabel: PIXI.Text | null = null
  private heldToolSprite: PIXI.Sprite | null = null
  private heldToolKind: HeldToolKind | null = null
  private heldToolItemId: string | null = null
  private heldToolTextureToken = 0
  private heldToolAimAngle = 0
  private heldToolSwingStart = 0

  constructor(data: PlayerData) {
    this.id = data.id
    this.data = { ...data }
    this.spriteManifestId = (data as any).spriteId ?? 'player'

    this.sprite = new PIXI.Container()
    this.sprite.sortableChildren = true
    this.body = new PIXI.Container()
    this.body.zIndex = 0
    this.sprite.addChild(this.body)

    this.leftLeg = new PIXI.Graphics()
    this.rightLeg = new PIXI.Graphics()
    this.nameLabel = new PIXI.Text({
      text: data.name,
      style: { fontSize: 13, fill: 0xffffff, dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.9 } },
    })

    this.sprite.x = data.x
    this.sprite.y = data.y
    const syncDriver = EntitySpriteDriver.createSync(this.spriteManifestId)
    if (syncDriver) {
      this.driver = syncDriver
      this.sprite.addChild(syncDriver.sprite)
    } else {
      this._buildFallbackSprite(data.color)
      if (hasEntitySpriteManifest(this.spriteManifestId)) {
        void this._initManifestSprite()
      }
    }
    if (!this.nameLabel.parent) this._attachNameLabel()
  }

  private async _initManifestSprite(): Promise<void> {
    const driver = await EntitySpriteDriver.create(this.spriteManifestId)
    if (!driver) return
    this.driver = driver
    this.body.visible = false
    this.sprite.addChildAt(driver.sprite, 0)
    this._attachNameLabel()
  }

  private _buildFallbackSprite(color: number): void {
    const shadow = new PIXI.Graphics()
    shadow.ellipse(0, 20, 16, 7).fill({ color: 0x000000, alpha: SHADOW_ALPHA })
    this.body.addChild(shadow)

    this.leftLeg.rect(-8, 9, 7, 13).fill(darken(color, 0.3))
    this.rightLeg.rect(1, 9, 7, 13).fill(darken(color, 0.3))
    this.body.addChild(this.leftLeg, this.rightLeg)

    const torso = new PIXI.Graphics()
    torso.roundRect(-10, -10, 20, 20, 4).fill(color)
    torso.roundRect(-10, -10, 20, 20, 4).stroke({ color: darken(color, 0.25), width: 2 })
    this.body.addChild(torso)

    const armL = new PIXI.Graphics()
    armL.roundRect(-16, -6, 6, 13, 2).fill(darken(color, 0.15))
    const armR = new PIXI.Graphics()
    armR.roundRect(10, -6, 6, 13, 2).fill(darken(color, 0.15))
    this.body.addChild(armL, armR)

    const head = new PIXI.Graphics()
    head.circle(0, -(HEAD_R + 6), HEAD_R).fill(SKIN_COLOR)
    head.circle(0, -(HEAD_R + 6), HEAD_R).stroke({ color: darken(SKIN_COLOR, 0.2), width: 1.5 })
    head.circle(3.5, -(HEAD_R + 7), 2).fill(0x333333)
    head.circle(-1.5, -(HEAD_R + 7), 2).fill(0x333333)
    this.body.addChild(head)

    this._attachNameLabel()
  }

  get x(): number { return this.sprite.x }
  get y(): number { return this.sprite.y }
  get currentFacingDir(): Dir { return this.facingDir }

  /** 顯示手持物品圖示（null=隱藏）。圖示會跟隨面向方向移動 */
  setHeldItem(icon: string | null): void {
    if (!icon) {
      if (this.heldItemLabel) {
        this.heldItemLabel.visible = false
      }
      return
    }
    if (!this.heldItemLabel) {
      this.heldItemLabel = new PIXI.Text({
        text: icon,
        style: { fontSize: 16 },
      })
      this.heldItemLabel.anchor.set(0.5, 0.5)
      this.sprite.addChild(this.heldItemLabel)
    }
    this.heldItemLabel.text = icon
    this.heldItemLabel.visible = true
    // 根據面向方向決定手持位置
    switch (this.facingDir) {
      case 'LEFT':  this.heldItemLabel.x = -22; this.heldItemLabel.y = 0; break
      case 'UP':    this.heldItemLabel.x =  16; this.heldItemLabel.y = -18; break
      case 'DOWN':  this.heldItemLabel.x =  16; this.heldItemLabel.y = 0; break
      default:      this.heldItemLabel.x =  22; this.heldItemLabel.y = 0; break  // RIGHT
    }
  }

  setHeldToolKind(kind: HeldItemKind): void {
    this.setHeldToolItem(null, kind)
  }

  setHeldToolItem(itemId: string | null, kind: HeldItemKind): void {
    if (!HELD_TOOL_KINDS.has(kind)) {
      this.heldToolKind = null
      this.heldToolItemId = null
      if (this.heldToolSprite) this.heldToolSprite.visible = false
      if (this.heldItemLabel) this.heldItemLabel.visible = false
      return
    }

    const toolKind = kind as HeldToolKind
    if (this.heldToolKind === toolKind && this.heldToolItemId === itemId && this.heldToolSprite) {
      this.heldToolSprite.visible = true
      return
    }

    this.heldToolKind = toolKind
    this.heldToolItemId = itemId
    this.heldItemLabel?.destroy()
    this.heldItemLabel = null
    void this._loadHeldToolTexture(toolKind, itemId)
  }

  setHeldToolAim(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    this.heldToolAimAngle = Math.atan2(dy, dx)
    this._syncFacingFromAim(dx, dy)
  }

  swingHeldTool(): void {
    if (!this.heldToolKind) return
    this.heldToolSwingStart = performance.now()
    this._updateHeldToolPos()
  }

  applyInput(input: PlayerInput): void {
    if (input.type !== 'move') return
    this.sprite.x += input.dx * SPEED
    this.sprite.y += input.dy * SPEED
    this.data.x = this.sprite.x
    this.data.y = this.sprite.y
    this._updateFacing(input.dx, input.dy)
    if (input.dx !== 0 || input.dy !== 0) this.isMoving = true
    EventBus.emit('player:moved', { playerId: this.id, x: this.data.x, y: this.data.y })
  }

  setFacing(dx: number): void {
    if (dx !== 0) {
      this.facingLeft = dx < 0
      this.facingDir = dx < 0 ? 'LEFT' : 'RIGHT'
    }
    this.isMoving = true
  }

  syncFromServer(data: Partial<PlayerData>): void {
    const prevX = this.sprite.x
    const prevY = this.sprite.y
    if (data.x !== undefined) {
      this.sprite.x = data.x
      this.data.x = data.x
    }
    if (data.y !== undefined) {
      this.sprite.y = data.y
      this.data.y = data.y
    }
    this._updateFacing(this.sprite.x - prevX, this.sprite.y - prevY)
    if (data.x !== undefined || data.y !== undefined) this.isMoving = true
    if (data.hp !== undefined) this.data.hp = data.hp
    if (data.maxHp !== undefined) this.data.maxHp = data.maxHp
    if (data.xp !== undefined) this.data.xp = data.xp
    if (data.level !== undefined) this.data.level = data.level
    if (data.gold !== undefined) this.data.gold = data.gold
  }

  update(delta: number): void {
    if (this.driver) {
      void this.driver.play(this.isMoving ? 'MOVE' : 'IDLE', this.facingDir)
      this.driver.update(delta)
      this.isMoving = false
      this._updateHeldItemPos()
      this._updateHeldToolPos()
      return
    }

    this.body.scale.x = this.facingLeft ? -1 : 1
    if (this.isMoving) {
      this.frameTicks++
      if (this.frameTicks >= TICKS_PER_FRAME) {
        this.frameTicks = 0
        this.walkFrame = (this.walkFrame + 1) % WALK_FRAMES
      }
    } else {
      this.walkFrame = 0
      this.frameTicks = 0
    }
    const [lo, ro] = LEG_OFFSETS[this.walkFrame]
    this.leftLeg.y = lo
    this.rightLeg.y = ro
    this.isMoving = false
    this._updateHeldItemPos()
    this._updateHeldToolPos()
  }

  private async _loadHeldToolTexture(kind: HeldToolKind, itemId: string | null): Promise<void> {
    const token = ++this.heldToolTextureToken
    const tex = await PIXI.Assets.load(HELD_TOOL_TEXTURES[kind]) as PIXI.Texture
    if (token !== this.heldToolTextureToken || this.heldToolKind !== kind || this.heldToolItemId !== itemId) return
    tex.source.scaleMode = 'nearest'
    if (!this.heldToolSprite) {
      this.heldToolSprite = new PIXI.Sprite(tex)
      this.heldToolSprite.anchor.set(0.5, 0.88)
      this.heldToolSprite.scale.set(HELD_TOOL_SCALE)
      this.heldToolSprite.zIndex = 5
      this.sprite.addChild(this.heldToolSprite)
    } else {
      this.heldToolSprite.texture = tex
    }
    this.heldToolSprite.visible = true
    this._updateHeldToolPos()
  }

  private _updateHeldItemPos(): void {
    if (!this.heldItemLabel || !this.heldItemLabel.visible) return
    switch (this.facingDir) {
      case 'LEFT':  this.heldItemLabel.x = -22; this.heldItemLabel.y = 0; break
      case 'UP':    this.heldItemLabel.x =  16; this.heldItemLabel.y = -18; break
      case 'DOWN':  this.heldItemLabel.x =  16; this.heldItemLabel.y = 0; break
      default:      this.heldItemLabel.x =  22; this.heldItemLabel.y = 0; break
    }
  }

  private _updateHeldToolPos(): void {
    if (!this.heldToolSprite || !this.heldToolSprite.visible || !this.heldToolKind) return
    const now = performance.now()
    const elapsed = now - this.heldToolSwingStart
    const t = elapsed >= 0 && elapsed < HELD_TOOL_SWING_MS
      ? elapsed / HELD_TOOL_SWING_MS
      : 1
    const swing = t < 1
      ? (1 - Math.abs(t * 2 - 1)) * HELD_TOOL_SWING_RAD
      : 0
    const side = Math.cos(this.heldToolAimAngle) < 0 ? -1 : 1
    const angle = this.heldToolAimAngle + side * (-0.38 + swing)

    this.heldToolSprite.x = Math.cos(this.heldToolAimAngle) * HELD_TOOL_RADIUS
    this.heldToolSprite.y = Math.sin(this.heldToolAimAngle) * HELD_TOOL_RADIUS + 2
    this.heldToolSprite.rotation = angle + Math.PI / 2
    this.heldToolSprite.scale.x = Math.abs(this.heldToolSprite.scale.x) * side
    this.heldToolSprite.zIndex = Math.sin(this.heldToolAimAngle) < -0.35 ? -1 : 5
  }

  private _syncFacingFromAim(dx: number, dy: number): void {
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facingLeft = dx < 0
      this.facingDir = dx < 0 ? 'LEFT' : 'RIGHT'
    } else {
      this.facingDir = dy < 0 ? 'UP' : 'DOWN'
    }
  }

  getData(): PlayerData {
    return { ...this.data, x: this.sprite.x, y: this.sprite.y }
  }

  destroy(): void {
    this.sprite.destroy()
  }

  private _updateFacing(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facingLeft = dx < 0
      this.facingDir = dx < 0 ? 'LEFT' : 'RIGHT'
    } else {
      this.facingDir = dy < 0 ? 'UP' : 'DOWN'
    }
  }

  private _attachNameLabel(): void {
    this.nameLabel.anchor.set(0.5, 1)
    if (this.driver) {
      const topY = (this.driver.manifest.offset?.y ?? 0)
        - ((this.driver.manifest.height ?? 0) * (this.driver.manifest.scale ?? 1) * (this.driver.manifest.anchor?.y ?? 1))
      this.nameLabel.y = topY - 8
    } else {
      this.nameLabel.y = -(HEAD_R * 2 + 14)
    }
    if (this.nameLabel.parent !== this.sprite) this.sprite.addChild(this.nameLabel)
  }
}

function darken(color: number, amount: number): number {
  const r = Math.round(((color >> 16) & 0xff) * (1 - amount))
  const g = Math.round(((color >> 8) & 0xff) * (1 - amount))
  const b = Math.round((color & 0xff) * (1 - amount))
  return (r << 16) | (g << 8) | b
}
