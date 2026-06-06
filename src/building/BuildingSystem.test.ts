import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('pixi.js', () => ({}))

import { GameStateManager_ } from '@/core/GameState'
import { Inventory } from '@/inventory'
import { BuildingSystem } from './BuildingSystem'

const playerId = 'p1'

function resetState(): void {
  GameStateManager_.set({
    tick: 0,
    players: {},
    hostId: playerId,
    world: {
      seed: 1,
      chunks: [],
      resources: [],
      buildings: [],
      createdAt: 1,
    },
  })
  Inventory.setInventory(playerId, [
    { itemId: 'wood', amount: 999 },
    { itemId: 'stone', amount: 999 },
    { itemId: 'iron', amount: 999 },
  ])
}

describe('BuildingSystem placement collision', () => {
  beforeEach(() => {
    resetState()
  })

  it('blocks a larger building whose corner overlaps an existing furnace', () => {
    GameStateManager_.getWorld().buildings.push({
      id: 'furnace-existing',
      defId: 'furnace',
      x: 96,
      y: 96,
      ownerId: playerId,
      placedAt: 1,
      level: 1,
      hp: 100,
      maxHp: 100,
    })

    const system = new BuildingSystem({ addChild: vi.fn() } as any)

    expect(system.canPlace('market', 48, 48, playerId)).toBe(false)
    expect(system.canPlace('market', 144, 96, playerId)).toBe(true)
  })
})
