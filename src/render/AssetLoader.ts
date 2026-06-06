/**
 * AssetLoader — 載入 Farm RPG + Anokolisa sprites
 * 任何資源載入失敗時靜默降級為 PIXI.Graphics
 *
 * ── Farm RPG ──────────────────────────────────────────────────
 * maple-tree.png (160×48) 分 5 格，每格 32×48：
 *   frame 0 (x:0)   → 石頭
 *   frame 3 (x:96)  → 大楓樹
 *   frame 4 (x:128) → 樹樁
 *
 * ── Anokolisa (16×16 pixel art) ───────────────────────────────
 * floors-tiles.png (400×416)：
 *   草地 (16,160)  沙地 (96,0)  岩地 (256,0)  雪地 (0,352)
 * water-tiles.png (400×400)：
 *   水面 (0,192)
 */
import * as PIXI from 'pixi.js'
import type { TileType } from '@/types'
import { loadEntitySpriteManifestCollection, preloadEntitySpriteManifestAssets } from './EntitySpriteDriver'
import { loadItemSpriteRegistry } from './ItemSpriteRegistry'
import { loadTileSpriteRegistry } from './TileSpriteRegistry'

// ── 資源物件 sprite ──────────────────────────────────────────
export interface ResourceTextures {
  tree:       PIXI.Texture | null
  stump:      PIXI.Texture | null
  rock:       PIXI.Texture | null   // 棕色大岩（一般石頭）
  rock_grey:  PIXI.Texture | null   // 灰色大岩（鐵/金礦底圖）
}
export const RESOURCE_TEXTURES: ResourceTextures = {
  tree: null, stump: null, rock: null, rock_grey: null,
}

// ── 地板 tile sprite（16×16 原始，渲染時 ×3 = 48×48） ────────
export const TILE_TEXTURES: Partial<Record<TileType, PIXI.Texture>> = {}

/** 草地多種變體（row10 亮平 × 3 + row11 暗紋 × 3），渲染時隨機挑選 */
export const GRASS_TILE_VARIANTS: PIXI.Texture[] = []

/** 草地裝飾 sprite：白菊花、橙花 */
export const GRASS_DECO_TEXTURES: { white: PIXI.Texture | null; orange: PIXI.Texture | null } = {
  white: null, orange: null,
}

let _loaded = false
export function assetsLoaded(): boolean { return _loaded }

/** 強制 nearest-neighbor（像素畫放大必要） */
function setNearest(tex: PIXI.Texture): void {
  tex.source.scaleMode = 'nearest'
}

