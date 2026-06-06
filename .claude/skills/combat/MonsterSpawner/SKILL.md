---
name: combat-monster-spawner
description: 重建 MonsterSpawner（野怪/守城波次生成、難度乘數、菁英/Boss、AI 狀態機、陷阱碰撞、灼燒、死亡掉落、Host tick 與 Client applyDelta 同步）時查這裡。
---

# combat/MonsterSpawner.ts

> 模組：combat｜角色：怪物的「導演」。Host 端每幀 `tick()` 驅動生成、AI、陷阱、掉落；Client 端用 `applyDelta()` 套用同步。透過注入回呼（非 import）與 Building / Player / 掉落系統溝通。

## 公開 API

- `class MonsterSpawner`
  - `constructor(container: PIXI.Container)`
  - 注入 setter（Host 專用回呼）：
    - `setKillCallback(fn: (drop: MonsterDrop, killerId: string) => void)`
    - `setHitPlayerCallback(fn: (pid: string, dmg: number) => void)`
    - `setDeathVisualCallback(fn: (x, y, type: MonsterType) => void)`
    - `setDarknessGetter(fn: () => number)` — 0~1 黑暗度，>0.3 算夜晚
    - `setLandPosChecker(fn: (x, y) => boolean)` — 生成點必須是陸地
    - `setGetBuildings(fn: () => BuildingTarget[])`
    - `setHitBuildingCallback(fn: (buildingId, damage) => void)`
    - `setDifficulty(d)` / `setNightCount(n)` / `setPlayerRing(r)`
  - `tick(nowMs, players: Map<string,{x,y,id}>): MonsterDelta[]` — Host 主循環，回傳全怪 delta
  - `hitMonster(id, damage, attackerId): boolean` — 玩家攻擊命中，回傳是否致死
  - `applyDelta(updates: MonsterDelta[]): void` — Client 套用
  - `update(delta): void` — 推進所有怪物動畫
  - `count` / `getAllMonsters()` / `getMonster(id)`
- types：`Difficulty='easy'|'normal'|'hard'`、`MonsterDrop`、`MonsterDelta`、`BuildingTarget`

## 核心邏輯

### 常數

```typescript
const TILE_SIZE = 48
const MAX_WILD = 8
const MAX_SIEGE = 20
const SPAWN_R_MIN = 9, SPAWN_R_MAX = 13   // tile，生成環半徑
const DESPAWN_R = 22                       // tile，離所有玩家超過此距離消失
const WILD_SPAWN_INTERVAL = 9500           // ms（夜晚 ×0.75）
const SIEGE_WAVE_MIN = 10_000, SIEGE_WAVE_MAX = 30_000  // 守城波次間隔隨機
```

### 難度乘數 + 金幣折算

```typescript
const DIFF_MULT: Record<Difficulty, { hp; dmg; speed; atkCD }> = {
  easy:   { hp: 0.7, dmg: 0.8, speed: 0.85, atkCD: 1.4 },
  normal: { hp: 1.0, dmg: 1.0, speed: 1.0,  atkCD: 1.0 },
  hard:   { hp: 1.6, dmg: 1.4, speed: 1.2,  atkCD: 0.7 },
}
// 金幣由 MONSTER_STATS.goldReward 折算：野怪 ×0.45（最低1），守城 ×0.75（最低2）
const WILD_GOLD  = ...round(goldReward * 0.45), Math.max(1, ...)
const SIEGE_GOLD = ...round(goldReward * 0.75), Math.max(2, ...)
```

### 加權生成表 + 抽選

四張表（日野怪/夜野怪/日守城/夜守城）按 weight 抽選。`BOSS_SPAWNS` 是固定五種。

```typescript
function pickWeightedMonster(table: MonsterSpawnWeight[]): MonsterType {
  const total = table.reduce((s, e) => s + e.weight, 0)
  let roll = Math.random() * total
  for (const entry of table) { roll -= entry.weight; if (roll <= 0) return entry.type }
  return table[table.length - 1]?.type ?? 'slime'
}
// 表內容（type:weight）：
// DAY_WILD:    slime28 slime_blue18 giant_frog10 giant_frog_2:7 goblin18 goblin_rogue8 giant_raccoon7 giant_slime4
// NIGHT_WILD:  slime14 slime_blue12 giant_slime8 giant_flame5 goblin18 goblin_rogue10 goblin_shaman8 skeleton14 skeleton_rogue6 tengu_blue5
// DAY_SIEGE:   slime18 slime_blue14 goblin24 goblin_rogue12 goblin_warrior10 giant_raccoon8 giant_slime8 giant_frog_2:6
// NIGHT_SIEGE: slime8 slime_blue7 giant_slime7 giant_flame5 giant_spirit4 goblin14 goblin_shaman9 goblin_warrior10 skeleton14 skeleton_mage8 skeleton_warrior6 tengu_blue4 tengu_red2 giant_raccoon_gold2
const BOSS_SPAWNS = ['giant_blue_samurai','giant_red_samurai','tengu_red','skeleton_warrior','giant_raccoon_gold']
```

