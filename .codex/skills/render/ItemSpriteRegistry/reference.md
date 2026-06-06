---
name: render-itemspriteregistry
description: Look up how item icons are loaded from per-item manifests, frame-cropped to data URLs for HTML icons, and exposed as PIXI textures.
---

# render/ItemSpriteRegistry.ts

> 模組：render｜角色：物品圖示登錄表 — 由 collection 索引載入每個 item 的 manifest，若有 frame 就用 canvas 裁切成 data URL（給 HTML `<img>` 用），同時提供 PIXI 貼圖（給遊戲世界繪製）。

## 公開 API

- `loadItemSpriteRegistry(path): Promise<void>` — 載入 `{ itemId: manifestPath|null }`，逐項抓 manifest，有 frame 則預裁 dataUrl。
- `hasItemSprite(itemId): boolean`
- `getItemPixiTexture(itemId): Promise<PIXI.Texture | null>` — 取 PIXI 貼圖（有 frame 則切子區），快取。
- `getItemIconMarkup(itemId, fallbackIcon): string` — 回傳 HTML：有 sprite 回 `<img>`，否則回 escape 後的 fallback emoji。

## 核心邏輯

### 型別與快取

```typescript
interface ItemSpriteManifest { id; texture; width; height; scale?; frame?{x,y,width,height} }
type LoadedItemSpriteManifest = ItemSpriteManifest & { dataUrl?: string }

const itemSprites       = new Map<string, LoadedItemSpriteManifest>()
const itemTextureCache  = new Map<string, PIXI.Texture>()
```

### 載入 + 預裁 dataUrl

```typescript
export async function loadItemSpriteRegistry(path: string): Promise<void> {
  const collection = await (await fetch(path)).json() as Record<string, string|null>
  for (const [itemId, manifestPath] of Object.entries(collection)) {
    if (!manifestPath) continue
    const manifestRes = await fetch(manifestPath)
    if (!manifestRes.ok) continue          // 單項失敗跳過，不中斷
    const manifest = await manifestRes.json() as LoadedItemSpriteManifest
    if (manifest.frame) manifest.dataUrl = await cropFrameToDataUrl(manifest)
    itemSprites.set(itemId, manifest)
  }
}
```

### Canvas 裁切（sprite sheet → 單格 PNG data URL，給 HTML 用）

```typescript
async function cropFrameToDataUrl(manifest): Promise<string|undefined> {
  const frame = manifest.frame; if (!frame) return undefined
  const img = await loadImage(manifest.texture)            // new Image() + onload Promise
  const canvas = document.createElement('canvas')
  canvas.width = frame.width; canvas.height = frame.height
  const ctx = canvas.getContext('2d'); if (!ctx) return undefined
  ctx.imageSmoothingEnabled = false                        // 像素畫不可平滑
  ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
  return canvas.toDataURL('image/png')
}
```

### PIXI 貼圖（遊戲世界用，nearest + 快取）

```typescript
export async function getItemPixiTexture(itemId): Promise<PIXI.Texture|null> {
  const manifest = itemSprites.get(itemId); if (!manifest) return null
  if (itemTextureCache.has(itemId)) return itemTextureCache.get(itemId) ?? null
  const base = await PIXI.Assets.load(manifest.texture) as PIXI.Texture
  base.source.scaleMode = 'nearest'
  const frame = manifest.frame
  const texture = frame
    ? new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(frame.x, frame.y, frame.width, frame.height) })
    : base
  itemTextureCache.set(itemId, texture); return texture
}
```

### HTML 圖示標記（dataUrl 優先，含 escape 防注入）

```typescript
export function getItemIconMarkup(itemId, fallbackIcon): string {
  const manifest = itemSprites.get(itemId)
  if (!manifest) return escapeHtml(fallbackIcon)
  const frame = manifest.frame, scale = manifest.scale ?? 1
  const displayW = Math.max(1, Math.round((frame?.width  ?? manifest.width)  * scale))
  const displayH = Math.max(1, Math.round((frame?.height ?? manifest.height) * scale))
  const src = manifest.dataUrl ?? manifest.texture
  return `<img class="item-icon-img" src="${escapeHtml(src)}" alt="${escapeHtml(manifest.id)}" `
       + `style="width:${displayW}px;height:${displayH}px;image-rendering:pixelated;" />`
}
// escapeHtml 替換 & < > " ' 五個字元
```

## EventBus 互動

- 無。被 inventory/crafting HUD 與 render 整合層直接呼叫。

## 依賴

- `pixi.js` — `Assets.load`、`Texture`、`Rectangle`。
- 瀏覽器 API — `fetch`、`Image`、`canvas` 2D context。

## 重建提示

- 兩條路徑：HTML 圖示走 **canvas data URL**（`dataUrl`），PIXI 世界走 **frame texture**。frame 存在時 HTML 才需預裁，否則直接用整張 texture src。
- `image-rendering:pixelated` + `imageSmoothingEnabled=false` + `scaleMode='nearest'` 三處都要關平滑，少一個就糊。
- `escapeHtml` 必須包住 src/alt/id — fallback emoji 與 manifest 都經它，防 XSS。
- 載入容錯：單個 manifest fetch 失敗 `continue`，不丟整批。
