---
name: render
description: 渲染/視覺模組總綱：粒子特效 FxLayer、日夜循環、資產載入、精靈註冊表（tile/item/entity）。重建視覺特效、日夜光照、資產載入先看這份，再按需展開 reference 子檔。
---

# render 模組總綱

本檔是 `src/render/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`render/index`](./index/reference.md) — Look up the public surface of the render module — which classes, functions and types are re-exported (and which internal files stay private).
- [`render/AssetLoader`](./AssetLoader/reference.md) — Look up how game textures (resources, tiles, grass deco) are sliced from sprite sheets and which exact sheet coordinates / asset paths feed each visual.
- [`render/DayNight`](./DayNight/reference.md) — Look up the day/night cycle timing, phase thresholds, darkness curve, ambient overlay color lerp, and the HTML progress bar that fronts it.
- [`render/EntitySpriteDriver`](./EntitySpriteDriver/reference.md) — Look up how entity sprite manifests are loaded/cached and how a per-entity animation driver picks frames by state+direction and ticks them.
- [`render/FxLayer`](./FxLayer/reference.md) — Look up particle burst parameters, floating-text behaviour, the per-resource color/icon tables, and the update loop that ages/destroys particles.
- [`render/ItemSpriteRegistry`](./ItemSpriteRegistry/reference.md) — Look up how item icons are loaded from per-item manifests, frame-cropped to data URLs for HTML icons, and exposed as PIXI textures.
- [`render/TileSpriteRegistry`](./TileSpriteRegistry/reference.md) — Look up how tile definitions (name→variants) are loaded from Tiles.json, frame-cached, and turned into scaled PIXI sprites with seeded variant selection.