### 守城開放條件

```typescript
private _canSpawnSiege(): boolean {
  switch (this._difficulty) {
    case 'easy':   return this._playerRing >= 2   // 到第 2 環
    case 'normal': return this._nightCount >= 5   // 5 夜後
    case 'hard':   return this._nightCount >= 2   // 2 夜後
  }
}
```

### tick() 主流程順序（每項都按此序執行）

1. 取 darkness，`isNight = darkness > 0.3`；無玩家直接回 `[]`。
2. **野怪生成**：間隔 `isNight ? WILD_SPAWN_INTERVAL*0.75 : WILD_SPAWN_INTERVAL`，wild 數 < MAX_WILD。
3. **守城波次**：夜晚 + `_canSpawnSiege()` + `nowMs >= _siegeNextWaveAt` + siege 數 < MAX_SIEGE → 滾下一波時間，生 1~3 組，每組 2~6 隻（`1 + floor(rand*5)`）。
4. **Despawn**：離所有玩家 > DESPAWN_R 才移除（`every`）。
5. **陷阱碰撞**（見下）。
6. **灼燒持續傷害**（每秒）。
7. **AI**（見下）。
8. 回傳所有怪的 `MonsterDelta`。

```typescript
const wildInterval = isNight ? WILD_SPAWN_INTERVAL * 0.75 : WILD_SPAWN_INTERVAL
if (nowMs - this.lastWildMs > wildInterval && wildCount < MAX_WILD) {
  this.lastWildMs = nowMs
  this._spawnRandom(playerArr, 'wild', isNight)
}
if (isNight && this._canSpawnSiege() && nowMs >= this._siegeNextWaveAt && siegeCount < MAX_SIEGE) {
  this._siegeNextWaveAt = nowMs + SIEGE_WAVE_MIN + Math.random() * (SIEGE_WAVE_MAX - SIEGE_WAVE_MIN)
  const numGroups = 1 + Math.floor(Math.random() * 3)
  for (let g = 0; g < numGroups; g++)
    this._spawnSiegeGroup(playerArr, isNight, 1 + Math.floor(Math.random() * 5))
}
```

### 生成點選擇（環形 + 陸地驗證）

野怪與守城組共用同一套：以隨機玩家為 pivot，最多試 8 次，在 `SPAWN_R_MIN~MAX` 環上找一個 `_isLandPos` 為真的點；失敗就放棄這次生成。

```typescript
for (let attempt = 0; attempt < 8; attempt++) {
  const angle = Math.random() * Math.PI * 2
  const dist  = (SPAWN_R_MIN + Math.random() * (SPAWN_R_MAX - SPAWN_R_MIN)) * TILE_SIZE
  sx = pivot.x + Math.cos(angle) * dist
  sy = pivot.y + Math.sin(angle) * dist
  if (!this._isLandPos || this._isLandPos(sx, sy)) { found = true; break }
}
if (!found) return
```

### 守城組（集群同種）

一組同種怪集中在中心點 ±SPREAD（`TILE_SIZE*2`）。整組同一個 elite/boss 判定，但 Boss 只套在組內第一隻（`isBoss && i === 0`）。

```typescript
const eliteChance = Math.min(0.05 + this._nightCount * 0.02, 0.40)
const isElite = Math.random() < eliteChance
const isBoss = this._nightCount > 0 && this._nightCount % 5 === 0
  && [...this.monsters.values()].filter(m => m.isBoss).length === 0
  && Math.random() < 0.25      // 即使到 Boss 夜，每波也只 25% 機率真的出 Boss
if (isBoss) type = BOSS_SPAWNS[Math.floor(Math.random() * BOSS_SPAWNS.length)] ?? type
const SPREAD = TILE_SIZE * 2
for (let i = 0; i < count; i++) {
  const mx = gx + (Math.random() - 0.5) * SPREAD
  const my = gy + (Math.random() - 0.5) * SPREAD
  this._spawn(type, mx, my, 'siege', undefined, isElite, isBoss && i === 0)
}
```

### _spawn：等級縮放 + 難度 + 菁英/Boss

