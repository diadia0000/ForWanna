import * as PIXI from 'pixi.js'

export interface ItemSpriteManifest {
  id: string
  texture: string
  width: number
  height: number
  scale?: number
  frame?: { x: number; y: number; width: number; height: number }
}

type ItemSpriteCollection = Record<string, string | null>
type LoadedItemSpriteManifest = ItemSpriteManifest & { dataUrl?: string }

const itemSprites = new Map<string, LoadedItemSpriteManifest>()
const itemTextureCache = new Map<string, PIXI.Texture>()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function loadItemSpriteRegistry(path: string): Promise<void> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load item sprite registry: ${path}`)
  const collection = await res.json() as ItemSpriteCollection
  for (const [itemId, manifestPath] of Object.entries(collection)) {
    if (!manifestPath) continue
    const manifestRes = await fetch(manifestPath)
    if (!manifestRes.ok) continue
    const manifest = await manifestRes.json() as LoadedItemSpriteManifest
    if (manifest.frame) manifest.dataUrl = await cropFrameToDataUrl(manifest)
    itemSprites.set(itemId, manifest)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load item image: ${src}`))
    img.src = src
  })
}

async function cropFrameToDataUrl(manifest: ItemSpriteManifest): Promise<string | undefined> {
  const frame = manifest.frame
  if (!frame) return undefined
  const img = await loadImage(manifest.texture)
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
  return canvas.toDataURL('image/png')
}

export function hasItemSprite(itemId: string): boolean {
  return itemSprites.has(itemId)
}

export async function getItemPixiTexture(itemId: string): Promise<PIXI.Texture | null> {
  const manifest = itemSprites.get(itemId)
  if (!manifest) return null
  if (itemTextureCache.has(itemId)) return itemTextureCache.get(itemId) ?? null

  const base = await PIXI.Assets.load(manifest.texture) as PIXI.Texture
  base.source.scaleMode = 'nearest'
  const frame = manifest.frame
  const texture = frame
    ? new PIXI.Texture({
        source: base.source,
        frame: new PIXI.Rectangle(frame.x, frame.y, frame.width, frame.height),
      })
    : base
  itemTextureCache.set(itemId, texture)
  return texture
}

export function getItemIconMarkup(itemId: string, fallbackIcon: string): string {
  const manifest = itemSprites.get(itemId)
  if (!manifest) return escapeHtml(fallbackIcon)

  const frame = manifest.frame
  const scale = manifest.scale ?? 1
  const w = frame?.width ?? manifest.width
  const h = frame?.height ?? manifest.height
  const displayW = Math.max(1, Math.round(w * scale))
  const displayH = Math.max(1, Math.round(h * scale))
  const label = escapeHtml(manifest.id)

  const src = manifest.dataUrl ?? manifest.texture
  return `<img class="item-icon-img" src="${escapeHtml(src)}" alt="${label}" style="width:${displayW}px;height:${displayH}px;image-rendering:pixelated;" />`
}
