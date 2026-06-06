// Agent 2 負責 — src/network/RoomManager.ts
import Peer from 'peerjs'
import type { PlayerId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { t } from '@/core/i18n'
import { NetworkHost } from './NetworkHost'
import { NetworkClient } from './NetworkClient'

export type RoomRole = 'host' | 'client' | null

// 從 .env 讀取 peer server 位置；預設走本地
const PEER_HOST   = import.meta.env.VITE_PEER_HOST   ?? 'localhost'
const PEER_PORT   = Number(import.meta.env.VITE_PEER_PORT   ?? 9000)
const PEER_SECURE = import.meta.env.VITE_PEER_SECURE === 'true'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:eu-0.turn.peerjs.com:3478',
      'turn:us-0.turn.peerjs.com:3478',
    ],
    username: 'peerjs',
    credential: 'peerjsp',
  },
]

class RoomManagerClass {
  private peer: Peer | null = null
  private _roomCode: string = ''
  private _role: RoomRole = null
  private _myId: PlayerId = ''

  get roomCode(): string { return this._roomCode }
  get role(): RoomRole { return this._role }
  get myId(): PlayerId { return this._myId }

  /** 開新房間（Host 呼叫） */
  async createRoom(): Promise<string> {
    this._roomCode = this.generateCode()
    this._role = 'host'
    this.peer = new Peer(this.toPeerId(this._roomCode), {
      host: PEER_HOST,
      port: PEER_PORT,
      path: '/myapp',
      key: 'peerjs',
      secure: PEER_SECURE,
      pingInterval: 3000,
      config: {
        iceServers: ICE_SERVERS,
      },
      debug: 2,
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(t('network.timeout_host', undefined, '連線逾時（10秒），請確認網路或改用其他網路'))), 10_000)
      this.peer!.on('open', (id) => {
        clearTimeout(timeout)
        this._myId = id
        resolve()
      })
      this.peer!.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    this.setupReconnect()
    NetworkHost.init(this.peer)
    console.log(`[Room] 房間已建立，房號：${this._roomCode}`)
    return this._roomCode
  }

  /** 加入房間（Client 呼叫） */
  async joinRoom(code: string, playerName: string): Promise<void> {
    this._roomCode = code.toUpperCase()
    this._role = 'client'
    // 給 Client 一個隨機 ID，讓 PeerJS 正確初始化
    const clientId = 'client-' + Math.random().toString(36).substring(2, 10)
    this.peer = new Peer(clientId, {
      host: PEER_HOST,
      port: PEER_PORT,
      path: '/myapp',
      key: 'peerjs',
      secure: PEER_SECURE,
      pingInterval: 3000,
      config: {
        iceServers: ICE_SERVERS,
      },
      debug: 2,
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(t('network.timeout_client', undefined, '連線逾時（10秒）'))), 10_000)
      this.peer!.on('open', (id) => {
        clearTimeout(timeout)
        this._myId = id
        resolve()
      })
      this.peer!.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    this.setupReconnect()
    await NetworkClient.connect(this.peer, this.toPeerId(this._roomCode), playerName)
    console.log(`[Room] 已加入房間 ${this._roomCode}`)
  }

  /** 設定信令伺服器斷線自動重連，並通知 UI 顯示/隱藏覆蓋層 */
  private setupReconnect(): void {
    if (!this.peer) return
    let everOpened = true   // 初始化時已 open 過一次

    this.peer.on('disconnected', () => {
      console.warn('[Room] 信令伺服器斷線，3 秒後重連...')
      window.dispatchEvent(new CustomEvent('peer:signaling-lost'))
      setTimeout(() => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect()
        }
      }, 3000)
    })

    // reconnect() 成功後 PeerJS 會再次觸發 open
    this.peer.on('open', () => {
      if (everOpened) {
        console.log('[Room] 信令伺服器重連成功')
        window.dispatchEvent(new CustomEvent('peer:signaling-restored'))
      }
      everOpened = true
    })
  }

  leaveRoom(): void {
    if (this._role === 'client') {
      NetworkClient.disconnect()
    }
    this.peer?.destroy()
    this.peer = null
    this._role = null
    this._roomCode = ''
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  private toPeerId(code: string): string {
    return `forager-room-${code}`
  }
}

export const RoomManager = new RoomManagerClass()
