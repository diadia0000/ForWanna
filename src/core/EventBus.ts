// Agent 1 負責 — src/core/EventBus.ts
import type { GameEvents } from '@/types'

type Handler<T> = (payload: T) => void

class EventBusClass {
  private listeners: Map<string, Handler<unknown>[]> = new Map()

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)!.push(handler as Handler<unknown>)
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    const idx = handlers.indexOf(handler as Handler<unknown>)
    if (idx !== -1) handlers.splice(idx, 1)
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach(h => h(payload))
  }

  once<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    const wrapper: Handler<GameEvents[K]> = (payload) => {
      handler(payload)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
}

export const EventBus = new EventBusClass()
