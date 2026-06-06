// src/world/WorldGen.ts ???????阡?謘??賹?

import type { WorldData, Chunk, TileType, ResourceNode, ResourceType } from '@/types'
import { RESOURCE_CONFIG } from '@/resources/resourceConfig'
import { pickFoodResource, pickResourceForSpawn } from '@/resources/spawnConfig'

const CHUNK_SIZE = 16
const TILE_SIZE  = 48
const START_ISLAND_RESOURCE_TOTAL = 12
const OTHER_ISLAND_RESOURCE_TOTAL = 14
const START_ISLAND_RESPAWN_TIME = 15
const START_ISLAND_FOOD_GUARANTEE = 2

// ???? ?▽??????????蝞? main.ts ?輯撒???????????????????????????????????????????????????????
export const WORLD_CONFIG = {
  CHUNK_COUNT:    13,          // 13?13 chunk ?▽? = 208?208 ?瞏???? 4 ???
  CENTER_TILE:    104,         // ????瞏??賹?208/2??
  ISLAND_STRIDE:  22,          // ???????謆??僱?鞈?
  ISLAND_GRID_R:  4,           // ???撥??哨????4..+4
  ISLAND_RADIUS:  6.5,         // ???秘?????赯萄??
  ISLAND_SAND_R:  8.2,         // ??謓?????????赯萄??
  get CENTER_X()  { return this.CENTER_TILE * TILE_SIZE },  // 4992
  get CENTER_Y()  { return this.CENTER_TILE * TILE_SIZE },
}

// ????????秧??????
export const ISLAND_UNLOCK_COST: Record<number, number> = {
  1: 50,
  2: 200,
  3: 500,
  4: 1200,
}

// ???? Noise ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????

function valueNoise(x: number, y: number, seed: number): number {
  function hash(ix: number, iy: number): number {
    let h = (seed + ix * 374761393 + iy * 1103515245) | 0
    h = Math.imul(h ^ (h >>> 13), 1664525)
    return (h ^ (h >>> 16)) >>> 0
  }
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix,        fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = hash(ix,     iy)     / 0xffffffff
  const b = hash(ix + 1, iy)     / 0xffffffff
  const c = hash(ix,     iy + 1) / 0xffffffff
  const d = hash(ix + 1, iy + 1) / 0xffffffff
  return a + (b - a) * ux + (c - a) * uy + (d - b - c + a) * ux * uy
}

function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function randomFoodResource(rng: () => number): string {
  return pickFoodResource(rng)
}

// ???? ???Ｘ?血??可ome??????????????????????????????????????????????????????????????????????????????????????????????

type Biome = 'lush' | 'stone' | 'desert' | 'snow'

function islandBiome(ix: number, iy: number, seed: number): Biome {
  if (ix === 0 && iy === 0) return 'lush'
  const h = ((ix * 374761 + iy * 1103515 + seed) ^ 0xabcdef12) >>> 0
  const list: Biome[] = ['lush', 'lush', 'stone', 'desert', 'snow']
  return list[h % list.length]
}

function islandTileType(dist: number, noise: number, biome: Biome): TileType {
  const R  = WORLD_CONFIG.ISLAND_RADIUS  + noise * 2.2
  const SR = WORLD_CONFIG.ISLAND_SAND_R  + noise * 1.8
  if (dist < R) {
    if (biome === 'snow')    return dist < R * 0.65 ? 'snow'  : 'stone'
    if (biome === 'stone')   return dist < R * 0.55 ? 'stone' : 'grass'
    if (biome === 'desert')  return 'sand'
    return 'grass'
  }
  if (dist < SR) return 'sand'
  return 'water'
}

// ???? WorldGen ????????????????????????????????????????????????????????????????????????????????????????????????????????????

