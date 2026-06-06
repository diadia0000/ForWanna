---
name: world-gen
description: Look up here to rebuild deterministic procedural world generation, island biome/tile assignment, seeded RNG, resource spawning, and island unlock logic.
---

# world/WorldGen.ts

> 模組：world｜角色：Deterministic procedural world generator — seeds chunk tile data, biome assignment, island layout, and resource node placement.

## 公開 API

- `WorldGen.generate(seed, unlockedIslands?, difficulty?)` → `WorldData` — full world generation entry point; call once at game start or on island unlock
- `WorldGen.islandWorldCenter(ix, iy)` → `{ x: number; y: number }` — pixel-space center of any island grid cell
- `WorldGen.findNearbyLockedIsland(wx, wy, unlocked)` → `{ ix, iy, ring, cost } | null` — detect closest locked island within 72% of stride distance
- `WORLD_CONFIG` — exported const with all world dimension parameters
- `ISLAND_UNLOCK_COST` — exported `Record<number, number>` mapping ring → gold cost

## 核心邏輯

### Constants

```typescript
const CHUNK_SIZE = 16   // tiles per chunk edge
const TILE_SIZE  = 48   // pixels per tile

export const WORLD_CONFIG = {
  CHUNK_COUNT:    13,   // 13×13 chunks = 208×208 tiles
  CENTER_TILE:    104,  // 208/2
  ISLAND_STRIDE:  22,   // tile distance between island centers
  ISLAND_GRID_R:  4,    // island grid runs ix/iy from -4..+4
  ISLAND_RADIUS:  6.5,  // core land radius (tiles)
  ISLAND_SAND_R:  8.2,  // sand fringe radius (tiles)
  get CENTER_X()  { return this.CENTER_TILE * TILE_SIZE },  // 4992 px
  get CENTER_Y()  { return this.CENTER_TILE * TILE_SIZE },
}

export const ISLAND_UNLOCK_COST: Record<number, number> = {
  1: 50, 2: 200, 3: 500, 4: 1200,
}
```

### Seeded RNG (LCG)

Same LCG is duplicated in TileMap.ts — must stay byte-identical.

```typescript
function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}
```

### Value Noise

Used per-tile for biome edge softening. Smoothstep (quintic) interpolation.

```typescript
function valueNoise(x: number, y: number, seed: number): number {
  function hash(ix: number, iy: number): number {
    let h = (seed + ix * 374761393 + iy * 1103515245) | 0
    h = Math.imul(h ^ (h >>> 13), 1664525)
    return (h ^ (h >>> 16)) >>> 0
  }
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix,        fy = y - iy
  const ux = fx*fx*fx*(fx*(fx*6-15)+10)
  const uy = fy*fy*fy*(fy*(fy*6-15)+10)
  const a = hash(ix,   iy)   / 0xffffffff
  const b = hash(ix+1, iy)   / 0xffffffff
  const c = hash(ix,   iy+1) / 0xffffffff
  const d = hash(ix+1, iy+1) / 0xffffffff
  return a + (b-a)*ux + (c-a)*uy + (d-b-c+a)*ux*uy
}
```

Call site: `valueNoise(tx * 0.28, ty * 0.28, seed ^ (isl.ix * 997 + isl.iy * 991)) - 0.5`
The `- 0.5` centres noise around 0 for ± radius perturbation.

### Biome Assignment

```typescript
type Biome = 'lush' | 'stone' | 'desert' | 'snow'

function islandBiome(ix: number, iy: number, seed: number): Biome {
  if (ix === 0 && iy === 0) return 'lush'   // start island always lush
  const h = ((ix * 374761 + iy * 1103515 + seed) ^ 0xabcdef12) >>> 0
  const list: Biome[] = ['lush', 'lush', 'stone', 'desert', 'snow']
  return list[h % list.length]
}
```

### Tile Type from Distance + Noise

```typescript
function islandTileType(dist: number, noise: number, biome: Biome): TileType {
  const R  = WORLD_CONFIG.ISLAND_RADIUS + noise * 2.2   // noise is ±0.5
  const SR = WORLD_CONFIG.ISLAND_SAND_R + noise * 1.8
  if (dist < R) {
    if (biome === 'snow')   return dist < R * 0.65 ? 'snow'  : 'stone'
    if (biome === 'stone')  return dist < R * 0.55 ? 'stone' : 'grass'
    if (biome === 'desert') return 'sand'
    return 'grass'
  }
  if (dist < SR) return 'sand'
  return 'water'
}
```

### WorldGen.generate — chunk loop

