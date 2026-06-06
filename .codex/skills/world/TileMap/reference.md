---
name: tile-map
description: Look up here to rebuild PixiJS tile rendering, three rendering tiers (JSON sprites / Anokolisa sprites / PIXI.Graphics fallback), water wave animation, and world-to-tile coordinate conversion.
---

# world/TileMap.ts

> 模組：world｜角色：PixiJS tile renderer — converts `WorldData.chunks` into displayable containers; manages water wave animation via Ticker; provides coordinate lookup.

## 公開 API

- `new TileMap()` — constructor; attaches water animation Ticker immediately
- `tileMap.render(worldData: WorldData): void` — full world re-render; clears and redraws all chunks
- `tileMap.getTileAt(worldX, worldY, worldData): TileType | null` — pixel → tile lookup
- `tileMap.getWaterPositions(): { x: number; y: number }[]` — returns all water tile centers (world pixels)
- `tileMap.displayObject: PIXI.Container` — add this to the stage
- `tileMap.destroy(): void` — removes Ticker listener; call on scene teardown

## 核心邏輯

### Constants and Palette

```typescript
const TILE_SIZE  = 48
const CHUNK_SIZE = 16

const GRASS   = { base: 0x5CC840, lt: 0x82E060, dk: 0x389820 }
const WATER   = { base: 0x4AAAE8, lt: 0x7CCEF8, dk: 0x2A78C8 }
const SAND    = { base: 0xC87A30, lt: 0xE8A850, dk: 0x9A5A18 }
const STONE_T = { base: 0x788898, lt: 0xA0B4C8, dk: 0x485868 }
const SNOW    = { base: 0xD0E0F0, lt: 0xF0F8FF, dk: 0x98AEBE }
```

### Rendering Tier Selection

`renderChunk` picks tier in priority order:

1. **JSON sprite tier** — `hasAnyTileSprite()` returns true → `_renderChunkJsonSprites`
2. **Anokolisa sprite tier** — `TILE_TEXTURES['grass']` is truthy → `_renderChunkSprites`
3. **PIXI.Graphics fallback** — `drawTile` switch statement

```typescript
private renderChunk(chunk: Chunk): void {
  if (hasAnyTileSprite()) { this._renderChunkJsonSprites(chunk); return }
  if (TILE_TEXTURES['grass']) { this._renderChunkSprites(chunk); return }
  // Graphics fallback
  const g = new PIXI.Graphics()
  const rng = seededRandom(((chunk.seed ^ (chunk.cx * 1000003)) ^ (chunk.cy * 999983)) >>> 0)
  for (let ty = 0; ty < CHUNK_SIZE; ty++)
    for (let tx = 0; tx < CHUNK_SIZE; tx++) {
      const px = (chunk.cx * CHUNK_SIZE + tx) * TILE_SIZE
      const py = (chunk.cy * CHUNK_SIZE + ty) * TILE_SIZE
      this.drawTile(g, chunk.tiles[ty][tx], px, py, rng)
    }
  this.container.addChild(g)
  this.chunkGraphics.set(`${chunk.cx}_${chunk.cy}`, g)
}
```

### Chunk-level RNG seed

All three rendering tiers use the same per-chunk RNG seed formula:
```typescript
seededRandom(((chunk.seed ^ (chunk.cx * 1000003)) ^ (chunk.cy * 999983)) >>> 0)
```

### JSON Sprite Tier (_renderChunkJsonSprites)

Calls `createTileSpriteSync(tileType, TILE_SIZE, variantSeed)` per tile. Falls back to `drawTile` if sprite returns null.

```typescript
// variantSeed for tile sprite variant selection:
const variantSeed = (chunk.seed ^ Math.imul(worldTx, 374761393) ^ Math.imul(worldTy, 668265263)) >>> 0
```

### Sprite Tier — RNG consumption contract

Every tile in `_renderChunkSprites` consumes exactly 3 RNG calls to keep subsequent tiles aligned:

| Tile type | call 1 | call 2 | call 3 |
|-----------|--------|--------|--------|
| water     | `rng()` (forced consume) | decoRoll | posRoll |
| grass     | `Math.floor(rng() * GRASS_TILE_VARIANTS.length)` | decoRoll | posRoll |
| other     | `rng()` (forced consume) | decoRoll | posRoll |

Grass decoration thresholds: `decoRoll < 0.032` → white flower sprite; `< 0.056` → orange flower sprite; `< 0.30` → PIXI.Graphics grass blade strokes.

### drawTile — Graphics fallback RNG consumption

Each tile type consumes a fixed number of `rng()` calls to keep tiles aligned:

