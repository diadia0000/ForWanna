// src/combat/MonsterSpawner.ts — 野怪 / 守城怪 + 難度系統

import * as PIXI from 'pixi.js'
import { MONSTER_STATS, MonsterEntity, MonsterKind, MonsterType } from './Monster'

const TILE_SIZE = 48

// ── 難度配置 ──────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard'
export type MonsterSpawnCategory = 'wild' | 'siege' | 'elite' | 'boss'

/** 難度修正值，相對 MONSTER_STATS 的乘數 */
const DIFF_MULT: Record<Difficulty, { hp: number; dmg: number; speed: number; atkCD: number }> = {
  easy:   { hp: 0.7,  dmg: 0.8,  speed: 0.85, atkCD: 1.4 },
  normal: { hp: 1.0,  dmg: 1.0,  speed: 1.0,  atkCD: 1.0 },
  hard:   { hp: 1.6,  dmg: 1.4,  speed: 1.2,  atkCD: 0.7 },
}

/** 金幣掉落（調低後的數值） */
const MONSTER_TYPES = Object.keys(MONSTER_STATS) as MonsterType[]
const WILD_GOLD = Object.fromEntries(
  MONSTER_TYPES.map(type => [type, Math.max(1, Math.round(MONSTER_STATS[type].goldReward * 0.45))]),
) as Record<MonsterType, number>
const SIEGE_GOLD = Object.fromEntries(
  MONSTER_TYPES.map(type => [type, Math.max(2, Math.round(MONSTER_STATS[type].goldReward * 0.75))]),
) as Record<MonsterType, number>

type MonsterSpawnWeight = { type: MonsterType; weight: number }
type MonsterSpawnPivot = { x: number; y: number; id: string }

const DAY_WILD_SPAWNS: MonsterSpawnWeight[] = [
  { type: 'slime', weight: 28 },
  { type: 'slime_blue', weight: 18 },
  { type: 'giant_frog', weight: 10 },
  { type: 'giant_frog_2', weight: 7 },
  { type: 'goblin', weight: 18 },
  { type: 'goblin_rogue', weight: 8 },
  { type: 'giant_raccoon', weight: 7 },
  { type: 'giant_slime', weight: 4 },
]

const NIGHT_WILD_SPAWNS: MonsterSpawnWeight[] = [
  { type: 'slime', weight: 14 },
  { type: 'slime_blue', weight: 12 },
  { type: 'giant_slime', weight: 8 },
  { type: 'giant_flame', weight: 5 },
  { type: 'goblin', weight: 18 },
  { type: 'goblin_rogue', weight: 10 },
  { type: 'goblin_shaman', weight: 8 },
  { type: 'skeleton', weight: 14 },
  { type: 'skeleton_rogue', weight: 6 },
  { type: 'tengu_blue', weight: 5 },
]

const DAY_SIEGE_SPAWNS: MonsterSpawnWeight[] = [
  { type: 'slime', weight: 18 },
  { type: 'slime_blue', weight: 14 },
  { type: 'goblin', weight: 24 },
  { type: 'goblin_rogue', weight: 12 },
  { type: 'goblin_warrior', weight: 10 },
  { type: 'giant_raccoon', weight: 8 },
  { type: 'giant_slime', weight: 8 },
  { type: 'giant_frog_2', weight: 6 },
]

const NIGHT_SIEGE_SPAWNS: MonsterSpawnWeight[] = [
  { type: 'slime', weight: 8 },
  { type: 'slime_blue', weight: 7 },
  { type: 'giant_slime', weight: 7 },
  { type: 'giant_flame', weight: 5 },
  { type: 'giant_spirit', weight: 4 },
  { type: 'goblin', weight: 14 },
  { type: 'goblin_shaman', weight: 9 },
  { type: 'goblin_warrior', weight: 10 },
  { type: 'skeleton', weight: 14 },
  { type: 'skeleton_mage', weight: 8 },
  { type: 'skeleton_warrior', weight: 6 },
  { type: 'tengu_blue', weight: 4 },
  { type: 'tengu_red', weight: 2 },
  { type: 'giant_raccoon_gold', weight: 2 },
]