等級 = 環數×2 + 夜數×0.5，每級 +18% HP/ATK。Boss：HP×10 ATK×3 速×0.8；Elite：HP×3 ATK×2 速×1.5（兩者互斥，先判 Boss）。

```typescript
const monsterLevel = Math.max(1, Math.floor(this._playerRing * 2 + this._nightCount * 0.5))
const levelScale   = 1 + (monsterLevel - 1) * 0.18
const d = DIFF_MULT[this._difficulty]
let hpMult = d.hp * levelScale, dmgMult = d.dmg * levelScale, spdMult = d.speed
if (isBoss)      { hpMult *= 10; dmgMult *= 3; spdMult *= 0.8; m.isBoss = true; m.isElite = false }
else if (isElite){ hpMult *= 3;  dmgMult *= 2; spdMult *= 1.5; m.isElite = true }
m.hp = Math.round(m.hp * hpMult); m.maxHp = Math.round(m.maxHp * hpMult)
m.damage *= dmgMult; m.speed *= spdMult; m.baseSpeed = m.speed
m.setVariantVisual(m.isElite, m.isBoss); m.refreshHpBar()
// id = forceId ?? `m_${Date.now()}_${this._counter++}`
```

### AI 狀態機（_ai）

每幀對每隻活怪呼叫。先算有效速度（凍結=0，減速×0.5），找最近玩家。

```typescript
const atkCD = stats.attackCooldown * diff.atkCD
const speed = m.speed * diff.speed * (1 + darkness * 0.25)   // 夜晚加速
const atkR  = stats.attackRange * TILE_SIZE
const effectiveSpeed = m.frozenUntil > nowMs ? 0
  : m.slowUntil > nowMs ? speed * 0.5 : speed
```

- **野怪（wild）**：只在 `AGGRO_R = 2.2 * TILE_SIZE` 內反應。範圍內 + 在攻擊距離 → attack（冷卻到就 `_onHitPlayer(id, damage*diff.dmg)`）；範圍內但太遠 → 只轉身面向（aiState='chase' 但**不移動**）；範圍外 → idle。野怪不追擊、不打建築。
- **守城（siege）**：先依 `SIEGE_TARGET_PRIORITY` 找最高優先級、距離最近的活建築當目標。
  ```typescript
  const SIEGE_TARGET_PRIORITY = ['base_core','barracks','tower','wall','spike_trap','fire_trap','ice_trap']
  // 建築中心 = b.x + b.sizeX*TILE_SIZE/2, b.y + b.sizeY*TILE_SIZE/2
  if (bestBuilding) {
    if (bestBuilding.dist < atkR + TILE_SIZE * 0.5) { /* attack: _onHitBuilding(id, round(damage*diff.dmg)) */ }
    else { /* chase: 朝建築中心 moveTo，步長 effectiveSpeed */ }
  } else {
    // 無建築 → 追最近玩家，偵測距離 = detectRange*TILE_SIZE*(1 + darkness*0.45)
    // 玩家也超出偵測 → wander：idleTimer 累積 > 80+rand*60 才換新 wanderTarget（半徑 2~5 tile），步長 effectiveSpeed*0.45
  }
  ```

### 陷阱碰撞（tick 內）

只在有 `_getBuildings` 時跑。冷卻 key 是 `${b.id}_${m.id}`（每怪每陷阱獨立冷卻）。

```typescript
const TRAP_DEF = {
  spike_trap: { triggerPx: 0.8*TILE_SIZE, dmg: lv => 10 + lv*5, cd: 1000, effect: 'slow'   },
  fire_trap:  { triggerPx: 1.0*TILE_SIZE, dmg: lv => 8  + lv*4, cd: 800,  effect: 'burn'   },
  ice_trap:   { triggerPx: 1.0*TILE_SIZE, dmg: lv => 5  + lv*3, cd: 1200, effect: 'freeze' },
}
// 觸發效果：slow → slowUntil = now+1500；burn → burnUntil = now+3000, burnDmgPerSec=3；freeze → frozenUntil = now+1500
// 陷阱自身每次觸發 _onHitBuilding(b.id, 2)；怪死亡時走死亡掉落（killerId='trap'，dropMult elite3/boss10）
const dmg = trapDef.dmg(b.hp > 0 ? 1 : 1)   // ⚠ 等級恆為 1（升級尚未接線）
```

### 灼燒持續傷害

```typescript
for (const m of this.monsters.values()) {
  if (!m.isAlive || m.burnUntil <= nowMs) continue
  if (nowMs - m.lastBurnMs >= 1000) {
    m.lastBurnMs = nowMs
    m.takeDamage(m.burnDmgPerSec)
    if (m.hp <= 0) { /* 簡化掉落：goldReward=SIEGE_GOLD[type]、無素材掉落、killerId='trap' */ }
  }
}
```

