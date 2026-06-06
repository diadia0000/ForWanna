import { describe, it, expect, beforeEach } from 'vitest'
import { CraftingSystem } from './CraftingSystem'
import { Inventory } from './Inventory'
import { GameStateManager_ } from '@/core/GameState'
import type { PlayerData } from '@/types'

// ── helpers ─────────────────────────────────────────────────────────────────

function makePlayer(id: string, overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id,
    name: 'test',
    x: 0, y: 0,
    hp: 100, maxHp: 100,
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

const crafting = new CraftingSystem()

// ── tests ────────────────────────────────────────────────────────────────────

describe('CraftingSystem.canCraft — unlock gate uses researchLevel', () => {
  // Regression: commit 36e8200 fixed using `level` instead of `researchLevel`.
  // The tests below ensure we never revert to reading the wrong field.

  beforeEach(() => {
    GameStateManager_.setPlayer('cs-1', makePlayer('cs-1'))
    GameStateManager_.setPlayer('cs-2', makePlayer('cs-2'))
    GameStateManager_.setPlayer('cs-3', makePlayer('cs-3'))
    GameStateManager_.setPlayer('cs-4', makePlayer('cs-4'))
  })

  it('REGRESSION: high level but low researchLevel cannot craft unlockLevel-2 recipe', () => {
    // Before the fix, `level=99` would incorrectly satisfy the unlock check.
    GameStateManager_.setPlayer('cs-1', makePlayer('cs-1', { level: 99, researchLevel: 1 }))
    Inventory.add('cs-1', 'berry', 10)

    expect(crafting.canCraft('cs-1', 'bread')).toBe(false)
  })

  it('researchLevel=1 with materials cannot craft unlockLevel-2 recipe', () => {
    GameStateManager_.setPlayer('cs-2', makePlayer('cs-2', { level: 1, researchLevel: 1 }))
    Inventory.add('cs-2', 'berry', 10)

    expect(crafting.canCraft('cs-2', 'bread')).toBe(false)
  })

  it('researchLevel=2 with materials can craft unlockLevel-2 recipe', () => {
    GameStateManager_.setPlayer('cs-3', makePlayer('cs-3', { level: 1, researchLevel: 2 }))
    Inventory.add('cs-3', 'berry', 10)

    expect(crafting.canCraft('cs-3', 'bread')).toBe(true)
  })

  it('researchLevel=2 but missing materials cannot craft', () => {
    GameStateManager_.setPlayer('cs-4', makePlayer('cs-4', { level: 1, researchLevel: 2 }))
    // no items added

    expect(crafting.canCraft('cs-4', 'bread')).toBe(false)
  })
})

describe('CraftingSystem.canCraft — basic level-1 recipes', () => {
  it('researchLevel=1 with wood can craft plank', () => {
    const pid = 'cs-basic-a'
    GameStateManager_.setPlayer(pid, makePlayer(pid, { researchLevel: 1 }))
    Inventory.add(pid, 'wood', 10)
    expect(crafting.canCraft(pid, 'plank')).toBe(true)
  })

  it('researchLevel=1 without enough wood cannot craft plank', () => {
    // plank requires 2 wood; fresh player has none
    const pid = 'cs-basic-b'
    GameStateManager_.setPlayer(pid, makePlayer(pid, { researchLevel: 1 }))
    expect(crafting.canCraft(pid, 'plank')).toBe(false)
  })

  it('unknown recipeId returns false', () => {
    const pid = 'cs-basic-c'
    GameStateManager_.setPlayer(pid, makePlayer(pid, { researchLevel: 1 }))
    expect(crafting.canCraft(pid, 'not_a_recipe' as any)).toBe(false)
  })
})

describe('CraftingSystem.craft — execution', () => {
  it('craft deducts materials and adds product', () => {
    const pid = 'cs-craft-1'
    GameStateManager_.setPlayer(pid, makePlayer(pid, { researchLevel: 1 }))
    Inventory.add(pid, 'wood', 5)

    const ok = crafting.craft(pid, 'plank')

    expect(ok).toBe(true)
    expect(Inventory.getAmount(pid, 'wood')).toBe(3)   // 5 - 2
    expect(Inventory.getAmount(pid, 'plank')).toBe(4)  // produces 4
  })

  it('craft returns false and does not mutate inventory when locked by researchLevel', () => {
    const pid = 'cs-craft-2'
    GameStateManager_.setPlayer(pid, makePlayer(pid, { level: 99, researchLevel: 1 }))
    Inventory.add(pid, 'berry', 10)

    const ok = crafting.craft(pid, 'bread')

    expect(ok).toBe(false)
    expect(Inventory.getAmount(pid, 'berry')).toBe(10) // untouched
    expect(Inventory.getAmount(pid, 'bread')).toBe(0)
  })
})