const BOSS_SPAWNS: MonsterType[] = [
  'giant_blue_samurai',
  'giant_red_samurai',
  'tengu_red',
  'skeleton_warrior',
  'giant_raccoon_gold',
]

function pickWeightedMonster(table: MonsterSpawnWeight[]): MonsterType {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = Math.random() * total
  for (const entry of table) {
    roll -= entry.weight
    if (roll <= 0) return entry.type
  }
  return table[table.length - 1]?.type ?? 'slime'
}

// ── 生怪間隔 ─────────────────────────────────────────────────────

const WILD_INTERVAL   = 8000     // 8s 一隻野怪（保留未使用但維持命名）
const SIEGE_INTERVAL  = 6000     // 已廢棄，改為波次系統
const MAX_WILD   = 8
const MAX_SIEGE  = 20            // 波次系統允許稍高上限
const SPAWN_R_MIN = 9
const SPAWN_R_MAX = 13
const SPAWN_ATTEMPTS = 96
const SPAWN_FALLBACK_R_MIN = 4
const SPAWN_FALLBACK_R_MAX = SPAWN_R_MIN
const DESPAWN_R   = 22
const WILD_SPAWN_INTERVAL  = 9500
// 守城波次：每波間隔 10–30 秒隨機
const SIEGE_WAVE_MIN = 10_000
const SIEGE_WAVE_MAX = 30_000

export interface MonsterDrop {
  x: number; y: number
  goldReward:  number
  boneDrop:    boolean
  meatDrop:    boolean
  leatherDrop: boolean
  featherDrop: boolean
  xpReward:    number
  dungeonMapDrop: boolean
}

export interface MonsterDelta {
  id: string; type: string; hp: number; maxHp?: number; x: number; y: number; kind: string
  isElite?: boolean
  isBoss?: boolean
  attacking?: boolean
}

// ── 建築目標資訊（輕量介面，避免直接 import BuildingSystem） ──────
export interface BuildingTarget {
  id: string
  defId: string
  x: number
  y: number
  sizeX: number   // tile 數量
  sizeY: number
  hp: number
}

// 陷阱定義（觸發距離、傷害、效果） ─────────────────────────────────
const TRAP_DEF: Record<string, { triggerPx: number; dmg: (lv: number) => number; cd: number; effect: 'slow' | 'burn' | 'freeze' }> = {
  spike_trap: { triggerPx: 0.8 * TILE_SIZE, dmg: lv => 10 + lv * 5,  cd: 1000, effect: 'slow'   },
  fire_trap:  { triggerPx: 1.0 * TILE_SIZE, dmg: lv => 8  + lv * 4,  cd: 800,  effect: 'burn'   },
  ice_trap:   { triggerPx: 1.0 * TILE_SIZE, dmg: lv => 5  + lv * 3,  cd: 1200, effect: 'freeze' },
}

// 守城怪優先攻擊的建築 ID 類型（優先級順序）
const SIEGE_TARGET_PRIORITY = ['base_core', 'barracks', 'tower', 'wall', 'spike_trap', 'fire_trap', 'ice_trap']

export class MonsterSpawner {
  private monsters:     Map<string, MonsterEntity> = new Map()
  private container:    PIXI.Container
  private lastWildMs:   number = 0
  private _siegeNextWaveAt: number = 0   // 下一波守城怪的觸發時間（ms）
  private _counter:     number = 0
  // 陷阱冷卻追蹤（buildingId → 下次可觸發的時間 ms）
  private _trapCooldown: Map<string, number> = new Map()

  // 難度 + 夜晚計數
  private _difficulty:  Difficulty = 'normal'
  private _nightCount:  number = 0
  private _playerRing:  number = 0   // 玩家目前所在環

