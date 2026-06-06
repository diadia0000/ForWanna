---
name: render-assetloader
description: Look up how game textures (resources, tiles, grass deco) are sliced from sprite sheets and which exact sheet coordinates / asset paths feed each visual.
---

# render/AssetLoader.ts

> 模組：render｜角色：頂層資源載入協調器 — 載入 Farm RPG + Anokolisa sprite sheets，切出子貼圖，並串接 entity/tile/item registry。任何載入失敗都靜默降級（不拋出，記 warn）。

## 公開 API

- `loadGameAssets(): Promise<void>` — 主入口，依序載入所有資源；只要有一項成功就把 `_loaded = true`。
- `assetsLoaded(): boolean` — 是否至少載入過一項。
- `RESOURCE_TEXTURES: { tree, stump, rock, rock_grey }` — 資源物件貼圖（初始全 null）。
- `TILE_TEXTURES: Partial<Record<TileType, PIXI.Texture>>` — 地板 tile 貼圖。
- `GRASS_TILE_VARIANTS: PIXI.Texture[]` — 6 種草地變體（渲染時隨機挑）。
- `GRASS_DECO_TEXTURES: { white, orange }` — 草地花朵裝飾。

## 核心邏輯

### 載入順序與容錯（每段獨立 try/catch，`ok++`）

順序很重要：entity/blocks manifest → tile registry → item sprites → Farm RPG → rocks → floors/water → vegetation。每段失敗只 `console.warn` 並跳過。

```typescript
let ok = 0
try {
  await loadEntitySpriteManifestCollection('/assets/entities/entities.json')
  await loadEntitySpriteManifestCollection('/assets/blocks/blocks.json')
  await preloadEntitySpriteManifestAssets()
  ok++
} catch (e) { console.warn('[AssetLoader] Sprite manifests unavailable:', e) }
try { await loadTileSpriteRegistry('/assets/tiles/Tiles.json'); ok++ } catch (e) { /* warn */ }
try { await loadItemSpriteRegistry('/assets/main_resources/items_json/items.json'); ok++ } catch (e) { /* warn */ }
// ...farm-rpg / rocks / floors / vegetation 各自 try...
if (ok > 0) _loaded = true
```

### Sprite sheet 切片（精確座標）

所有貼圖共用一張 sheet 的 `source`，靠 `new PIXI.Texture({ source, frame: Rectangle })` 切出子區域。先強制 nearest：

```typescript
function setNearest(tex: PIXI.Texture): void { tex.source.scaleMode = 'nearest' }

// Farm RPG maple-tree.png (160×48) 每格 32×48
RESOURCE_TEXTURES.tree  = new PIXI.Texture({ source: treeTex.source, frame: new PIXI.Rectangle(96,  0, 32, 48) }) // frame 3
RESOURCE_TEXTURES.stump = new PIXI.Texture({ source: treeTex.source, frame: new PIXI.Rectangle(128, 0, 32, 48) }) // frame 4

// Anokolisa rocks.png (208×304)
RESOURCE_TEXTURES.rock      = r(0,  16, 32, 48)  // 棕色大岩
RESOURCE_TEXTURES.rock_grey = r(96, 16, 32, 48)  // 灰色大岩（鐵/金礦底圖）
```

### 地板 tile 與草地變體（16×16 原圖，渲染時 ×3 = 48×48）

```typescript
const f = (tx, x, y) => new PIXI.Texture({ source: tx.source, frame: new PIXI.Rectangle(x, y, 16, 16) })
// floors-tiles.png (400×416)
TILE_TEXTURES['grass'] = f(floorTex, 16, 160)   // 預設草綠 RGB(50,119,3)
GRASS_TILE_VARIANTS.push(
  f(floorTex, 16, 160), f(floorTex, 32, 160), f(floorTex, 48, 160),  // row10 亮平草
  f(floorTex, 16, 176), f(floorTex, 32, 176), f(floorTex, 48, 176),  // row11 暗斜紋草
)
TILE_TEXTURES['sand']  = f(floorTex, 96,  0)    // RGB(144,124,99)
TILE_TEXTURES['stone'] = f(floorTex, 256, 0)    // RGB(116,107,97)
TILE_TEXTURES['snow']  = f(floorTex, 0,   352)  // RGB(220,226,238)
TILE_TEXTURES['water'] = f(waterTex, 0,   192)  // water-tiles.png (400×400), RGB(67,151,209)
// vegetation.png
GRASS_DECO_TEXTURES.white  = v(48, 384)  // 白菊花（帶藍紋）
GRASS_DECO_TEXTURES.orange = v(48, 368)  // 橙花
```

## EventBus 互動

- 無。本檔不碰 EventBus；純資源載入，被啟動流程直接 await。

## 依賴

- `pixi.js` — `PIXI.Assets.load`、`PIXI.Texture`、`PIXI.Rectangle`。
- `@/types` — `TileType`。
- `./EntitySpriteDriver` — `loadEntitySpriteManifestCollection`、`preloadEntitySpriteManifestAssets`。
- `./ItemSpriteRegistry` — `loadItemSpriteRegistry`。
- `./TileSpriteRegistry` — `loadTileSpriteRegistry`。

## 重建提示

- 所有 sheet 切片用同一個 `source`，**不要** 重複 `Assets.load` 同一檔；切的是 frame 不是新貼圖。
- 像素畫放大必須 `scaleMode = 'nearest'`，少了會糊。
- 座標數字無法重推 — 必須照表抄。grass 預設 = `(16,160)`，但 grass 渲染時應從 `GRASS_TILE_VARIANTS`（6 格）隨機挑。
- 容錯設計：絕不讓單一資源缺失中斷整個遊戲；`_loaded` 只要 `ok > 0` 即 true。
