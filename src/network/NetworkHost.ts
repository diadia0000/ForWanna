// Agent 2 負責 — src/network/NetworkHost.ts
import type Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { NetMessage, PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { GameStateManager_ } from '@/core/GameState'
import { WORLD_CONFIG } from '@/world/WorldGen'

const PLAYER_SPRITE_IDS = ['player', 'player.monk2', 'player.boy', 'player.eskimo'] as const

function assignPlayerSprites(): void {
  const state = GameStateManager_.get()
  const ids = Object.keys(state.players)
  ids.sort((a, b) => {
    if (a === state.hostId) return -1
    if (b === state.hostId) return 1
    return a.localeCompare(b)
  })
  ids.forEach((id, index) => {
    const player = state.players[id] as any
    if (player) player.spriteId = PLAYER_SPRITE_IDS[index % PLAYER_SPRITE_IDS.length]
  })
}

class NetworkHostClass {
  private connections: Map<PlayerId, DataConnection> = new Map()
  private stableIds: Map<PlayerId, string> = new Map()   // peerId → stableId
  private lastSeen: Map<PlayerId, number> = new Map()
  private heartbeatSweep: ReturnType<typeof setInterval> | null = null
  private peer: Peer | null = null

  init(peer: Peer): void {
    this.peer = peer
    peer.on('connection', (conn) => this.handleConnection(conn))
    if (!this.heartbeatSweep) {
      this.heartbeatSweep = setInterval(() => this.sweepStaleConnections(), 3000)
    }
  }

  private handleConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log(`[Host] 玩家連線：${conn.peer}`)
    })

    conn.on('data', (raw) => {
      const msg = raw as NetMessage | any
      if (msg.type === 'join') {
        // 同帳號重連：用 stableId 踢掉舊連線（避免複製人）
        const incomingStableId: string = (msg as any).stableId ?? ''
        const incomingSessionId: string = (msg as any).sessionId ?? ''
        const incomingStableKey = incomingStableId && incomingSessionId
          ? `${incomingStableId}:${incomingSessionId}`
          : ''
        if (incomingStableKey) {
          for (const [oldId, oldConn] of this.connections) {
            if (this.stableIds.get(oldId) === incomingStableKey) {
              console.log(`[Host] 踢掉重連的舊玩家（stableId: ${incomingStableId}）`)
              oldConn.close()
              this.connections.delete(oldId)
              this.stableIds.delete(oldId)
              GameStateManager_.removePlayer(oldId)
              EventBus.emit('network:disconnected', { playerId: oldId })
              break
            }
          }
        }
        // 決定出生位置：優先用玩家在此地圖的上次位置，否則用預設出生點
        const worldSeed = GameStateManager_.getWorld()?.seed
        const mapPositions: Record<string, { x: number; y: number }> =
          (msg as any).mapPositions ?? {}
        const savedPos = worldSeed !== undefined ? mapPositions[String(worldSeed)] : null
        const spawnX = savedPos?.x ?? WORLD_CONFIG.CENTER_X
        const spawnY = savedPos?.y ?? WORLD_CONFIG.CENTER_Y
        console.log(`[Host] 玩家 ${msg.playerData.name} 出生於 (${spawnX}, ${spawnY})${savedPos ? '（上次記錄）' : '（預設點）'}`)

        // 新玩家加入：存入 GameState，發送完整狀態
        const playerId = conn.peer
        this.connections.set(playerId, conn)
        this.lastSeen.set(playerId, Date.now())
        if (incomingStableKey) this.stableIds.set(playerId, incomingStableKey)
        GameStateManager_.setPlayer(playerId, { ...msg.playerData, id: playerId, x: spawnX, y: spawnY })
        assignPlayerSprites()
        // 發送完整狀態給新玩家
        this.sendTo(playerId, {
          type: 'state_full',
          tick: GameStateManager_.get().tick,
          state: GameStateManager_.get(),
        })
        // 通知其他玩家
        this.broadcastExcept(playerId, {
          type: 'player_list',
          players: Object.values(GameStateManager_.get().players),
        })
        EventBus.emit('network:connected', { playerId })
      } else if (msg.type === 'input') {
        this.lastSeen.set(conn.peer, Date.now())
        EventBus.emit('network:input', { playerId: msg.playerId, input: msg.input })
      } else if (msg.type === 'heartbeat') {
        this.lastSeen.set(conn.peer, Date.now())
      } else if (msg.type === 'leave') {
        this.removeConnection(conn.peer, conn, false)
      }
    })

    conn.on('close', () => {
      this.removeConnection(conn.peer, conn, true)
      return
      const playerId = conn.peer
      this.connections.delete(playerId)
      this.stableIds.delete(playerId)
      GameStateManager_.removePlayer(playerId)
      assignPlayerSprites()
      EventBus.emit('network:disconnected', { playerId })
      // 廣播最新玩家清單給所有剩餘客戶端（讓他們移除離線玩家的 sprite）
      this.broadcast({
        type: 'player_list',
        players: Object.values(GameStateManager_.get().players),
      })
    })
  }

  /** 廣播給所有客戶端 */
  private removeConnection(playerId: PlayerId, conn?: DataConnection, alreadyClosed = false): void {
    if (!this.connections.has(playerId) && !GameStateManager_.getPlayer(playerId)) return
    this.connections.delete(playerId)
    this.stableIds.delete(playerId)
    this.lastSeen.delete(playerId)
    if (!alreadyClosed) conn?.close()
    GameStateManager_.removePlayer(playerId)
    assignPlayerSprites()
    EventBus.emit('network:disconnected', { playerId })
    this.broadcast({
      type: 'player_list',
      players: Object.values(GameStateManager_.get().players),
    })
  }

  private sweepStaleConnections(): void {
    const now = Date.now()
    for (const [playerId, conn] of this.connections) {
      const lastSeen = this.lastSeen.get(playerId) ?? now
      if (now - lastSeen > 8000) {
        console.warn(`[Host] 移除逾時玩家：${playerId}`)
        this.removeConnection(playerId, conn, false)
      }
    }
  }

  broadcast(msg: NetMessage): void {
    this.connections.forEach(conn => conn.send(msg))
  }

  /** 廣播給特定玩家以外的所有人 */
  broadcastExcept(excludeId: PlayerId, msg: NetMessage): void {
    this.connections.forEach((conn, id) => {
      if (id !== excludeId) conn.send(msg)
    })
  }

  /** 發送給特定玩家 */
  sendTo(playerId: PlayerId, msg: NetMessage): void {
    this.connections.get(playerId)?.send(msg)
  }

  getConnectedCount(): number {
    return this.connections.size
  }
}

export const NetworkHost = new NetworkHostClass()