  // 回呼（Host 專用）
  private _onKill?:          (drop: MonsterDrop, killerId: string) => void
  private _onHitPlayer?:     (playerId: string, damage: number) => void
  private _onDeathVisual?:   (x: number, y: number, type: MonsterType) => void
  private _getDarkness?:     () => number
  private _isLandPos?:       (x: number, y: number) => boolean
  private _getBuildings?:    () => BuildingTarget[]
  private _onHitBuilding?:   (buildingId: string, damage: number) => void

  constructor(container: PIXI.Container) { this.container = container }

  setKillCallback(fn: (drop: MonsterDrop, killerId: string) => void)  { this._onKill = fn }
  setHitPlayerCallback(fn: (pid: string, dmg: number) => void)        { this._onHitPlayer = fn }
  setDeathVisualCallback(fn: (x: number, y: number, type: MonsterType) => void) { this._onDeathVisual = fn }
  setDarknessGetter(fn: () => number)                                  { this._getDarkness = fn }
  setLandPosChecker(fn: (x: number, y: number) => boolean)            { this._isLandPos = fn }
  /** 注入：取得當前所有可攻擊建築列表（Host 每幀提供） */
  setGetBuildings(fn: () => BuildingTarget[])                          { this._getBuildings = fn }
  /** 注入：建築被怪物擊中時呼叫（Host 端 → BuildingSystem.takeDamage） */
  setHitBuildingCallback(fn: (buildingId: string, damage: number) => void) { this._onHitBuilding = fn }
  setDifficulty(d: Difficulty)    { this._difficulty = d }
  setNightCount(n: number)        { this._nightCount = n }
  setPlayerRing(r: number)        { this._playerRing = r }

  get count(): number { return this.monsters.size }
  getAllMonsters(): MonsterEntity[] { return [...this.monsters.values()] }
  getMonster(id: string): MonsterEntity | undefined { return this.monsters.get(id) }

  spawnEntity(
    type: MonsterType,
    category: MonsterSpawnCategory,
    players: MonsterSpawnPivot[],
    forceId?: string,
  ): MonsterEntity | null {
    if (!MONSTER_STATS[type]) throw new Error(`Unknown monster type: ${type}`)
    const pos = this._findSpawnPosition(players)
    if (!pos) return null
    const kind: MonsterKind = category === 'wild' ? 'wild' : 'siege'
    return this._spawn(type, pos.x, pos.y, kind, forceId, category === 'elite', category === 'boss')
  }

  update(delta: number): void {
    for (const monster of this.monsters.values()) monster.update(delta)
  }

  // ── 是否允許守城怪生成 ─────────────────────────────────────────

  private _canSpawnSiege(): boolean {
    switch (this._difficulty) {
      case 'easy':   return this._playerRing >= 2          // 玩家到第 2 環才生守城怪
      case 'normal': return this._nightCount >= 5           // 5 夜後
      case 'hard':   return this._nightCount >= 2           // 2 夜後
    }
  }

  // ── Host 每幀呼叫 ───────────────────────────────────────────────

