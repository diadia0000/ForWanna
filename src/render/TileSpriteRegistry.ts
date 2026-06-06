import * as PIXI from 'pixi.js'
import type { TileType } from '@/types'

export interface TileSpriteDef {
  id: number
  name: string
  texture_path: string
  width: number
  height: number
  uv: { x: number; y: number }
  walkable: boolean
}

const tileDefs = new Map<string, TileSpriteDef[]>()
const textureCache = new Map<string, PIXI.Texture>()
const frameCache = new Map<string, PIXI.Texture>()

export async function loadTileSpriteRegistry(path: string): Promise<void> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load tile registry: ${path}`)
  const defs = await res.json() as TileSpriteDef[]
  tileDefs.clear()
  for (const def of defs) {
    const variants = tileDefs.get(def.name) ?? []
    variants.push(def)
    tileDefs.set(def.name, variants)
    const key = `${def.texture_path}:${def.uv.x}:${def.uv.y}:${def.width}:${def.height}`
    if (frameCache.has(key)) continue
    const base = await getTexture(def.texture_path)
    const frame = new PIXI.Texture({
      source: base.source,
      frame: new PIXI.Rectangle(def.uv.x, def.uv.y, def.width, def.height),
    })
    frameCache.set(key, frame)
  }
}

export function hasAnyTileSprite(): boolean {
  return tileDefs.size > 0
}

export function hasTileSprite(type: TileType): boolean {
  return tileDefs.has(type)
}

async function getTexture(path: string): Promise<PIXI.Texture> {
  if (textureCache.has(path)) return textureCache.get(path)!
  const tex = await PIXI.Assets.load(path) as PIXI.Texture
  tex.source.scaleMode = 'nearest'
  textureCache.set(path, tex)
  return tex
}

export async function createTileSprite(type: TileType, targetSize = 48, variantSeed = 0): Promise<PIXI.Sprite | null> {
  return _createTileSprite(type, targetSize, variantSeed)
}

function _createTileSprite(type: TileType, targetSize = 48, variantSeed = 0): PIXI.Sprite | null {
  const defs = tileDefs.get(type)
  if (!defs || defs.length === 0) return null
  const idx = Math.abs(Math.floor(variantSeed)) % defs.length
  const def = defs[idx]
  if (!def) return null
  const key = `${def.texture_path}:${def.uv.x}:${def.uv.y}:${def.width}:${def.height}`
  let frame = frameCache.get(key)
  if (!frame) return null
  const sprite = new PIXI.Sprite(frame)
  sprite.roundPixels = true
  const overlap = 0.5
  sprite.scale.set((targetSize + overlap) / def.width, (targetSize + overlap) / def.height)
  return sprite
}

export function createTileSpriteSync(type: TileType, targetSize = 48, variantSeed = 0): PIXI.Sprite | null {
  return _createTileSprite(type, targetSize, variantSeed)
}
