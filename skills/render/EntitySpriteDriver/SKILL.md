---
name: render-entityspritedriver
description: Look up how entity sprite manifests are loaded/cached and how a per-entity animation driver picks frames by state+direction and ticks them.
---

# render/EntitySpriteDriver.ts

> 模組：render｜角色：實體動畫驅動 — 載入 JSON manifest（依 state×direction 列 frame），切貼圖三層快取，並提供每實體一個 `EntitySpriteDriver` 以播放/換向/逐幀更新。

## 公開 API

- `loadEntitySpriteManifestCollection(path): Promise<void>` — 載入 `{ id: manifestPath|null }` 索引表。
- `preloadEntitySpriteManifestAssets(ids?): Promise<void>` — 預抓所有 manifest 的每個 frame 貼圖（供 `createSync` 用）。
- `getEntitySpriteManifest(id): Promise<EntitySpriteManifest | null>` — 載入並快取單個 manifest。
- `hasEntitySpriteManifest(id): boolean`
- `EntitySpriteDriver.create(id): Promise<EntitySpriteDriver | null>` — 非同步建構（會 await 首幀）。
- `EntitySpriteDriver.createSync(id): EntitySpriteDriver | null` — 同步建構（要求 manifest 與首幀已預載）。
- 實例：`.sprite: PIXI.Sprite`、`.manifest`、`play(state, dir?, resetFrame?)`、`setDirection(dir)`、`update(delta)`、`getHpBarY(defaultY)`。

## 核心邏輯

### 型別

```typescript
type EntityDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type EntityAnimationState = 'IDLE' | 'MOVE' | 'HIT' | 'ATTACK'
interface EntitySpriteFrame { x; y; width?; height?; duration?; texture? }
interface EntitySpriteManifest {
  id; texture; width; height; scale?; anchor?{x,y}; offset?{x,y}; ui?{hpBarY?}
  animations: Partial<Record<EntityAnimationState, Partial<Record<EntityDirection, EntitySpriteFrame[]>>>>
}
```

### 三層 Map 快取（路徑→manifest→sheet→frame）

```typescript
const manifestPathById = new Map<string, string>()      // id → manifest json path
const manifestCache    = new Map<string, EntitySpriteManifest>()
const textureCache     = new Map<string, PIXI.Texture>() // sheet path → full texture
const frameCache       = new Map<string, PIXI.Texture>() // "path:x:y:w:h" → sub texture

async function getSheetTexture(path) {
  if (textureCache.has(path)) return textureCache.get(path)!
  const tex = await PIXI.Assets.load(path) as PIXI.Texture
  tex.source.scaleMode = 'nearest'
  textureCache.set(path, tex); return tex
}
// frame key 與 sync 版共用同一格式，sync 版只讀 frameCache、無則 null
const key = `${texturePath}:${frame.x}:${frame.y}:${frameWidth}:${frameHeight}`
```

### Sprite 建構（anchor/scale/offset 來自 manifest）

```typescript
private constructor(manifest) {
  this.sprite = new PIXI.Sprite()
  this.sprite.anchor.set(manifest.anchor?.x ?? 0.5, manifest.anchor?.y ?? 1)  // 預設底部中心
  this.sprite.scale.set(manifest.scale ?? 1)
  this.sprite.x = manifest.offset?.x ?? 0
  this.sprite.y = manifest.offset?.y ?? 0
}
```

### Frame 選擇 fallback 鏈（state + direction 兩層降級）

```typescript
private getFrames(): EntitySpriteFrame[] {
  const stateFrames = this.manifest.animations[this.state]
    ?? (this.state === 'ATTACK' ? this.manifest.animations.HIT : undefined)  // ATTACK 缺則用 HIT
    ?? this.manifest.animations.IDLE
  const directional = stateFrames?.[this.direction]
    ?? stateFrames?.DOWN
    ?? this.manifest.animations.IDLE?.[this.direction]
    ?? this.manifest.animations.IDLE?.DOWN
    ?? []
  return directional
}
```

### 逐幀推進（delta 累加比 duration，預設 8）

```typescript
update(delta: number): void {
  const frames = this.getFrames()
  if (frames.length <= 1) return
  const duration = frames[this.frameIndex].duration ?? 8
  this.frameTick += delta
  if (this.frameTick < duration) return
  this.frameTick = 0
  this.frameIndex = (this.frameIndex + 1) % frames.length
  void this.applyCurrentFrame()   // async fire-and-forget
}
```

`play(state, dir, resetFrame)` 只有在 state/dir 變或 `resetFrame` 才重套貼圖；`resetFrame` 才歸零 index/tick。
`preloadEntitySpriteManifestAssets` 三層巢狀走訪 `animations[state][dir][]`，每 frame 呼 `getFrameTexture`（frame.texture ?? manifest.texture）填滿 frameCache。

## EventBus 互動

- 無直接 EventBus；由 combat/render 整合層持有 driver、依遊戲事件呼叫 `play/setDirection`。

## 依賴

- `pixi.js` — `Assets.load`、`Sprite`、`Texture`、`Rectangle`。

## 重建提示

- `sprite` 是 **`PIXI.Sprite`**（單一可換 texture），不是 Container/AnimatedSprite。動畫靠手動換 `sprite.texture`。
- `createSync` 需要 manifest 已在 `manifestCache`（要先 `getEntitySpriteManifest` 或 `preload...`）且首幀已在 frameCache，否則回 null — 這是預載順序依賴。
- frameCache key 必含寬高，因不同實體可共用同 sheet 不同尺寸。
- duration 單位是「tick 數」（與 `update(delta)` 同單位），不是毫秒；預設 8。
- anchor 預設 `(0.5, 1)`（腳底對齊格子），scale/offset 全來自 manifest。
