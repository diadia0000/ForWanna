// Agent 1 負責 — src/core/GameState.ts
import type { GameState, PlayerId, PlayerData, WorldData } from '@/types'

// ── 升級系統常數 ──────────────────────────────────────────────────
const COMBAT_LEVEL_THRESHOLDS = [0, 50, 100, 150, 200, 250, 300, 350, 400, 500, 650, 850, 1100, 1400, 1750, 2150, 2650, 3200, 3850, 4600, 5500]
const RESEARCH_LEVEL_THRESHOLDS = [0, 0, 100, 200, 400, 800, 1200, 1800, 2500, 3500, 5000]

// ── 屬性成長公式 ────────────────────────────────────────────────
export const PlayerStats = {
  getMaxHpByCombatLevel(level: number): number {
    return 100 + (level - 1) * 15
  },
  getAtkByCombatLevel(level: number): number {
    return 10 + (level - 1) * 5
  },
  getDefByCombatLevel(level: number): number {
    return 0 + (level - 1) * 0.02
  },
}

// ── 升級邏輯 ────────────────────────────────────────────────────
export const LevelSystem = {
  getCombatLevelFromXp(xp: number): number {
    for (let i = COMBAT_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= COMBAT_LEVEL_THRESHOLDS[i]) return i
    }
    return 1
  },
  getXpForCombatLevel(level: number): number {
    return COMBAT_LEVEL_THRESHOLDS[Math.min(level, COMBAT_LEVEL_THRESHOLDS.length - 1)]
  },
  getResearchLevelFromResearch(research: number): number {
    for (let i = RESEARCH_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (research >= RESEARCH_LEVEL_THRESHOLDS[i]) return i
    }
    return 1
  },
  getResearchPointsForLevel(level: number): number {
    return RESEARCH_LEVEL_THRESHOLDS[Math.min(level, RESEARCH_LEVEL_THRESHOLDS.length - 1)]
  },
}

class GameStateManager {
  private state: GameState = {
    tick: 0,
    players: {},
    world: {
      seed: 0,
      chunks: [],
      resources: [],
      buildings: [],
      createdAt: Date.now(),
    },
    hostId: '',
  }

  get(): GameState {
    return this.state
  }

  set(newState: GameState): void {
    this.state = newState
  }

  applyDelta(delta: Partial<GameState>): void {
    this.state = { ...this.state, ...delta }
  }

  getPlayer(id: PlayerId): PlayerData | undefined {
    return this.state.players[id]
  }

  setPlayer(id: PlayerId, data: PlayerData): void {
    this.state.players[id] = data
  }

  removePlayer(id: PlayerId): void {
    delete this.state.players[id]
  }

  getWorld(): WorldData {
    return this.state.world
  }

  setWorld(world: WorldData): void {
    this.state.world = world
  }

  incrementTick(): void {
    this.state.tick++
  }

  isHost(playerId: PlayerId): boolean {
    return this.state.hostId === playerId
  }
}

export const GameStateManager_ = new GameStateManager()