  tick(
    nowMs: number,
    players: Map<string, { x: number; y: number; id: string }>,
  ): MonsterDelta[] {
    const darkness  = this._getDarkness?.() ?? 0
    const isNight   = darkness > 0.3
    const playerArr = [...players.values()]
    if (playerArr.length === 0) return []

    // ── 野怪生成（日夜都有，但夜晚略快） ────────────────────────
    const wildInterval = isNight ? WILD_SPAWN_INTERVAL * 0.75 : WILD_SPAWN_INTERVAL
    const wildCount    = [...this.monsters.values()].filter(m => m.kind === 'wild').length
    if (nowMs - this.lastWildMs > wildInterval && wildCount < MAX_WILD) {
      this.lastWildMs = nowMs
      this._spawnRandom(playerArr, 'wild', isNight)
    }

    // ── 守城怪生成（波次系統：每波 1-3 組，每組 2-4 隻，間隔 10-30 秒隨機） ──
    const siegeCount = [...this.monsters.values()].filter(m => m.kind === 'siege').length
    if (isNight && this._canSpawnSiege() && nowMs >= this._siegeNextWaveAt && siegeCount < MAX_SIEGE) {
      // 滾下一波的等待時間
      this._siegeNextWaveAt = nowMs + SIEGE_WAVE_MIN + Math.random() * (SIEGE_WAVE_MAX - SIEGE_WAVE_MIN)
      // 1~3 組
      const numGroups = 1 + Math.floor(Math.random() * 3)
      for (let g = 0; g < numGroups; g++) {
        this._spawnSiegeGroup(playerArr, isNight, 1 + Math.floor(Math.random() * 5))
      }
    }

    // ── 消失（離所有玩家太遠） ──────────────────────────────────
    const despawnR2 = (DESPAWN_R * TILE_SIZE) ** 2
    for (const [id, m] of this.monsters) {
      const tooFar = playerArr.every(p => {
        const dx = p.x - m.x, dy = p.y - m.y
        return dx * dx + dy * dy > despawnR2
      })
      if (tooFar) this._remove(id)
    }

    // ── 陷阱碰撞（Host 端） ─────────────────────────────────────
    if (this._getBuildings) {
      const buildings = this._getBuildings()
      for (const m of this.monsters.values()) {
        if (!m.isAlive) continue
        for (const b of buildings) {
          const trapDef = TRAP_DEF[b.defId]
          if (!trapDef) continue
          if (b.hp <= 0) continue   // 已損壞（透明），不觸發
          const cx = b.x + b.sizeX * TILE_SIZE / 2
          const cy = b.y + b.sizeY * TILE_SIZE / 2
          const dist = Math.hypot(m.x - cx, m.y - cy)
          if (dist > trapDef.triggerPx) continue
          const cooldownKey = `${b.id}_${m.id}`
          if ((this._trapCooldown.get(cooldownKey) ?? 0) > nowMs) continue
          // 觸發！
          this._trapCooldown.set(cooldownKey, nowMs + trapDef.cd)
          const dmg = trapDef.dmg(b.hp > 0 ? 1 : 1)  // 等級暫用 1（升級後傳入）
          m.takeDamage(dmg)
          // 應用效果
          switch (trapDef.effect) {
            case 'slow':
              m.slowUntil = nowMs + 1500
              break
            case 'burn':
              m.burnUntil = nowMs + 3000
              m.burnDmgPerSec = 3
              break
            case 'freeze':
              m.frozenUntil = nowMs + 1500
              break
          }
          // 陷阱自身受損（每次觸發消耗 2 HP）
          this._onHitBuilding?.(b.id, 2)
          // 若怪物死亡，補獎勵
          if (m.hp <= 0) {
            const stats = MONSTER_STATS[m.type]
            const goldMap = m.kind === 'wild' ? WILD_GOLD : SIEGE_GOLD
            const dropMult = m.isElite ? 3 : m.isBoss ? 10 : 1
            this._onDeathVisual?.(m.x, m.y, m.type)
            this._onKill?.({
              x: m.x, y: m.y,
              goldReward:  goldMap[m.type] * dropMult,
              boneDrop:    Math.random() < stats.boneDrop,
              meatDrop:    Math.random() < stats.meatDrop,
              leatherDrop: Math.random() < stats.leatherDrop,
              featherDrop: Math.random() < stats.featherDrop,
              xpReward:    stats.xpReward * dropMult,
              dungeonMapDrop: false,
            }, 'trap')
            this._remove(m.id)
          }
        }
      }
    }

    // ── 灼燒持續傷害 ─────────────────────────────────────────
    for (const m of this.monsters.values()) {
      if (!m.isAlive || m.burnUntil <= nowMs) continue
      if (nowMs - m.lastBurnMs >= 1000) {
        m.lastBurnMs = nowMs
        m.takeDamage(m.burnDmgPerSec)
        if (m.hp <= 0) {
          const stats = MONSTER_STATS[m.type]
          this._onDeathVisual?.(m.x, m.y, m.type)
          this._onKill?.({ x: m.x, y: m.y, goldReward: SIEGE_GOLD[m.type], boneDrop: false, meatDrop: false, leatherDrop: false, featherDrop: false, xpReward: stats.xpReward, dungeonMapDrop: false }, 'trap')
          this._remove(m.id)
        }
      }
    }

    // ── AI ──────────────────────────────────────────────────────
    for (const m of this.monsters.values()) {
      if (m.isAlive) this._ai(m, playerArr, nowMs, darkness)
    }

    return [...this.monsters.values()].map(m => ({
      id: m.id, type: m.type, hp: m.hp, maxHp: m.maxHp, x: m.x, y: m.y, kind: m.kind,
      isElite: m.isElite,
      isBoss: m.isBoss,
      attacking: m.isAttacking,
    }))
  }