Islands outside `unlockedIslands` set are skipped (tiles remain 'water'). Each chunk's tile array is `TileType[CHUNK_SIZE][CHUNK_SIZE]` indexed `tiles[ty][tx]`.

```typescript
static generate(seed, unlockedIslands?, difficulty?): WorldData {
  const unlocked = unlockedIslands ?? new Set(['0,0'])
  const rng = seededRandom(seed)
  // islands: ix/iy -4..4, ring = Chebyshev distance
  for (let ix = -4; ix <= 4; ix++) {
    for (let iy = -4; iy <= 4; iy++) {
      islands.push({ ix, iy, tx: CT + ix*STR, ty: CT + iy*STR,
        ring: Math.max(Math.abs(ix), Math.abs(iy)),
        biome: islandBiome(ix, iy, seed),
        unlocked: unlocked.has(`${ix},${iy}`) })
    }
  }
  // per chunk tile fill — first non-water island wins
  for (let cx = 0; cx < N; cx++) for (let cy = 0; cy < N; cy++) {
    const tiles = Array.from({length: CHUNK_SIZE}, (_, ly) =>
      Array.from({length: CHUNK_SIZE}, (_, lx) => {
        const tx = cx*CHUNK_SIZE + lx, ty = cy*CHUNK_SIZE + ly
        for (const isl of islands) {
          if (!isl.unlocked) continue
          const dist  = Math.hypot(tx - isl.tx, ty - isl.ty)
          const noise = valueNoise(tx*0.28, ty*0.28, seed^(isl.ix*997+isl.iy*991)) - 0.5
          const tile  = islandTileType(dist, noise, isl.biome)
          if (tile !== 'water') return tile
        }
        return 'water'
      })
    )
    chunks.push({ cx, cy, tiles, seed })
  }
}
```

### Resource Spawning

Start island (0,0) spawns 18 resources; others 18→14. First 3 on start island are always food (via `pickFoodResource`). Poisson-like rejection sampling: 80× attempts, then grid fallback.

```typescript
// placement guard
const R = (WORLD_CONFIG.ISLAND_RADIUS - 1.2) * TILE_SIZE  // pixel radius
// snap to tile center
const snx = Math.floor(nx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
// relaxed mode kicks in after attempt > total * 45
const relaxed = attempt > total * 45
// min distance between resources
const minDist = TILE_SIZE * 1.1
// inner dead-zone: skip if within 1.8 tiles of island pixel center
if (Math.hypot(nx - cx, ny - cy) < TILE_SIZE * 1.8) continue
```

Resource IDs use pattern: `res_${isl.ix}_${isl.iy}_${placed.length}`

## EventBus 互動

WorldGen.ts itself does not emit or listen to EventBus events. The caller (`main.ts` / GameController) listens to `resource:depleted { nodeId }` and triggers a re-generate or tile refresh externally.

## 依賴

- `@/types` — `WorldData`, `Chunk`, `TileType`, `ResourceNode`, `ResourceType`
- `@/resources/resourceConfig` — `RESOURCE_CONFIG` (hp, respawnTime per type)
- `@/resources/spawnConfig` — `pickFoodResource(rng)`, `pickResourceForSpawn(ring, tileType, rng)`

## 重建提示

- `unlockedIslands` keys are `"ix,iy"` strings (e.g. `"0,0"`, `"-1,2"`). Default is `new Set(['0,0'])`.
- Generation is **fully deterministic** given `(seed, unlockedIslands)` — do NOT use `Math.random()` anywhere.
- The same `seededRandom` LCG constant `(1664525, 1013904223)` is also in TileMap.ts and must match exactly.
- Chunk seed for per-chunk RNG: `((chunk.seed ^ (cx * 1000003)) ^ (cy * 999983)) >>> 0`
- `islandBiome` always returns 'lush' for (0,0); the hash distributes others across biome list with 2/5 lush weight.
- Tile coordinate to pixel: `tileX * TILE_SIZE`, tile center: `tileX * TILE_SIZE + TILE_SIZE/2`.
- `ring` is Chebyshev distance: `Math.max(Math.abs(ix), Math.abs(iy))` — used for unlock cost lookup.
- `findNearbyLockedIsland` detects within `ISLAND_STRIDE * TILE_SIZE * 0.72` = 22 * 48 * 0.72 ≈ 760 px.
- `WorldData` has extra dynamic fields beyond the type (`unlockedIslands`, `difficulty`, `spawnX`, `spawnY`) added via `as any` — be aware these are not in `src/types/index.ts`.
- Resource type for ring 0 start island: first 3 always food; rest via `pickResourceForSpawn(0, tileType, rng)`.
