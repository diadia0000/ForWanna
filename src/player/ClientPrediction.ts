// Agent 4 負責 — src/player/ClientPrediction.ts
import type { PlayerInput, PlayerData } from '@/types'

interface PredictionFrame {
  tick: number
  input: PlayerInput
  predictedX: number
  predictedY: number
}

const SPEED = 3

export class ClientPrediction {
  private pendingFrames: PredictionFrame[] = []

  predict(input: PlayerInput, currentX: number, currentY: number, tick: number): { x: number; y: number } {
    let x = currentX
    let y = currentY

    if (input.type === 'move') {
      x += input.dx * SPEED
      y += input.dy * SPEED
    }

    this.pendingFrames.push({ tick, input, predictedX: x, predictedY: y })
    // 最多保留 60 幀
    if (this.pendingFrames.length > 60) this.pendingFrames.shift()

    return { x, y }
  }

  /** 收到 Server 的確認狀態後，修正誤差 */
  reconcile(serverData: Partial<PlayerData>, serverTick: number): { x: number; y: number } | null {
    // 移除已確認的幀
    this.pendingFrames = this.pendingFrames.filter(f => f.tick > serverTick)

    if (serverData.x === undefined || serverData.y === undefined) return null

    // 重新播放未確認輸入
    let x = serverData.x
    let y = serverData.y

    for (const frame of this.pendingFrames) {
      if (frame.input.type === 'move') {
        x += frame.input.dx * SPEED
        y += frame.input.dy * SPEED
      }
    }

    return { x, y }
  }

  clear(): void {
    this.pendingFrames = []
  }
}