  // ── 守城波次：一組 N 隻，集群出現在同一個方向 ──────────────────

  private _spawnSiegeGroup(
    players: Array<{ x: number; y: number; id: string }>,
    isNight: boolean,
    count: number,
  ): void {
    const groupPos = this._findSpawnPosition(players)
    if (!groupPos) return
    const gx = groupPos.x
    const gy = groupPos.y

    // 這組的怪物類型（同組通常同種，偶爾混搭）
    let type = pickWeightedMonster(isNight ? NIGHT_SIEGE_SPAWNS : DAY_SIEGE_SPAWNS)

    const eliteChance = Math.min(0.05 + this._nightCount * 0.02, 0.40)
    const isElite = Math.random() < eliteChance
    const isBoss  = this._nightCount > 0 && this._nightCount % 5 === 0
      && [...this.monsters.values()].filter(m => m.isBoss).length === 0
      && Math.random() < 0.25   // Boss 只在波次中 25% 機率出現（不是每隻都是 Boss）

    if (isBoss) type = BOSS_SPAWNS[Math.floor(Math.random() * BOSS_SPAWNS.length)] ?? type

    const SPREAD = TILE_SIZE * 2   // 同組怪物集群半徑
    for (let i = 0; i < count; i++) {
      const mx = gx + (Math.random() - 0.5) * SPREAD
      const my = gy + (Math.random() - 0.5) * SPREAD
      // 每組只有一隻可能是 Boss（第一隻），其餘正常
      this._spawn(type, mx, my, 'siege', undefined, isElite, isBoss && i === 0)
    }
  }

  // ── 生成單隻怪物 ────────────────────────────────────────────────

  private _spawnRandom(
    players: Array<{ x: number; y: number; id: string }>,
    kind: MonsterKind,
    isNight: boolean,
  ): void {
    const pos = this._findSpawnPosition(players)
    if (!pos) return

    let type = pickWeightedMonster(
      isNight
        ? kind === 'wild' ? NIGHT_WILD_SPAWNS : NIGHT_SIEGE_SPAWNS
        : kind === 'wild' ? DAY_WILD_SPAWNS : DAY_SIEGE_SPAWNS,
    )

    // ── 菁英怪機率（夜數越多越高，最多 40%） ───────────────
    const eliteChance = Math.min(0.05 + this._nightCount * 0.02, 0.40)
    const isElite = kind === 'siege' && Math.random() < eliteChance

    // ── Boss 怪（守城每 5 波必出，用 _nightCount 計算） ─────
    const isBoss = kind === 'siege' && this._nightCount > 0 && this._nightCount % 5 === 0
      && [...this.monsters.values()].filter(m => m.isBoss).length === 0
    if (isBoss) type = BOSS_SPAWNS[Math.floor(Math.random() * BOSS_SPAWNS.length)] ?? type

    this._spawn(type, pos.x, pos.y, kind, undefined, isElite, isBoss)
  }

