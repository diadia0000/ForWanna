// Agent 1 負責 — src/core/GameLoop.ts
import * as PIXI from 'pixi.js'
import { EventBus } from './EventBus'
import { GameStateManager_ } from './GameState'

type TickCallback = (delta: number, tick: number) => void

class GameLoopClass {
  private ticker: PIXI.Ticker | null = null
  private callbacks: TickCallback[] = []
  readonly TICK_RATE = 60 // 固定 60 tick/s

  start(app: PIXI.Application): void {
    this.ticker = app.ticker
    this.ticker.maxFPS = this.TICK_RATE
    this.ticker.add((ticker) => {
      GameStateManager_.incrementTick()
      const tick = GameStateManager_.get().tick
      this.callbacks.forEach(cb => cb(ticker.deltaTime, tick))
    })
  }

  stop(): void {
    this.ticker?.stop()
  }

  addCallback(cb: TickCallback): void {
    this.callbacks.push(cb)
  }

  removeCallback(cb: TickCallback): void {
    const idx = this.callbacks.indexOf(cb)
    if (idx !== -1) this.callbacks.splice(idx, 1)
  }
}

export const GameLoop = new GameLoopClass()
