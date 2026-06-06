import * as PIXI from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { MonsterSpawner } from './MonsterSpawner'

describe('MonsterSpawner spawnEntity', () => {
  it('keeps searching after the first eight invalid spawn positions', () => {
    const spawner = new MonsterSpawner(new PIXI.Container())
    let checks = 0

    spawner.setLandPosChecker(() => {
      checks += 1
      return checks > 8
    })

    const monster = spawner.spawnEntity('slime', 'wild', [{ id: 'p1', x: 0, y: 0 }])

    expect(monster).not.toBeNull()
    expect(checks).toBeGreaterThan(8)
    monster?.destroy()
  })
})