  private _findSpawnPosition(players: MonsterSpawnPivot[]): { x: number; y: number } | null {
    if (players.length === 0) return null

    const tryFind = (minRadius: number, maxRadius: number, attempts: number) => {
      const pivotStart = Math.floor(Math.random() * players.length)
      const radiusRange = Math.max(0, maxRadius - minRadius)
      for (let attempt = 0; attempt < attempts; attempt++) {
        const pivot = players[(pivotStart + attempt) % players.length]
        if (!pivot) continue
        const angle = Math.random() * Math.PI * 2
        const dist  = (minRadius + Math.random() * radiusRange) * TILE_SIZE
        const x = pivot.x + Math.cos(angle) * dist
        const y = pivot.y + Math.sin(angle) * dist
        if (!this._isLandPos || this._isLandPos(x, y)) return { x, y }
      }
      return null
    }

    return tryFind(SPAWN_R_MIN, SPAWN_R_MAX, SPAWN_ATTEMPTS)
      ?? tryFind(SPAWN_FALLBACK_R_MIN, SPAWN_FALLBACK_R_MAX, Math.floor(SPAWN_ATTEMPTS / 2))
  }

  // ── AI ──────────────────────────────────────────────────────────

  private _ai(
    m: MonsterEntity,
    players: Array<{ x: number; y: number; id: string }>,
    nowMs: number,
    darkness: number,
  ): void {
    const stats  = MONSTER_STATS[m.type]
    const diff   = DIFF_MULT[this._difficulty]
    const atkCD  = stats.attackCooldown * diff.atkCD
    const speed  = m.speed * diff.speed * (1 + darkness * 0.25)
    const atkR   = stats.attackRange * TILE_SIZE
    const effectiveSpeed = m.frozenUntil > nowMs ? 0
      : m.slowUntil > nowMs ? speed * 0.5
      : speed

    // 找最近玩家
    let nearest: { x: number; y: number; id: string } | null = null
    let nearDist = Infinity
    for (const p of players) {
      const d = Math.hypot(p.x - m.x, p.y - m.y)
      if (d < nearDist) { nearDist = d; nearest = p }
    }

    if (m.kind === 'wild') {
      // 野怪：只在 2 格內才觸發，否則站原地
      const AGGRO_R = 2.2 * TILE_SIZE
      if (nearest && nearDist < AGGRO_R) {
        if (nearDist < atkR) {
          m.aiState = 'attack'; m.targetId = nearest.id
          if (nowMs - m.lastAttackMs > atkCD) {
            m.lastAttackMs = nowMs
            m.attackAnim()
            this._onHitPlayer?.(nearest.id, stats.damage * diff.dmg)
          }
        } else {
          // 面向玩家但不追擊（野怪只轉身）
          m.aiState  = 'chase'
          m.targetId = nearest.id
          m.facingLeft = nearest.x < m.x
        }
      } else {
        m.aiState = 'idle'; m.targetId = null
      }
    } else {
      // 守城怪：優先攻擊建築（base_core > barracks > 城牆 > 陷阱），次之追人
      // ── 找最近的可攻擊建築（依優先級） ──────────────────────
      let bestBuilding: { id: string; x: number; y: number; dist: number } | null = null
      if (this._getBuildings) {
        const buildings = this._getBuildings().filter(b => b.hp > 0)
        // 先找最高優先級的建築
        for (const priorityId of SIEGE_TARGET_PRIORITY) {
          const inPriority = buildings.filter(b => b.defId === priorityId)
          if (inPriority.length === 0) continue
          let closest = inPriority[0]
          let closestDist = Math.hypot(closest.x + closest.sizeX * TILE_SIZE / 2 - m.x, closest.y + closest.sizeY * TILE_SIZE / 2 - m.y)
          for (let i = 1; i < inPriority.length; i++) {
            const b = inPriority[i]
            const d = Math.hypot(b.x + b.sizeX * TILE_SIZE / 2 - m.x, b.y + b.sizeY * TILE_SIZE / 2 - m.y)
            if (d < closestDist) { closest = b; closestDist = d }
          }
          bestBuilding = { id: closest.id, x: closest.x + closest.sizeX * TILE_SIZE / 2, y: closest.y + closest.sizeY * TILE_SIZE / 2, dist: closestDist }
          break
        }
      }

      if (bestBuilding) {
        m.targetBuildingId = bestBuilding.id
        m.targetId = null
        if (bestBuilding.dist < atkR + TILE_SIZE * 0.5) {
          m.aiState = 'attack'
          if (nowMs - m.lastAttackMs > atkCD) {
            m.lastAttackMs = nowMs
            m.attackAnim()
            this._onHitBuilding?.(bestBuilding.id, Math.round(stats.damage * diff.dmg))
          }
        } else {
          m.aiState = 'chase'
          const dx = bestBuilding.x - m.x, dy = bestBuilding.y - m.y
          const len = Math.hypot(dx, dy)
          if (len > 0 && effectiveSpeed > 0) m.moveTo(m.x + (dx / len) * effectiveSpeed, m.y + (dy / len) * effectiveSpeed)
        }
      } else {
        // 無建築目標 → 追最近玩家
        m.targetBuildingId = null
        const detect = stats.detectRange * TILE_SIZE * (1 + darkness * 0.45)
        if (nearest && nearDist < detect) {
          if (nearDist < atkR) {
            m.aiState = 'attack'; m.targetId = nearest.id
            if (nowMs - m.lastAttackMs > atkCD) {
              m.lastAttackMs = nowMs
              m.attackAnim()
              this._onHitPlayer?.(nearest.id, stats.damage * diff.dmg)
            }
          } else {
            m.aiState = 'chase'; m.targetId = nearest.id
            const dx = nearest.x - m.x, dy = nearest.y - m.y
            const len = Math.hypot(dx, dy)
            if (len > 0 && effectiveSpeed > 0) m.moveTo(m.x + (dx / len) * effectiveSpeed, m.y + (dy / len) * effectiveSpeed)
          }
        } else {
          m.targetId = null; m.aiState = 'wander'
          if (!m.wanderTarget || Math.hypot(m.x - m.wanderTarget.x, m.y - m.wanderTarget.y) < 8) {
            m.idleTimer++
            if (m.idleTimer > 80 + Math.random() * 60) {
              m.idleTimer = 0
              const a = Math.random() * Math.PI * 2
              const r = (2 + Math.random() * 3) * TILE_SIZE
              m.wanderTarget = { x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r }
            }
          }
          if (m.wanderTarget && effectiveSpeed > 0) {
            const dx = m.wanderTarget.x - m.x, dy = m.wanderTarget.y - m.y
            const len = Math.hypot(dx, dy)
            if (len > 2) m.moveTo(m.x + (dx / len) * effectiveSpeed * 0.45, m.y + (dy / len) * effectiveSpeed * 0.45)
          }
        }
      }
    }
  }

