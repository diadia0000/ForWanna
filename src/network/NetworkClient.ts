// Agent 2 負責 — src/network/NetworkClient.ts
import type Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { NetMessage, PlayerData } from '@/types'
import { EventBus } from '@/core/EventBus'
import { GameStateManager_ } from '@/core/GameState'
import { t } from '@/core/i18n'

class NetworkClientClass {
  private conn: DataConnection | null = null
  private readonly sessionId = crypto.randomUUID()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  async connect(peer: Peer, hostPeerId: string, playerName: string): Promise<void> {
    const playerData: PlayerData = this.loadLocalPlayerData(playerName)

    return new Promise((resolve, reject) => {
      console.log(`[Client] 嘗試連線到 ${hostPeerId}`)
      const conn = peer.connect(hostPeerId, { reliable: true })
      this.conn = conn

      const timeout = setTimeout(() => {
        reject(new Error(t('network.timeout_channel', undefined, 'WebRTC 資料通道逾時（15秒），請確認 Host 已開房間')))
      }, 15_000)

      conn.on('open', () => {
        console.log('[Client] 資料通道已開啟，送出 join 訊息')
        // 附帶 stableId（帳號識別碼）和 per-map 位置記錄
        let stableId = localStorage.getItem('forager_stable_id') ?? ''
        if (!stableId) {
          stableId = crypto.randomUUID()
          localStorage.setItem('forager_stable_id', stableId)
        }
        const mapPositions: Record<string, { x: number; y: number }> =
          JSON.parse(localStorage.getItem('forager_map_pos') ?? '{}')
        conn.send({ type: 'join', playerData, stableId, sessionId: this.sessionId, mapPositions } as NetMessage)
        this.startHeartbeat()
      })

      conn.on('data', (raw) => {
        const msg = raw as NetMessage
        console.log('[Client] 收到訊息：', msg.type)
        this.handleMessage(msg)
        if (msg.type === 'state_full' || msg.type === 'join_ack') {
          clearTimeout(timeout)
          resolve()
        }
      })

      conn.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
      conn.on('close', () => {
        console.log('[Client] 與 Host 斷線')
        this.stopHeartbeat()
        EventBus.emit('network:disconnected', { playerId: 'host' })
      })
    })
  }

  private handleMessage(msg: NetMessage): void {
    switch (msg.type) {
      case 'state_full':
        GameStateManager_.set(msg.state)
        // 通知 main.ts 重新渲染（世界可能已更新）
        window.dispatchEvent(new CustomEvent('client:state_full', { detail: msg.state }))
        break
      case 'state_delta':
        window.dispatchEvent(new CustomEvent('client:state_delta', { detail: msg }))
        break
      case 'player_list':
        msg.players.forEach(p => GameStateManager_.setPlayer(p.id, p))
        // 通知 main.ts 有新玩家，讓它補建 sprite
        window.dispatchEvent(new CustomEvent('client:player_list', { detail: msg.players }))
        break
      case 'kicked':
        alert(t('network.kicked', { reason: msg.reason ?? '' }, `被踢出：${msg.reason}`))
        break
    }
  }

  send(msg: NetMessage): void {
    if (!this.conn?.open) {
      console.warn('[Client] 尚未連線，無法發送訊息')
      return
    }
    this.conn.send(msg)
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.conn?.open) {
      this.conn.send({ type: 'leave' } as any)
    }
    this.conn?.close()
    this.conn = null
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.conn?.open) this.conn.send({ type: 'heartbeat' } as any)
    }, 2000)
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return
    clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  /** 讀取本地存檔的玩家資料，沒有則建立新玩家 */
  private loadLocalPlayerData(name: string): PlayerData {
    const saved = localStorage.getItem('forager_player')
    if (saved) {
      const data = JSON.parse(saved) as PlayerData
      // 向下相容：如果沒有 researchLevel，補上初值 1
      if (data.researchLevel === undefined) data.researchLevel = 1
      return data
    }
    return {
      id: crypto.randomUUID(),
      name,
      x: 0, y: 0,
      hp: 100, maxHp: 100,
      xp: 0, level: 1,
      researchLevel: 1,
      gold: 0,
      inventory: [],
      unlockedSkills: [],
      color: Math.random() * 0xffffff,
    }
  }
}

export const NetworkClient = new NetworkClientClass()
