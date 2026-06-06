import { describe, it, expect, beforeEach } from 'vitest'
import { GameStateManager_, PlayerStats, LevelSystem } from './GameState'
import type { PlayerData } from '@/types'

function makePlayer(id: string, overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    xp: 0,
    level: 1,
    researchLevel: 1,
    gold: 0,
    inventory: [],
    unlockedSkills: [],
    color: 0xffffff,
    ...overrides,
  }
}

describe('PlayerStats', () => {
  it('maxHp 隨等級線性成長', () => {
    expect(PlayerStats.getMaxHpByCombatLevel(1)).toBe(100)
    expect(PlayerStats.getMaxHpByCombatLevel(2)).toBe(115)
  })

  it('atk 隨等級線性成長', () => {
    expect(PlayerStats.getAtkByCombatLevel(1)).toBe(10)
    expect(PlayerStats.getAtkByCombatLevel(3)).toBe(20)
  })
})

describe('LevelSystem', () => {
  it('依 xp 推算戰鬥等級', () => {
    expect(LevelSystem.getCombatLevelFromXp(0)).toBe(0)
    expect(LevelSystem.getCombatLevelFromXp(50)).toBe(1)
    expect(LevelSystem.getCombatLevelFromXp(99)).toBe(1)
    expect(LevelSystem.getCombatLevelFromXp(100)).toBe(2)
  })

  it('依研究點數推算研究等級', () => {
    expect(LevelSystem.getResearchLevelFromResearch(0)).toBe(1)
    expect(LevelSystem.getResearchLevelFromResearch(100)).toBe(2)
    expect(LevelSystem.getResearchLevelFromResearch(99)).toBe(1)
  })
})

describe('GameStateManager 玩家資料', () => {
  beforeEach(() => {
    GameStateManager_.removePlayer('test-player')
  })

  it('setPlayer / getPlayer 能存取玩家', () => {
    const p = makePlayer('test-player', { gold: 0 })
    GameStateManager_.setPlayer('test-player', p)
    expect(GameStateManager_.getPlayer('test-player')?.gold).toBe(0)
  })

  it('金幣是權威狀態，更新後可被讀回（存檔讀的就是這份）', () => {
    const p = makePlayer('test-player', { gold: 0 })
    GameStateManager_.setPlayer('test-player', p)

    // 模擬遊戲中賣東西 / 殺怪：在 GameState 上累加金幣
    const live = GameStateManager_.getPlayer('test-player')!
    live.gold += 250
    GameStateManager_.setPlayer('test-player', live)

    // handleSave 會從這裡取 gold —— 應為 250 而非初始 0
    expect(GameStateManager_.getPlayer('test-player')?.gold).toBe(250)
  })

  it('removePlayer 後查不到玩家', () => {
    GameStateManager_.setPlayer('test-player', makePlayer('test-player'))
    GameStateManager_.removePlayer('test-player')
    expect(GameStateManager_.getPlayer('test-player')).toBeUndefined()
  })

  it('incrementTick 累加 tick', () => {
    const before = GameStateManager_.get().tick
    GameStateManager_.incrementTick()
    expect(GameStateManager_.get().tick).toBe(before + 1)
  })
})