  // ── 攻擊判定（Host 呼叫） ────────────────────────────────────────

  hitMonster(id: string, damage: number, attackerId: string): boolean {
    const m = this.monsters.get(id)
    if (!m || !m.isAlive) return false
    m.takeDamage(damage)
    if (m.hp <= 0) {
      const stats      = MONSTER_STATS[m.type]
      const goldMap    = m.kind === 'wild' ? WILD_GOLD : SIEGE_GOLD
      const dropMult   = m.isBoss ? 10 : m.isElite ? 3 : 1
      this._onDeathVisual?.(m.x, m.y, m.type)
      this._onKill?.({
        x: m.x, y: m.y,
        goldReward:  goldMap[m.type] * dropMult,
        boneDrop:    Math.random() < stats.boneDrop,
        meatDrop:    Math.random() < stats.meatDrop,
        leatherDrop: Math.random() < stats.leatherDrop,
        featherDrop: Math.random() < stats.featherDrop,
        xpReward:    stats.xpReward * dropMult,
        dungeonMapDrop: m.isBoss && Math.random() < 0.30,
      }, attackerId)
      this._remove(id)
      return true
    }
    return false
  }

  // ── Client 端同步 ────────────────────────────────────────────────

  applyDelta(updates: MonsterDelta[]): void {
    const liveIds = new Set(updates.map(u => u.id))
    for (const u of updates) {
      const ex = this.monsters.get(u.id)
      if (ex) {
        ex.hp = u.hp
        if (u.maxHp !== undefined) ex.maxHp = u.maxHp
        ex.setVariantVisual(!!u.isElite, !!u.isBoss)
        ex.moveTo(u.x, u.y)
        if (u.attacking && !ex.isAttacking) ex.attackAnim()
        ex.refreshHpBar()
        if (u.attacking) ex.attackAnim()
      } else if (u.hp > 0) {
        const spawned = this._spawn(u.type as MonsterType, u.x, u.y, (u.kind ?? 'siege') as MonsterKind, u.id, !!u.isElite, !!u.isBoss)
        spawned.hp = u.hp
        if (u.maxHp !== undefined) spawned.maxHp = u.maxHp
        spawned.refreshHpBar()
        if (u.attacking) spawned.attackAnim()
      }
    }
    for (const id of this.monsters.keys()) {
      if (!liveIds.has(id)) {
        const monster = this.monsters.get(id)
        if (monster) this._onDeathVisual?.(monster.x, monster.y, monster.type)
        this._remove(id)
      }
    }
  }

