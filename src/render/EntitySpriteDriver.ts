import * as PIXI from 'pixi.js'

export type EntityDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
export type EntityAnimationState = 'IDLE' | 'MOVE' | 'HIT' | 'ATTACK'

export interface EntitySpriteFrame {
  x: number
  y: number
  width?: number
  height?: number
  duration?: number
  texture?: string
}

export interface EntitySpriteManifest {
  id: string
  texture: string
  width: number
  height: number
  scale?: number
  anchor?: { x: number; y: number }
  offset?: { x: number; y: number }
  ui?: { hpBarY?: number }
  animations: Partial<Record<EntityAnimationState, Partial<Record<EntityDirection, EntitySpriteFrame[]>>>>
}

export type EntitySpriteManifestCollection = Record<string, string | null>

const manifestPathById = new Map<string, string>()
const manifestCache = new Map<string, EntitySpriteManifest>()
const textureCache = new Map<string, PIXI.Texture>()
const frameCache = new Map<string, PIXI.Texture>()

export async function loadEntitySpriteManifestCollection(path: string): Promise<void> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load sprite manifest collection: ${path}`)
  const data = await res.json() as EntitySpriteManifestCollection
  for (const [id, manifestPath] of Object.entries(data)) {
    if (manifestPath) manifestPathById.set(id, manifestPath)
  }
}

export async function getEntitySpriteManifest(id: string): Promise<EntitySpriteManifest | null> {
  if (manifestCache.has(id)) return manifestCache.get(id) ?? null
  const path = manifestPathById.get(id)
  if (!path) return null
  const res = await fetch(path)
  if (!res.ok) return null
  const manifest = await res.json() as EntitySpriteManifest
  manifestCache.set(id, manifest)
  return manifest
}

export function hasEntitySpriteManifest(id: string): boolean {
  return manifestCache.has(id) || manifestPathById.has(id)
}

async function getSheetTexture(path: string): Promise<PIXI.Texture> {
  if (textureCache.has(path)) return textureCache.get(path)!
  const tex = await PIXI.Assets.load(path) as PIXI.Texture
  tex.source.scaleMode = 'nearest'
  textureCache.set(path, tex)
  return tex
}

async function getFrameTexture(
  texturePath: string,
  frame: EntitySpriteFrame,
  width: number,
  height: number,
): Promise<PIXI.Texture> {
  const frameWidth = frame.width ?? width
  const frameHeight = frame.height ?? height
  const key = `${texturePath}:${frame.x}:${frame.y}:${frameWidth}:${frameHeight}`
  if (frameCache.has(key)) return frameCache.get(key)!
  const base = await getSheetTexture(texturePath)
  const tex = new PIXI.Texture({
    source: base.source,
    frame: new PIXI.Rectangle(frame.x, frame.y, frameWidth, frameHeight),
  })
  frameCache.set(key, tex)
  return tex
}

function getFrameTextureSync(
  texturePath: string,
  frame: EntitySpriteFrame,
  width: number,
  height: number,
): PIXI.Texture | null {
  const frameWidth = frame.width ?? width
  const frameHeight = frame.height ?? height
  const key = `${texturePath}:${frame.x}:${frame.y}:${frameWidth}:${frameHeight}`
  return frameCache.get(key) ?? null
}

export async function preloadEntitySpriteManifestAssets(ids?: string[]): Promise<void> {
  const targetIds = ids ?? Array.from(manifestPathById.keys())
  for (const id of targetIds) {
    const manifest = await getEntitySpriteManifest(id)
    if (!manifest) continue
    for (const stateFrames of Object.values(manifest.animations)) {
      if (!stateFrames) continue
      for (const directionFrames of Object.values(stateFrames)) {
        if (!directionFrames) continue
        for (const frame of directionFrames) {
          const texturePath = frame.texture ?? manifest.texture
          await getFrameTexture(texturePath, frame, manifest.width, manifest.height)
        }
      }
    }
  }
}

export class EntitySpriteDriver {
  readonly manifest: EntitySpriteManifest
  readonly sprite: PIXI.Sprite

  private state: EntityAnimationState = 'IDLE'
  private direction: EntityDirection = 'DOWN'
  private frameIndex = 0
  private frameTick = 0

  private constructor(manifest: EntitySpriteManifest) {
    this.manifest = manifest
    this.sprite = new PIXI.Sprite()
    this.sprite.anchor.set(manifest.anchor?.x ?? 0.5, manifest.anchor?.y ?? 1)
    this.sprite.scale.set(manifest.scale ?? 1)
    this.sprite.x = manifest.offset?.x ?? 0
    this.sprite.y = manifest.offset?.y ?? 0
  }

  static async create(id: string): Promise<EntitySpriteDriver | null> {
    const manifest = await getEntitySpriteManifest(id)
    if (!manifest) return null
    const driver = new EntitySpriteDriver(manifest)
    await driver.init()
    return driver
  }

  static createSync(id: string): EntitySpriteDriver | null {
    const manifest = manifestCache.get(id)
    if (!manifest) return null
    const driver = new EntitySpriteDriver(manifest)
    if (!driver.initSync()) return null
    return driver
  }

  async init(state: EntityAnimationState = 'IDLE', direction: EntityDirection = 'DOWN'): Promise<void> {
    this.state = state
    this.direction = direction
    this.frameIndex = 0
    this.frameTick = 0
    await this.applyCurrentFrame()
  }

  initSync(state: EntityAnimationState = 'IDLE', direction: EntityDirection = 'DOWN'): boolean {
    this.state = state
    this.direction = direction
    this.frameIndex = 0
    this.frameTick = 0
    return this.applyCurrentFrameSync()
  }

  async play(state: EntityAnimationState, direction = this.direction, resetFrame = false): Promise<void> {
    if (this.state !== state || this.direction !== direction || resetFrame) {
      this.state = state
      this.direction = direction
      if (resetFrame) {
        this.frameIndex = 0
        this.frameTick = 0
      }
      await this.applyCurrentFrame()
    }
  }

  async setDirection(direction: EntityDirection): Promise<void> {
    if (this.direction === direction) return
    this.direction = direction
    await this.applyCurrentFrame()
  }

  update(delta: number): void {
    const frames = this.getFrames()
    if (frames.length <= 1) return
    const current = frames[this.frameIndex]
    const duration = current.duration ?? 8
    this.frameTick += delta
    if (this.frameTick < duration) return
    this.frameTick = 0
    this.frameIndex = (this.frameIndex + 1) % frames.length
    void this.applyCurrentFrame()
  }

  getHpBarY(defaultY: number): number {
    return this.manifest.ui?.hpBarY ?? defaultY
  }

  private getFrames(): EntitySpriteFrame[] {
    const stateFrames = this.manifest.animations[this.state]
      ?? (this.state === 'ATTACK' ? this.manifest.animations.HIT : undefined)
      ?? this.manifest.animations.IDLE
    const directional = stateFrames?.[this.direction]
      ?? stateFrames?.DOWN
      ?? this.manifest.animations.IDLE?.[this.direction]
      ?? this.manifest.animations.IDLE?.DOWN
      ?? []
    return directional
  }

  private async applyCurrentFrame(): Promise<void> {
    const frames = this.getFrames()
    if (frames.length === 0) return
    if (this.frameIndex >= frames.length) this.frameIndex = 0
    const frame = frames[this.frameIndex]
    const texturePath = frame.texture ?? this.manifest.texture
    this.sprite.texture = await getFrameTexture(texturePath, frame, this.manifest.width, this.manifest.height)
  }

  private applyCurrentFrameSync(): boolean {
    const frames = this.getFrames()
    if (frames.length === 0) return false
    if (this.frameIndex >= frames.length) this.frameIndex = 0
    const frame = frames[this.frameIndex]
    const texturePath = frame.texture ?? this.manifest.texture
    const texture = getFrameTextureSync(texturePath, frame, this.manifest.width, this.manifest.height)
    if (!texture) return false
    this.sprite.texture = texture
    return true
  }
}