export async function loadGameAssets(): Promise<void> {
  let ok = 0
  try {
    await loadEntitySpriteManifestCollection('/assets/entities/entities.json')
    await loadEntitySpriteManifestCollection('/assets/blocks/blocks.json')
    await preloadEntitySpriteManifestAssets()
    ok++
  } catch (e) {
    console.warn('[AssetLoader] Sprite manifests unavailable:', e)
  }

  try {
    await loadTileSpriteRegistry('/assets/tiles/Tiles.json')
    ok++
  } catch (e) {
    console.warn('[AssetLoader] Tile registry unavailable:', e)
  }

  try {
    await loadItemSpriteRegistry('/assets/main_resources/items_json/items.json')
    ok++
  } catch (e) {
    console.warn('[AssetLoader] Item sprites unavailable:', e)
  }

  // ── 1. Farm RPG 物件 sprites (tree/stump) ────────────────
  try {
    const treeTex = await PIXI.Assets.load('/assets/farm-rpg/maple-tree.png') as PIXI.Texture
    setNearest(treeTex)

    RESOURCE_TEXTURES.tree = new PIXI.Texture({
      source: treeTex.source,
      frame:  new PIXI.Rectangle(96, 0, 32, 48),
    })
    RESOURCE_TEXTURES.stump = new PIXI.Texture({
      source: treeTex.source,
      frame:  new PIXI.Rectangle(128, 0, 32, 48),
    })
    ok++
    console.log('[AssetLoader] Farm RPG tree sprites ✓')
  } catch (e) {
    console.warn('[AssetLoader] Farm RPG sprites unavailable:', e)
  }

  // ── 1b. Anokolisa Rocks sprites ───────────────────────────
  // rocks.png (208×304)：棕色大岩 (0,16,32,48)、灰色大岩 (96,16,32,48)
  try {
    const rockTex = await PIXI.Assets.load('/assets/anokolisa/rocks.png') as PIXI.Texture
    setNearest(rockTex)
    const r = (x: number, y: number, w: number, h: number) =>
      new PIXI.Texture({ source: rockTex.source, frame: new PIXI.Rectangle(x, y, w, h) })

    RESOURCE_TEXTURES.rock      = r(0,  16, 32, 48)  // 棕色大岩
    RESOURCE_TEXTURES.rock_grey = r(96, 16, 32, 48)  // 灰色大岩（鐵/金礦）
    ok++
    console.log('[AssetLoader] Anokolisa rock sprites ✓')
  } catch (e) {
    console.warn('[AssetLoader] Anokolisa rock sprites unavailable:', e)
  }

  // ── 2. Anokolisa 地板 tile textures ──────────────────────
  try {
    const floorTex = await PIXI.Assets.load('/assets/anokolisa/floors-tiles.png') as PIXI.Texture
    setNearest(floorTex)
    const waterTex = await PIXI.Assets.load('/assets/anokolisa/water-tiles.png') as PIXI.Texture
    setNearest(waterTex)

    const f = (tx: PIXI.Texture, x: number, y: number) =>
      new PIXI.Texture({ source: tx.source, frame: new PIXI.Rectangle(x, y, 16, 16) })

    // row 10（亮平草地）× 3
    TILE_TEXTURES['grass'] = f(floorTex, 16, 160)    // RGB(50,119,3) 草綠（預設/辨識用）
    GRASS_TILE_VARIANTS.push(
      f(floorTex, 16, 160),   // row10 col1
      f(floorTex, 32, 160),   // row10 col2
      f(floorTex, 48, 160),   // row10 col3
      f(floorTex, 16, 176),   // row11 col1 — 深色斜紋草
      f(floorTex, 32, 176),   // row11 col2
      f(floorTex, 48, 176),   // row11 col3
    )
    TILE_TEXTURES['sand']  = f(floorTex, 96,  0  )   // RGB(144,124,99) 棕沙
    TILE_TEXTURES['stone'] = f(floorTex, 256, 0  )   // RGB(116,107,97) 灰岩
    TILE_TEXTURES['snow']  = f(floorTex, 0,   352)   // RGB(220,226,238) 雪白
    TILE_TEXTURES['water'] = f(waterTex, 0,   192)   // RGB(67,151,209) 水藍

    ok++
    console.log('[AssetLoader] Anokolisa tile textures ✓')
  } catch (e) {
    console.warn('[AssetLoader] Anokolisa tiles unavailable:', e)
  }

  // ── 3. Anokolisa Vegetation（草地裝飾花朵） ─────────────────
  try {
    const vegTex = await PIXI.Assets.load('/assets/anokolisa/vegetation.png') as PIXI.Texture
    setNearest(vegTex)
    const v = (x: number, y: number) =>
      new PIXI.Texture({ source: vegTex.source, frame: new PIXI.Rectangle(x, y, 16, 16) })

    GRASS_DECO_TEXTURES.white  = v(48, 384)  // 白色菊花（帶藍紋）
    GRASS_DECO_TEXTURES.orange = v(48, 368)  // 橙色花
    ok++
    console.log('[AssetLoader] Vegetation deco textures ✓')
  } catch (e) {
    console.warn('[AssetLoader] Vegetation textures unavailable:', e)
  }

  if (ok > 0) _loaded = true
}