export class WorldGen {
  /** ?賹??▽?
   * @param seed        ?▽??叟??脰?獢?
   * @param unlockedIslands  ???謘??? key ?????赯菜???'ix,iy'??
   * @param difficulty  ??瞍脣??easy'|'normal'|'hard'????world meta??
   */
  static generate(
    seed: number,
    unlockedIslands?: Set<string>,
    difficulty?: string,
  ): WorldData {
    const unlocked = unlockedIslands ?? new Set(['0,0'])
    const rng      = seededRandom(seed)
    const N        = WORLD_CONFIG.CHUNK_COUNT
    const CT       = WORLD_CONFIG.CENTER_TILE
    const STR      = WORLD_CONFIG.ISLAND_STRIDE
    const chunks: Chunk[]         = []
    const resources: ResourceNode[] = []

    // ???????????meta?????4 ?????ISLAND_UNLOCK_COST / ??????哨?? -4..4 ??皝?
    type IslandMeta = { ix: number; iy: number; tx: number; ty: number; ring: number; biome: Biome; unlocked: boolean }
    const islands: IslandMeta[] = []
    for (let ix = -4; ix <= 4; ix++) {
      for (let iy = -4; iy <= 4; iy++) {
        const ring = Math.max(Math.abs(ix), Math.abs(iy))
        islands.push({
          ix, iy,
          tx: CT + ix * STR,
          ty: CT + iy * STR,
          ring,
          biome: islandBiome(ix, iy, seed),
          unlocked: unlocked.has(`${ix},${iy}`),
        })
      }
    }

    // ?賹? Chunk ?止播?
    for (let cx = 0; cx < N; cx++) {
      for (let cy = 0; cy < N; cy++) {
        const tiles: TileType[][] = Array.from({ length: CHUNK_SIZE }, (_, ly) =>
          Array.from({ length: CHUNK_SIZE }, (_, lx) => {
            const tx = cx * CHUNK_SIZE + lx
            const ty = cy * CHUNK_SIZE + ly
            for (const isl of islands) {
              if (!isl.unlocked) continue
              const dist  = Math.hypot(tx - isl.tx, ty - isl.ty)
              const noise = valueNoise(tx * 0.28, ty * 0.28, seed ^ (isl.ix * 997 + isl.iy * 991)) - 0.5
              const tile  = islandTileType(dist, noise, isl.biome)
              if (tile !== 'water') return tile
            }
            return 'water'
          })
        )
        chunks.push({ cx, cy, tiles, seed })
      }
    }

    // ??豢??????????????
    for (const isl of islands.filter(i => i.unlocked)) {
      this._spawnIslandResources(isl, seed, resources, rng)
    }

    const worldData = {
      seed, chunks, resources, buildings: [],
      createdAt: Date.now(),
    } as any
    worldData.unlockedIslands = [...unlocked]
    worldData.difficulty       = difficulty ?? 'normal'
    worldData.spawnX           = WORLD_CONFIG.CENTER_X
    worldData.spawnY           = WORLD_CONFIG.CENTER_Y
    return worldData as WorldData
  }

  // ???? ?????賹? ??????????????????????????????????????????????????????????????????????????????????????????????

