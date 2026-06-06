---
name: render-tilespriteregistry
description: Look up how tile definitions (name→variants) are loaded from Tiles.json, frame-cached, and turned into scaled PIXI sprites with seeded variant selection.
---

# render/TileSpriteRegistry.ts

> 模組：render｜角色：地板 tile 登錄表 — 從 `Tiles.json` 載入 tile 定義（依 name 分組多變體），預切 frame 貼圖快取，並用 seed 挑變體建立縮放到目標尺寸的 `PIXI.Sprite`。

## 公開 API

- `loadTileSpriteRegistry(path): Promise<void>` — 載入 `TileSpriteDef[]`，依 `name` 分組、預切所有 frame。
- `hasAnyTileSprite(): boolean` / `hasTileSprite(type: TileType): boolean`
- `createTileSprite(type, targetSize=48, variantSeed=0): Promise<PIXI.Sprite | null>` — async 包裝（內部其實同步）。
- `createTileSpriteSync(type, targetSize=48, variantSeed=0): PIXI.Sprite | null` — 同步版（要求已 load）。

## 核心邏輯

### 型別與快取

```typescript
interface TileSpriteDef {
  id: number; name: string; texture_path: string
  width: number; height: number; uv: { x: number; y: number }; walkable: boolean
}
const tileDefs     = new Map<string, TileSpriteDef[]>()   // name → 變體陣列
const textureCache = new Map<string, PIXI.Texture>()       // path → full sheet
const frameCache   = new Map<string, PIXI.Texture>()       // "path:uvx:uvy:w:h" → sub texture
```

### 載入：分組 + 預切 frame

```typescript
export async function loadTileSpriteRegistry(path: string): Promise<void> {
  const defs = await (await fetch(path)).json() as TileSpriteDef[]
  tileDefs.clear()
  for (const def of defs) {
    const variants = tileDefs.get(def.name) ?? []
    variants.push(def); tileDefs.set(def.name, variants)
    const key = `${def.texture_path}:${def.uv.x}:${def.uv.y}:${def.width}:${def.height}`
    if (frameCache.has(key)) continue
    const base = await getTexture(def.texture_path)   // nearest + cache
    frameCache.set(key, new PIXI.Texture({
      source: base.source,
      frame: new PIXI.Rectangle(def.uv.x, def.uv.y, def.width, def.height),
    }))
  }
}
```

### 建 sprite：seed 挑變體 + 縮放（含 0.5px overlap 防接縫）

```typescript
function _createTileSprite(type, targetSize = 48, variantSeed = 0): PIXI.Sprite | null {
  const defs = tileDefs.get(type)
  if (!defs || defs.length === 0) return null
  const idx = Math.abs(Math.floor(variantSeed)) % defs.length   // seed 決定哪個變體
  const def = defs[idx]; if (!def) return null
  const key = `${def.texture_path}:${def.uv.x}:${def.uv.y}:${def.width}:${def.height}`
  const frame = frameCache.get(key); if (!frame) return null
  const sprite = new PIXI.Sprite(frame)
  sprite.roundPixels = true
  const overlap = 0.5
  sprite.scale.set((targetSize + overlap) / def.width, (targetSize + overlap) / def.height)
  return sprite
}
```

`createTileSprite` 與 `createTileSpriteSync` 都呼叫 `_createTileSprite` — async 版只是包了 Promise，frame 必須已在 cache 才回非 null。

## EventBus 互動

- 無。被 render 整合層的世界繪製直接呼叫。

## 依賴

- `pixi.js` — `Assets.load`、`Sprite`、`Texture`、`Rectangle`。
- `@/types` — `TileType`。

## 重建提示

- 同 `name` 多筆 def = 多變體；`variantSeed` 經 `abs(floor()) % length` 決定挑哪個 — 同座標每次給同 seed 才能穩定不閃爍。
- `overlap = 0.5`：縮放到 `(targetSize+0.5)/width` 是為了讓相鄰 tile 微重疊、消除 1px 接縫黑線；`roundPixels=true` 也是防接縫。
- 原圖通常 16×16，`targetSize` 預設 48（×3）。
- frameCache key 含 uv+寬高，跨 tile 共用同 sheet。
- `_createTileSprite` 純同步；async API 只是介面對齊，frame 未預載則回 null（無 fallback graphics）。
