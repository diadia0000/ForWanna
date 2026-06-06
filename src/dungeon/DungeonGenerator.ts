// src/dungeon/DungeonGenerator.ts

const TILE = 48

export interface DRoom {
  id: number
  px: number; py: number
  pw: number; ph: number
  isSpawn: boolean
}

export interface DCorridor {
  px: number; py: number
  pw: number; ph: number
}

export interface DungeonLayout {
  rooms: DRoom[]
  corridors: DCorridor[]
  spawnPx: number; spawnPy: number
  bossRoomId: number   // 最長分支末端房間的 id（Boss 房）
}

export function generateDungeon(worldSeed: number, ix: number, iy: number): DungeonLayout {
  const originX = 150_000 + (ix + 4) * 8_000
  const originY = 150_000 + (iy + 4) * 8_000

  let s = Math.abs((worldSeed ^ (ix * 73856093)) ^ (iy * 19349663)) + 1
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }

  const rooms: DRoom[] = []
  const corridors: DCorridor[] = []

  const SPAWN_W = 9 * TILE, SPAWN_H = 9 * TILE
  rooms.push({ id: 0, px: originX, py: originY, pw: SPAWN_W, ph: SPAWN_H, isSpawn: true })

  const dirs = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ]
  const branchDirs = dirs.sort(() => rng() - 0.5).slice(0, 3 + Math.floor(rng() * 2))

  let roomId = 1
  // 追蹤每個分支的末端 room id + 房間數（用來找最長分支）
  const branchEnds: Array<{ endId: number; length: number }> = []

  for (const dir of branchDirs) {
    const ROOMS_IN_BRANCH = 2 + Math.floor(rng() * 2)
    let prev = rooms[0]
    let lastRoomId = 0

    for (let i = 0; i < ROOMS_IN_BRANCH; i++) {
      const rw = (7 + Math.floor(rng() * 4)) * TILE
      const rh = (7 + Math.floor(rng() * 4)) * TILE
      const CORR_W = 3 * TILE
      const CORR_LEN = (3 + Math.floor(rng() * 3)) * TILE

      let cpx: number, cpy: number, cpw: number, cph: number
      let rpx: number, rpy: number

      if (dir.dx === 1) {
        cpx = prev.px + prev.pw; cpy = prev.py + (prev.ph - CORR_W) / 2
        cpw = CORR_LEN; cph = CORR_W
        rpx = cpx + cpw; rpy = cpy + (CORR_W - rh) / 2
      } else if (dir.dx === -1) {
        cpw = CORR_LEN; cph = CORR_W
        cpx = prev.px - cpw; cpy = prev.py + (prev.ph - CORR_W) / 2
        rpx = cpx - rw; rpy = cpy + (CORR_W - rh) / 2
      } else if (dir.dy === 1) {
        cpw = CORR_W; cph = CORR_LEN
        cpx = prev.px + (prev.pw - CORR_W) / 2; cpy = prev.py + prev.ph
        rpx = cpx + (CORR_W - rw) / 2; rpy = cpy + cph
      } else {
        cpw = CORR_W; cph = CORR_LEN
        cpx = prev.px + (prev.pw - CORR_W) / 2; cpy = prev.py - cph
        rpx = cpx + (CORR_W - rw) / 2; rpy = cpy - rh
      }

      corridors.push({ px: cpx, py: cpy, pw: cpw, ph: cph })
      const newRoom: DRoom = { id: roomId++, px: rpx, py: rpy, pw: rw, ph: rh, isSpawn: false }
      rooms.push(newRoom)
      prev = newRoom
      lastRoomId = newRoom.id
    }

    branchEnds.push({ endId: lastRoomId, length: ROOMS_IN_BRANCH })
  }

  // 最長分支的末端 = Boss 房
  const bossEntry = branchEnds.reduce((a, b) => b.length >= a.length ? b : a, branchEnds[0])
  const bossRoomId = bossEntry?.endId ?? (rooms.length > 1 ? rooms[rooms.length - 1].id : 0)

  return {
    rooms, corridors,
    spawnPx: originX + SPAWN_W / 2,
    spawnPy: originY + SPAWN_H / 2,
    bossRoomId,
  }
}
