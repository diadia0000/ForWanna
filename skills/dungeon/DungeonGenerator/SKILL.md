---
name: dungeon-generator
description: Look up here when rebuilding procedural dungeon room/corridor layout, RNG seeding, branch-based room placement, and boss-room selection logic.
---

# dungeon/DungeonGenerator.ts

> 模組：dungeon｜角色：純函式地牢生成器 — 依 worldSeed 與格子座標 (ix, iy) 產生確定性地牢佈局

## 公開 API

- `generateDungeon(worldSeed: number, ix: number, iy: number): DungeonLayout` — 產生完整地牢佈局（rooms + corridors + spawnPx/Py + bossRoomId）
- `interface DRoom` — `{ id, px, py, pw, ph, isSpawn }`，世界座標（像素）
- `interface DCorridor` — `{ px, py, pw, ph }`，走廊矩形，世界座標
- `interface DungeonLayout` — `{ rooms, corridors, spawnPx, spawnPy, bossRoomId }`

## 核心邏輯

### 常數與座標映射

每個格子地牢的世界原點由格子索引計算，確保不同格子的地牢不重疊：

```typescript
const TILE = 48

const originX = 150_000 + (ix + 4) * 8_000
const originY = 150_000 + (iy + 4) * 8_000
```

### 確定性 RNG（Lehmer LCG）

```typescript
let s = Math.abs((worldSeed ^ (ix * 73856093)) ^ (iy * 19349663)) + 1
const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
```

種子結合 worldSeed 與格子座標做 XOR 雜湊，`+1` 防止 s=0 造成退化。乘數 16807 是標準 Lehmer/Park-Miller，模數 2147483647（2³¹-1 質數）。

### 出生房與分支方向

```typescript
const SPAWN_W = 9 * TILE, SPAWN_H = 9 * TILE   // = 432 x 432 px
rooms.push({ id: 0, px: originX, py: originY, pw: SPAWN_W, ph: SPAWN_H, isSpawn: true })

const dirs = [{ dx:1,dy:0 },{ dx:-1,dy:0 },{ dx:0,dy:1 },{ dx:0,dy:-1 }]
const branchDirs = dirs.sort(() => rng() - 0.5).slice(0, 3 + Math.floor(rng() * 2))
// 隨機選 3 或 4 個方向展開分支
```

### 分支房間 + 走廊放置

每個分支走 2–3 間房，房間尺寸 7–10 × 7–10 tiles，走廊 3 tiles 寬、3–5 tiles 長：

```typescript
const ROOMS_IN_BRANCH = 2 + Math.floor(rng() * 2)
const rw = (7 + Math.floor(rng() * 4)) * TILE
const rh = (7 + Math.floor(rng() * 4)) * TILE
const CORR_W = 3 * TILE
const CORR_LEN = (3 + Math.floor(rng() * 3)) * TILE
```

走廊與房間的世界座標依方向計算（以 dx=1 向右為例）：

```typescript
// dir.dx === 1（向右）
cpx = prev.px + prev.pw
cpy = prev.py + (prev.ph - CORR_W) / 2
cpw = CORR_LEN; cph = CORR_W
rpx = cpx + cpw
rpy = cpy + (CORR_W - rh) / 2

// dir.dx === -1（向左）
cpw = CORR_LEN; cph = CORR_W
cpx = prev.px - cpw
cpy = prev.py + (prev.ph - CORR_W) / 2
rpx = cpx - rw
rpy = cpy + (CORR_W - rh) / 2

// dir.dy === 1（向下）
cpw = CORR_W; cph = CORR_LEN
cpx = prev.px + (prev.pw - CORR_W) / 2; cpy = prev.py + prev.ph
rpx = cpx + (CORR_W - rw) / 2; rpy = cpy + cph

// dir.dy === -1（向上）
cpw = CORR_W; cph = CORR_LEN
cpx = prev.px + (prev.pw - CORR_W) / 2; cpy = prev.py - cph
rpx = cpx + (CORR_W - rw) / 2; rpy = cpy - rh
```

走廊對齊前一個房間的中心線（垂直方向居中），房間對齊走廊末端中心線。

### Boss 房選擇

```typescript
const bossEntry = branchEnds.reduce((a, b) => b.length >= a.length ? b : a, branchEnds[0])
const bossRoomId = bossEntry?.endId ?? (rooms.length > 1 ? rooms[rooms.length - 1].id : 0)
```

最長分支的末端房間即為 Boss 房（`b.length >= a.length` 取後者，等長時取最後處理的分支）。

## EventBus 互動

無 — 純函式，不發射也不監聽任何事件。

## 依賴

- 無外部依賴，僅使用內部 `TILE = 48` 常數

## 重建提示

- `originX/Y` 公式中的 `150_000` 是世界地圖中心偏移，`8_000` 是每格地牢佔用的世界空間；兩者必須與世界地圖的格子系統一致，否則地牢位置會與地圖格子對不上。
- RNG 種子 `+1` 不可省略：若 s=0 進入 Lehmer，整個序列會退化為全零。
- `dirs.sort(() => rng() - 0.5)` 使用 rng 打亂四個方向，再 slice 取前 3–4 個，因此 rng 狀態在分支方向決定前會消耗 4 次（sort 的比較次數為 4 元素排序，但實際消耗次數依 V8 sort 實作而定，重建時需保持順序一致）。
- `branchEnds.reduce` 的初始值是 `branchEnds[0]`（非 `undefined` guard），若所有分支長度相同，最後處理的分支成為 Boss 房。
- 房間彼此不做碰撞偵測，多個分支可能在視覺上輕微重疊，設計上接受此現象。
- 走廊寬固定 `3 * TILE`（144 px），不隨房間大小縮放。