  // ── 內部 ────────────────────────────────────────────────────────

  private _spawn(
    type: MonsterType, x: number, y: number, kind: MonsterKind,
    forceId?: string, isElite = false, isBoss = false,
  ): MonsterEntity {
    const id = forceId ?? `m_${Date.now()}_${this._counter++}`
    const m  = new MonsterEntity(id, type, x, y)
    m.kind   = kind
    // ── 環數 × 夜數等級縮放 ─────────────────────────────
    const monsterLevel = Math.max(1, Math.floor(this._playerRing * 2 + this._nightCount * 0.5))
    const levelScale   = 1 + (monsterLevel - 1) * 0.18   // 每等級 +18% HP/ATK
    // ── 難度乘數 ────────────────────────────────────────
    const d = DIFF_MULT[this._difficulty]
    let hpMult  = d.hp  * levelScale
    let dmgMult = d.dmg * levelScale
    let spdMult = d.speed
    // ── 菁英/Boss 加成 ──────────────────────────────────
    if (isBoss) {
      hpMult  *= 10; dmgMult *= 3; spdMult *= 0.8
      m.isBoss = true; m.isElite = false
    } else if (isElite) {
      hpMult  *= 3; dmgMult *= 2; spdMult *= 1.5
      m.isElite = true
    }
    m.hp    = Math.round(m.hp    * hpMult)
    m.maxHp = Math.round(m.maxHp * hpMult)
    m.damage = m.damage * dmgMult
    m.speed  = m.speed  * spdMult
    m.baseSpeed = m.speed
    // Boss/Elite 視覺：縮放 sprite
    m.setVariantVisual(m.isElite, m.isBoss)
    m.refreshHpBar()
    this.monsters.set(id, m)
    this.container.addChild(m.sprite)
    return m
  }

  private _remove(id: string): void {
    const m = this.monsters.get(id)
    if (!m) return
    m.destroy()
    this.monsters.delete(id)
  }
}
