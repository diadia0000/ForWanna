---
name: render-fxlayer
description: Look up particle burst parameters, floating-text behaviour, the per-resource color/icon tables, and the update loop that ages/destroys particles.
---

# render/FxLayer.ts

> 模組：render｜角色：特效層 — 在自有 Container 上產生粒子噴發與浮動文字（採集、耗盡、重生、怪物血、水面閃光），每幀老化並銷毀。無物件池，每顆粒子一個 `PIXI.Graphics`。

## 公開 API

- `new FxLayer(parent: PIXI.Container)` — 建內部 container（`eventMode='none'`）掛到 parent。
- `get displayObject(): PIXI.Container`
- `spawnFloatingText(x, y, text, color = 0xffffff): void`
- `spawnHarvest(x, y, type: ResourceType, amount = 1): void` — 文字 `+N {icon}` + 小爆。
- `spawnDepletionBurst(x, y, type): void` — 大顆粒 + 淡色環。
- `spawnRespawnSparkle(x, y): void` — 金色 + 白色星芒。
- `spawnMonsterBloodBurst(x, y): void` — 紅色血爆（在 `y-8`）。
- `spawnWaterShimmer(x, y): void` — 單顆淡藍方塊。
- `update(_delta): void` — 老化粒子與文字（注意：忽略 delta，固定步進）。

## 核心邏輯

### 資源顏色 / icon 對照表（完整）

```typescript
const RES_COLOR: Record<string, number> = {
  tree: 0x2e7d32, rock: 0x9e9e9e, iron: 0x90a4ae, gold: 0xffd54f, crystal: 0xce93d8,
  berry: 0xFF3848, tomato: 0xE5462E, purple_grape: 0x7B3FC7, onion: 0xD8D0B0,
  carrot: 0xE57C22, pumpkin: 0xD8731E, watermelon: 0x5CB85C,
}
const RES_ICON: Record<string, string> = {
  tree: '🪵', rock: '🪨', iron: '⬛', gold: '🟨', crystal: '💎', berry: '🍓',
  tomato: '🍅', purple_grape: '🍇', onion: '🧅', carrot: '🥕', pumpkin: '🎃', watermelon: '🍉',
}
```

### 通用粒子噴發 `_burst`（核心，所有效果都走它）

```typescript
private _burst(x, y, color, count, minSpeed, maxSpeed, decay, gravity): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed)
    const size  = 2 + Math.random() * 3
    const g = new PIXI.Graphics()
    g.rect(-size/2, -size/2, size, size).fill(color)
    g.x = x; g.y = y
    this.container.addChild(g)
    this.particles.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,          // -1 = 初始上拋
      life: 1,
      decay: decay + Math.random() * 0.015,
      gravity,
    })
  }
}
```

### 各效果的 `_burst` 參數（count, minSpeed, maxSpeed, decay, gravity）

```typescript
spawnHarvest:          _burst(x, y, color, 6, 1.2, 2.5, 0.05, 0.12)
spawnDepletionBurst:   _burst(x, y, color, 14, 1.8, 3.5, 0.035, 0.12)
                       _burst(x, y, blendColor(color,0xffffff,0.5), 8, 2.5, 4.0, 0.025, 0.08) // 淡色環
spawnRespawnSparkle:   _burst(x, y, 0xffd54f, 12, 0.5, 2.0, 0.022, 0.04)
                       _burst(x, y, 0xffffff, 6, 0.5, 1.5, 0.028, 0.03)  // 白星芒
spawnMonsterBloodBurst:_burst(x, y-8, 0xd32f2f, 18, 1.8, 4.2, 0.026, 0.04)
                       _burst(x, y-8, 0xff6b6b, 10, 1.2, 3.0, 0.03, 0.03)
```

### 浮動文字與水面閃光

```typescript
spawnFloatingText(x, y, text, color=0xffffff): void {
  const t = new PIXI.Text({ text, style: { fontSize: 13, fill: color, fontWeight: 'bold',
    dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.8 } } })
  t.anchor.set(0.5, 1)
  t.x = x + (Math.random() - 0.5) * 12
  t.y = y - 10
  this.container.addChild(t)
  this.floatingTexts.push({ t, vy: -1.1, life: 1, decay: 0.018 })
}
// spawnWaterShimmer: 單顆 3×3 方塊 0x90caf9 alpha 0.85，散佈 ±24，vy:-0.3 decay:0.03
```

### 每幀老化（倒序遍歷，life<=0 即 removeChild + destroy + splice）

```typescript
update(_delta): void {
  for (let i = this.particles.length - 1; i >= 0; i--) {
    const p = this.particles[i]
    p.life -= p.decay
    if (p.life <= 0) { this.container.removeChild(p.g); p.g.destroy(); this.particles.splice(i,1); continue }
    p.vy += p.gravity; p.g.x += p.vx; p.g.y += p.vy; p.g.alpha = p.life
  }
  for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
    const ft = this.floatingTexts[i]
    ft.life -= ft.decay
    if (ft.life <= 0) { this.container.removeChild(ft.t); ft.t.destroy(); this.floatingTexts.splice(i,1); continue }
    ft.t.y += ft.vy
    ft.t.alpha = Math.min(1, ft.life * 1.5)   // 後半段才淡出
  }
}
```

## EventBus 互動

- 本檔本身不訂閱 EventBus；整合層在收到 `resource:collected` / 怪物死亡 / 重生等事件時呼叫對應 `spawn*`。新增特效事件需與 event-architect 協調。

## 依賴

- `pixi.js` — `Container`、`Graphics`、`Text`。
- `@/types` — `ResourceType`。

## 重建提示

- 無物件池 — 每顆粒子 new + destroy；務必在 life<=0 時 `g.destroy()` 防洩漏。
- `update(_delta)` **忽略 delta**，靠固定 decay 步進（與 frame 綁定），所以是「per-frame」非時間制。
- 粒子初速 `vy = sin*speed - 1`（額外 -1 上拋），gravity 累加在 vy 上形成拋物線。
- container `eventMode='none'`，特效不該攔截點擊。
- 顏色與 icon 表無法重推，照抄。`blendColor`/`lerpColor` 是逐通道線性混色工具。