  private static _spawnIslandResources(
    isl: { ix: number; iy: number; tx: number; ty: number; ring: number; biome: Biome },
    seed: number,
    resources: ResourceNode[],
    rng: () => number,
  ): void {
    const isStart = isl.ix === 0 && isl.iy === 0
    const R = (WORLD_CONFIG.ISLAND_RADIUS - 1.2) * TILE_SIZE
    const cx = isl.tx * TILE_SIZE
    const cy = isl.ty * TILE_SIZE
    const total = isStart ? START_ISLAND_RESOURCE_TOTAL : OTHER_ISLAND_RESOURCE_TOTAL
    const placed: { x: number; y: number }[] = []
    const minDist = TILE_SIZE * 1.1

    const placeResource = (snx: number, sny: number): boolean => {
      if (placed.some(p => Math.hypot(p.x - snx, p.y - sny) < TILE_SIZE * 0.75)) return false
      const tileTx = Math.floor(snx / TILE_SIZE)
      const tileTy = Math.floor(sny / TILE_SIZE)
      const distFromIslandCenter = Math.hypot(tileTx - isl.tx, tileTy - isl.ty)
      const tileNoise = valueNoise(tileTx * 0.28, tileTy * 0.28, seed ^ (isl.ix * 997 + isl.iy * 991)) - 0.5
      const tileType = islandTileType(distFromIslandCenter, tileNoise, isl.biome)
      if (tileType === 'water') return false
      const type = this._resourceType(isl.ring, tileType, rng, isStart, placed.length)
      const cfg = (RESOURCE_CONFIG as Record<string, typeof RESOURCE_CONFIG['tree']>)[type] ?? RESOURCE_CONFIG.tree
      const respawnTime = isStart ? START_ISLAND_RESPAWN_TIME : cfg.respawnTime
      resources.push({
        id: `res_${isl.ix}_${isl.iy}_${placed.length}`,
        type: type as ResourceType,
        x: snx, y: sny,
        hp: cfg.hp, maxHp: cfg.hp, respawnTime,
      })
      placed.push({ x: snx, y: sny })
      return true
    }

    for (let attempt = 0; attempt < total * 80 && placed.length < total; attempt++) {
      const angle = rng() * Math.PI * 2
      const dist = rng() * R
      const nx = cx + Math.cos(angle) * dist
      const ny = cy + Math.sin(angle) * dist
      if (Math.hypot(nx - cx, ny - cy) < TILE_SIZE * 1.8) continue
      const relaxed = attempt > total * 45
      if (!relaxed && placed.some(p => Math.hypot(p.x - nx, p.y - ny) < minDist)) continue
      const snx = Math.floor(nx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
      const sny = Math.floor(ny / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
      if (!relaxed && placed.some(p => Math.hypot(p.x - snx, p.y - sny) < minDist)) continue
      placeResource(snx, sny)
    }

    for (let ox = -6; ox <= 6 && placed.length < total; ox++) {
      for (let oy = -6; oy <= 6 && placed.length < total; oy++) {
        const tileDist = Math.hypot(ox, oy)
        if (tileDist < 1.8 || tileDist > WORLD_CONFIG.ISLAND_RADIUS - 0.7) continue
        placeResource((isl.tx + ox) * TILE_SIZE + TILE_SIZE / 2, (isl.ty + oy) * TILE_SIZE + TILE_SIZE / 2)
      }
    }
  }


  private static _resourceType(ring: number, tileType: TileType, rng: () => number, isStart: boolean, idx: number): string {
    if (isStart) {
      // ????????∵髡 3 ??????嚚??????謓?蝞?
      if (idx < START_ISLAND_FOOD_GUARANTEE) return randomFoodResource(rng)
    }
    return pickResourceForSpawn(ring, tileType, rng) ?? 'rock'
  }

  // ???? ??????????????????????????????????????????????????????????????????????????????????????????????????????????????

  /** ?謘???僱???????寡??對瞍??謕??????*/
  static islandWorldCenter(ix: number, iy: number): { x: number; y: number } {
    return {
      x: (WORLD_CONFIG.CENTER_TILE + ix * WORLD_CONFIG.ISLAND_STRIDE) * TILE_SIZE,
      y: (WORLD_CONFIG.CENTER_TILE + iy * WORLD_CONFIG.ISLAND_STRIDE) * TILE_SIZE,
    }
  }

  /** ????啣??擗???曉?謘???擗???????哨???? ??stride ???勗??*/
  static findNearbyLockedIsland(
    wx: number, wy: number, unlocked: Set<string>,
  ): { ix: number; iy: number; ring: number; cost: number } | null {
    const STR    = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE
    const DETECT = STR * 0.72
    let best: { ix: number; iy: number; ring: number; cost: number; dist: number } | null = null
    for (let ix = -4; ix <= 4; ix++) {
      for (let iy = -4; iy <= 4; iy++) {
        if (unlocked.has(`${ix},${iy}`)) continue
        const { x: icx, y: icy } = WorldGen.islandWorldCenter(ix, iy)
        const dist = Math.hypot(wx - icx, wy - icy)
        if (dist > DETECT) continue
        const ring = Math.max(Math.abs(ix), Math.abs(iy))
        const cost = ISLAND_UNLOCK_COST[ring] ?? 9999
        if (!best || dist < best.dist) best = { ix, iy, ring, cost, dist }
      }
    }
    return best
  }
}