| Tile | rng calls | Notes |
|------|-----------|-------|
| water | 4 | 2× double `rng(); rng()` |
| sand  | 10 | 5 grains × 2 per grain |
| grass | 3 | roll + fx + fy |
| stone | 4 | crX, crY, crL, crA |
| snow  | 6 | 2 shadows × 2 + spX + spY |

```typescript
case 'water': {
  g.rect(px, py, S, S).fill(WATER.base)
  g.rect(px+3, py+3, S-6, S-6).fill({ color: WATER.lt, alpha: 0.10 })
  for (let d = 0; d < 2; d++) { rng(); rng() }
  break
}
case 'grass': {
  // base + bevel
  const roll = rng()
  const fx = 6 + Math.floor(rng() * (S - 12))
  const fy = 6 + Math.floor(rng() * (S - 12))
  if (roll < 0.032) { /* white flower: circle center + 4 petals */ }
  else if (roll < 0.056) { /* dark roundRect leaf pair */ }
  break
}
```

### Water Wave Animation

Runs on `PIXI.Ticker.shared` every frame. Capped at 800 water tiles to control draw cost.

```typescript
private _drawWaterAnim(t: number): void {
  const lim = Math.min(this._waterPositions.length, 800)
  for (let i = 0; i < lim; i++) {
    const tilePhase = ((tx * 17 + ty * 13) & 0xFFFF) / 0xFFFF * Math.PI * 2
    const anim = t * 0.65 + tilePhase   // t = performance.now() / 1000
    const s1 = Math.sin(anim)
    const s2 = Math.sin(anim + Math.PI * 0.65)
    // primary wave: only when s1 > 0.35 (~38% of tiles visible at once)
    if (s1 > 0.35) {
      const alpha = (s1 - 0.35) / 0.65 * 0.72
      // dashW, dashX, dashY all vary by tilePhase for non-uniform look
      wg.rect(px + dashX, py + dashY, dashW, 2).fill({ color: 0x8CCEF4, alpha })
      if (s1 > 0.65)  // bright highlight on peak
        wg.rect(px + dashX + 2, py + dashY - 1, dashW - 4, 1)
          .fill({ color: 0xCCEEFF, alpha: (s1 - 0.65) / 0.35 * 0.50 })
    }
    // secondary wave: s2 > 0.55, shorter, different phase offset (Math.PI * 0.65)
    if (s2 > 0.55) { /* similar pattern, dash2W/dash2X/dash2Y by tilePhase */ }
  }
}
```

### Coordinate Conversion (getTileAt)

```typescript
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
```

## EventBus 互動

TileMap.ts does not directly emit or listen to EventBus events. The world module consumer (`main.ts` / GameController) should call `tileMap.render(worldData)` after receiving `resource:depleted` if tile visuals need refreshing.

## 依賴

- `pixi.js` — `PIXI.Container`, `PIXI.Graphics`, `PIXI.Sprite`, `PIXI.Ticker`
- `@/types` — `WorldData`, `TileType`, `Chunk`
- `@/render/AssetLoader` — `TILE_TEXTURES`, `GRASS_TILE_VARIANTS`, `GRASS_DECO_TEXTURES`
- `@/render` — `createTileSpriteSync(tileType, size, variantSeed)`, `hasAnyTileSprite()`

## 重建提示

- `render()` clears `container.removeChildren()` and rebuilds all chunks from scratch — it is not incremental.
- `waterWaveG` is re-added to the container on every `render()` call so it sits above chunk layers.
- `destroy()` must be called when the scene tears down — the Ticker holds a reference that will leak across scene reloads.
- `chunkGraphics` map stores `null` (cast to Graphics) as a sentinel for sprite-based chunks; do not rely on its values being real Graphics objects.
- Pixel to tile: `Math.floor(worldX / 48)`. Tile to pixel top-left: `tileX * 48`. Tile center: `tileX * 48 + 24`.
- Tile row/column in chunk: `localX = tileX % 16`, `localY = tileY % 16`. Array is indexed `tiles[localY][localX]` (row first).
- Sprite tier scales Anokolisa 16×16 textures by `scale.set(3)` to reach 48×48 px.
- The LCG `seededRandom` here is identical to WorldGen.ts — if one changes, the other must too (same constants `1664525`, `1013904223`).
- Water animation cap of 800 tiles: large open-water maps with >800 water tiles visible will silently drop the remaining tiles from animation.
- `_waterPositions` is repopulated during every `render()` call; after a partial re-render (e.g. single chunk update), it will be stale unless `render()` is called in full.