### hitMonster 死亡掉落

```typescript
hitMonster(id, damage, attackerId): boolean {
  const m = this.monsters.get(id); if (!m || !m.isAlive) return false
  m.takeDamage(damage)
  if (m.hp <= 0) {
    const goldMap = m.kind === 'wild' ? WILD_GOLD : SIEGE_GOLD
    const dropMult = m.isBoss ? 10 : m.isElite ? 3 : 1   // ⚠ 此處 boss 先判，與 trap 區塊 elite 先判順序不同（結果相同）
    this._onDeathVisual?.(m.x, m.y, m.type)
    this._onKill?.({
      x: m.x, y: m.y,
      goldReward:  goldMap[m.type] * dropMult,
      boneDrop:    Math.random() < stats.boneDrop,
      meatDrop:    Math.random() < stats.meatDrop,
      leatherDrop: Math.random() < stats.leatherDrop,
      featherDrop: Math.random() < stats.featherDrop,
      xpReward:    stats.xpReward * dropMult,
      dungeonMapDrop: m.isBoss && Math.random() < 0.30,   // 只有 Boss 30% 掉地城地圖
    }, attackerId)
    this._remove(id); return true
  }
  return false
}
```

### applyDelta（Client 同步）

依 update 列表更新既有怪、為新 id 生成（hp>0 才生）、移除不在列表內的（順帶播死亡視覺）。

```typescript
const liveIds = new Set(updates.map(u => u.id))
for (const u of updates) {
  const ex = this.monsters.get(u.id)
  if (ex) {
    ex.hp = u.hp; if (u.maxHp !== undefined) ex.maxHp = u.maxHp
    ex.setVariantVisual(!!u.isElite, !!u.isBoss)
    ex.moveTo(u.x, u.y)
    if (u.attacking && !ex.isAttacking) ex.attackAnim()
    ex.refreshHpBar()
    if (u.attacking) ex.attackAnim()   // ⚠ attacking 時呼叫兩次（上一行+這行）
  } else if (u.hp > 0) {
    const spawned = this._spawn(u.type, u.x, u.y, u.kind ?? 'siege', u.id, !!u.isElite, !!u.isBoss)
    spawned.hp = u.hp; ...; if (u.attacking) spawned.attackAnim()
  }
}
for (const id of this.monsters.keys())
  if (!liveIds.has(id)) { /* _onDeathVisual + _remove */ }
```

## EventBus 互動

- **不直接用 EventBus**。所有跨模組溝通靠注入回呼（`_onKill / _onHitPlayer / _onHitBuilding / _onDeathVisual / _getDarkness / _isLandPos / _getBuildings`），由 Host 端整合層（main / network）接到 EventBus 或對應系統。
- TODO（CLAUDE.md）：怪物攻擊建築事件需廣播給 client，待與 event-architect 協調新事件名。

## 依賴

- `pixi.js` — container
- `./Monster` — `MonsterEntity`、`MONSTER_STATS`、`MonsterType`、`MonsterKind`
- 無 sibling 模組 import（BuildingTarget 是本檔自定的輕量介面，刻意避免 import BuildingSystem）

## 重建提示

- `tick` 順序固定（生成→despawn→陷阱→灼燒→AI→回傳 delta），順序影響同幀內死亡/掉落行為。
- 陷阱傷害 `trapDef.dmg(b.hp > 0 ? 1 : 1)`——三元兩邊都是 1，等級線尚未接通，是已知 landmine。
- 陷阱冷卻 key 是 `buildingId_monsterId`，每怪各自冷卻；不要誤用純 buildingId。
- 守城 Boss 雙重稀有：必須是 `nightCount % 5 === 0` 的夜 + 場上無 Boss + 額外 25% 機率（組生成）才出。`_spawnRandom`（單隻）版本則無 25% 限制。
- Boss 與 Elite 互斥；`_spawn` 內先判 Boss。
- despawn 用 `every`（離「所有」玩家都太遠才消失），多人時要全員都遠離。
- `applyDelta` 在 attacking 為真時會呼叫 `attackAnim()` 兩次——保留此行為避免行為漂移。
- delta 中 `kind` 缺省時 fallback `'siege'`。
- `WILD_INTERVAL`/`SIEGE_INTERVAL` 仍宣告但已廢棄（保留命名），實際用 `WILD_SPAWN_INTERVAL` 與波次系統。
- 速度與偵測距離都受 darkness 加成（速度 ×(1+darkness*0.25)，守城偵測 ×(1+darkness*0.45)）。
