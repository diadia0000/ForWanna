import { describe, it, expect, vi } from 'vitest'
import { EventBus } from './EventBus'

describe('EventBus', () => {
  it('呼叫已註冊的監聽器並帶入 payload', () => {
    const handler = vi.fn()
    EventBus.on('player:moved', handler)
    EventBus.emit('player:moved', { playerId: 'p1', x: 10, y: 20 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ playerId: 'p1', x: 10, y: 20 })

    EventBus.off('player:moved', handler)
  })

  it('off 之後不再收到事件', () => {
    const handler = vi.fn()
    EventBus.on('player:died', handler)
    EventBus.off('player:died', handler)
    EventBus.emit('player:died', { playerId: 'p1' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('支援同一事件的多個監聽器', () => {
    const a = vi.fn()
    const b = vi.fn()
    EventBus.on('player:levelup', a)
    EventBus.on('player:levelup', b)
    EventBus.emit('player:levelup', { playerId: 'p1', level: 2 })

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    EventBus.off('player:levelup', a)
    EventBus.off('player:levelup', b)
  })

  it('once 只觸發一次', () => {
    const handler = vi.fn()
    EventBus.once('save:complete', handler)
    EventBus.emit('save:complete', {})
    EventBus.emit('save:complete', {})

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('對沒有監聽器的事件 emit 不會丟錯', () => {
    expect(() => EventBus.emit('network:connected', { playerId: 'ghost' })).not.toThrow()
  })
})
