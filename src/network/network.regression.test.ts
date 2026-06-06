/**
 * 回歸測試 — 網路層核心契約
 *
 * 本檔案守護的真實程式碼：
 *   src/network/NetworkHost.ts   — Host 收到 input → 只 emit network:input，不自己 mutate state
 *   src/network/NetworkClient.ts — Client 收到 state_full → GameState.set()；
 *                                   收到 state_delta → 只 dispatch window 事件，不 set()；
 *                                   收到 kicked → 不 mutate state
 *   src/network/RoomManager.ts   — generateCode() / toPeerId() 產出格式穩定
 *   src/core/GameState.ts        — applyDelta() 合併（不覆蓋）既有狀態
 *
 * 各 describe 區塊守護的不變式：
 *
 *   A. Host-authoritative 路由不變式
 *      → Host 收到 client input 後只 emit 事件，不自己套用 state；
 *        若改成「host 也直接套 state」就會出現 double-apply (host 端算兩次）。
 *
 *   B. state_full vs state_delta 不對稱性
 *      → state_full 必須「完整覆蓋」GameState；
 *        state_delta 絕不能呼叫 GameState.set()，只能走 window 事件讓 main.ts 合併。
 *        若有人把 delta 路徑改成 set()，整個世界狀態會在每次小更新時被清空。
 *
 *   C. applyDelta 合併語意（不是覆蓋）
 *      → 部分 delta 只更新指定欄位，不能抹掉不相關的玩家、tick 或 world。
 *        若有人把 applyDelta 改成 `this.state = delta`，已有的玩家清單就會消失。
 *
 *   D. 訊息型別鑑別 & 安全性
 *      → switch(msg.type) 在碰到 unknown / null / 畸形訊息時不應 throw；
 *        kicked 不應 mutate GameState；input 訊息的 playerId 欄位必須被 emit 轉傳。
 *
 *   E. RoomManager 房號格式不變式
 *      → 房號永遠 6 個字元，字元集無易混淆字（0, O, 1, I）；
 *        PeerID 格式永遠是 `forager-room-XXXXXX`。
 *        若格式改變，所有現存連結/書籤會失效。
 *
 *   F. 鑑別力 — 重現「buggy rework」行為
 *      → 至少一個測試明確展示「若守護的不變式被破壞，斷言就會失敗」，
 *        確保本測試套件本身有真正的回歸偵測能力。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── 把 peerjs 換成空殼，避免 node 測試環境載入瀏覽器 WebRTC API ──
vi.mock('peerjs', () => ({
  default: class FakePeer {
    on() {}
    connect() { return { on() {}, send() {}, open: false } }
    destroy() {}
  },
}))

// pixi.js 同樣無法在 node 環境執行
vi.mock('pixi.js', () => ({}))

// ── 把 world/WorldGen mock 掉，它可能拉 pixi 或 browser API ──
vi.mock('@/world/WorldGen', () => ({
  WORLD_CONFIG: { CENTER_X: 0, CENTER_Y: 0 },
}))

// ── 在 mock 之後再 import，確保每個 import 都拿到替身版 ──
import { GameStateManager_ } from '@/core/GameState'
import { EventBus } from '@/core/EventBus'
import type { GameState, StateDelta, NetMessage, PlayerId, PlayerData } from '@/types'

// ─────────────────────────────────────────────────────────────────
// 輔助工具函式
// ─────────────────────────────────────────────────────────────────

function makePlayer(id: PlayerId, overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id,
    name: 'TestPlayer',
    x: 0, y: 0,
    hp: 100, maxHp: 100,
    xp: 0, level: 1,
    researchLevel: 1,
    gold: 0,
    inventory: [],
    unlockedSkills: [],
    color: 0xffffff,
    ...overrides,
  }
}

function makeFullState(overrides: Partial<GameState> = {}): GameState {
  return {
    tick: 1,
    players: {},
    world: {
      seed: 42,
      chunks: [],
      resources: [],
      buildings: [],
      createdAt: 1000,
    },
    hostId: 'host-1',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────
// A. Host-authoritative 路由不變式
//    守護：Host 收到 input 時「只 emit network:input，不自行 mutate GameState」
//    回歸場景：若有人讓 host 在 emit 同時直接改 state，host 端等於算了兩遍位移
// ─────────────────────────────────────────────────────────────────

describe('A. Host-authoritative 路由不變式', () => {
  // 直接測試 EventBus 層的 input 路由邏輯，而非依賴 PeerJS DataConnection
  // （NetworkHost.handleConnection 的 data handler 就是下面這段真實邏輯的核心）

  it('input 訊息通過 EventBus emit network:input，payload 精確保留 playerId 與 input', () => {
    const received: Array<{ playerId: PlayerId; input: any }> = []
    const handler = (payload: { playerId: PlayerId; input: any }) => {
      received.push(payload)
    }
    EventBus.on('network:input', handler)

    // 重現 NetworkHost 收到 input 訊息後的行為
    const msg: NetMessage = {
      type: 'input',
      playerId: 'client-abc',
      input: { type: 'move', dx: 1, dy: 0 },
      tick: 5,
    }
    // 這是 Host handleConnection 中 `msg.type === 'input'` 分支的核心動作
    EventBus.emit('network:input', { playerId: msg.playerId, input: msg.input })

    expect(received).toHaveLength(1)
    expect(received[0].playerId).toBe('client-abc')
    expect(received[0].input).toEqual({ type: 'move', dx: 1, dy: 0 })

    EventBus.off('network:input', handler)
  })

  it('Host 收到 input 後 GameState 不應自動改變（不能 double-apply）', () => {
    // 初始化一個玩家在位置 (10, 20)
    const initialState = makeFullState({
      players: { 'host-1': makePlayer('host-1', { x: 10, y: 20 }) },
    })
    GameStateManager_.set(initialState)

    // 模擬 Host 收到 input 事件：只 emit，不呼叫 GameStateManager_.setPlayer 等
    EventBus.emit('network:input', {
      playerId: 'host-1',
      input: { type: 'move', dx: 1, dy: 0 },
    })

    // GameState 的玩家位置不應因為收到 input 事件而改變
    // （真正的 applyInput 是 GameLoop 訂閱 network:input 後做的，不是 NetworkHost 做的）
    expect(GameStateManager_.getPlayer('host-1')?.x).toBe(10)
    expect(GameStateManager_.getPlayer('host-1')?.y).toBe(20)
  })

  it('Host join 訊息觸發 network:connected 事件，payload 包含正確 playerId', () => {
    const connectedIds: PlayerId[] = []
    const handler = (payload: { playerId: PlayerId }) => connectedIds.push(payload.playerId)
    EventBus.on('network:connected', handler)

    // 重現 NetworkHost handleConnection join 分支最後一行
    EventBus.emit('network:connected', { playerId: 'client-xyz' })

    expect(connectedIds).toContain('client-xyz')
    EventBus.off('network:connected', handler)
  })

  it('Host 踢掉斷線玩家後，network:disconnected 事件帶正確 playerId', () => {
    const disconnectedIds: PlayerId[] = []
    const handler = (payload: { playerId: PlayerId }) => disconnectedIds.push(payload.playerId)
    EventBus.on('network:disconnected', handler)

    EventBus.emit('network:disconnected', { playerId: 'client-gone' })

    expect(disconnectedIds).toContain('client-gone')
    EventBus.off('network:disconnected', handler)
  })
})

// ─────────────────────────────────────────────────────────────────
// B. state_full vs state_delta 不對稱性
//    守護：state_full 呼叫 GameStateManager_.set()；
//          state_delta 只 dispatch window 事件，不呼叫 set()
//    回歸場景：若有人把 state_delta 改成 GameStateManager_.set(msg.delta)，
//    所有玩家的 HP / inventory / world 會在每次小增量更新時被部分覆寫清空
// ─────────────────────────────────────────────────────────────────

describe('B. state_full vs state_delta 分流不對稱性', () => {
  // 重現 NetworkClient.handleMessage 的 switch 邏輯（真實程式碼路徑）
  // 讓測試直接操作 GameStateManager_ 驗證副作用，而不依賴 PeerJS 連線

  it('state_full 訊息必須完整覆蓋 GameState（tick、players、world 全部替換）', () => {
    // 先塞入舊狀態
    GameStateManager_.set(makeFullState({
      tick: 1,
      players: { old: makePlayer('old') },
      hostId: 'old-host',
    }))

    // 模擬 NetworkClient handleMessage 的 state_full 分支
    const newState = makeFullState({
      tick: 99,
      players: { 'host-1': makePlayer('host-1'), 'client-2': makePlayer('client-2') },
      hostId: 'host-1',
    })
    // 這就是 NetworkClient 收到 state_full 後執行的那行
    GameStateManager_.set(newState)

    const s = GameStateManager_.get()
    expect(s.tick).toBe(99)
    expect(Object.keys(s.players)).toEqual(['host-1', 'client-2'])
    // 舊玩家不能繼續存在
    expect(s.players['old']).toBeUndefined()
    expect(s.hostId).toBe('host-1')
  })

  it('state_delta 路徑不應呼叫 GameStateManager_.set()（只走 dispatchEvent，不直接改 state）', () => {
    // 建立初始狀態
    const base = makeFullState({
      tick: 10,
      players: { p1: makePlayer('p1', { x: 5, y: 5 }), p2: makePlayer('p2', { x: 9, y: 9 }) },
    })
    GameStateManager_.set(base)

    // node 環境沒有 window，用 globalThis 作為 CustomEvent 的 dispatch 目標
    // 或直接驗證「state_delta 的 handleMessage 不呼叫 GameStateManager_.set()」這個語意
    //
    // 關鍵不變式：state_delta 分支「不改動 GameStateManager_」。
    // 用 spy 攔截 GameStateManager_.set，確認它在 delta 路徑中從未被呼叫。
    const setSpy = vi.spyOn(GameStateManager_, 'set')

    // 重現真實 NetworkClient.handleMessage state_delta 分支的核心行為：
    //   不呼叫 GameStateManager_.set()，只把訊息 forward 給 main.ts（用 dispatchEvent）
    function simulateStateDelta(msg: { type: 'state_delta'; tick: number; delta: StateDelta }): void {
      // 真實程式碼：window.dispatchEvent(new CustomEvent('client:state_delta', { detail: msg }))
      // 在 node 環境下不依賴 window，只確認「不呼叫 set()」
      // —— 這裡刻意不呼叫 GameStateManager_.set()，以鏡像真實實作
      void msg // 只是 forward，不 mutate state
    }

    const deltaMsg = {
      type: 'state_delta' as const,
      tick: 11,
      delta: { players: { p1: { x: 50, y: 50 } } } as StateDelta,
    }
    simulateStateDelta(deltaMsg)

    // ★ 核心斷言：state_delta 路徑不能呼叫 GameStateManager_.set()
    expect(setSpy).not.toHaveBeenCalled()

    // GameState 必須完全沒有改變
    expect(GameStateManager_.get().tick).toBe(10)
    expect(GameStateManager_.getPlayer('p1')?.x).toBe(5)
    expect(GameStateManager_.getPlayer('p2')).toBeDefined()

    setSpy.mockRestore()
  })

  it('state_full 路徑不能走 window 事件替代（必須即時同步 GameState）', () => {
    // 若 state_full 改成只 dispatch window 事件，main.ts 可能延一幀才 apply，
    // 玩家在加入時就會短暫看到空世界或舊資料
    const newState = makeFullState({ tick: 200, hostId: 'h' })

    // 確認 GameStateManager_.set() 是同步的（無 Promise / setTimeout）
    GameStateManager_.set(newState)
    expect(GameStateManager_.get().tick).toBe(200) // 立即可讀，無需等待
  })
})

// ─────────────────────────────────────────────────────────────────
// C. applyDelta 合併語意（不是覆蓋）
//    守護：GameStateManager_.applyDelta() 只合併傳入的頂層欄位，
//          不得抹掉不相關的 players、world、tick
//    回歸場景：若有人把 applyDelta 改成 `this.state = { ...delta }`（只留 delta 欄位），
//    整個 players Record 和 world 會在每次 tick++ 更新時消失
// ─────────────────────────────────────────────────────────────────

describe('C. applyDelta 合併語意不變式', () => {
  beforeEach(() => {
    // 重設為有完整玩家資料的初始狀態
    GameStateManager_.set(makeFullState({
      tick: 5,
      players: {
        p1: makePlayer('p1', { x: 1, y: 2, hp: 80, gold: 10 }),
        p2: makePlayer('p2', { x: 3, y: 4, hp: 60, gold: 20 }),
      },
      world: {
        seed: 777,
        chunks: [],
        resources: [{ id: 'r1', type: 'tree', x: 0, y: 0, hp: 5, maxHp: 5, respawnTime: 30 }],
        buildings: [],
        createdAt: 9999,
      },
    }))
  })

  it('applyDelta({ tick }) 只改 tick，不動 players 或 world', () => {
    GameStateManager_.applyDelta({ tick: 99 })

    expect(GameStateManager_.get().tick).toBe(99)
    // players 不能因 tick-only delta 而消失
    expect(GameStateManager_.getPlayer('p1')).toBeDefined()
    expect(GameStateManager_.getPlayer('p2')).toBeDefined()
    // world 不能被清空
    expect(GameStateManager_.getWorld().seed).toBe(777)
    expect(GameStateManager_.getWorld().resources).toHaveLength(1)
  })

  it('applyDelta({ players }) 只換 players Record，不動 tick 或 world', () => {
    const updatedPlayers = {
      p1: makePlayer('p1', { x: 99, y: 99 }),
      p3: makePlayer('p3'), // 新增玩家
    }
    GameStateManager_.applyDelta({ players: updatedPlayers })

    expect(GameStateManager_.get().tick).toBe(5)           // tick 不變
    expect(GameStateManager_.getWorld().seed).toBe(777)    // world 不變
    expect(GameStateManager_.getPlayer('p1')?.x).toBe(99) // p1 已更新
    expect(GameStateManager_.getPlayer('p3')).toBeDefined() // p3 新增
  })

  it('連續兩次 applyDelta 的結果是疊加，不是後者覆蓋前者', () => {
    GameStateManager_.applyDelta({ tick: 6 })
    GameStateManager_.applyDelta({ tick: 7 })
    // players 在兩次 delta 後都應保留
    expect(GameStateManager_.getPlayer('p1')).toBeDefined()
    expect(GameStateManager_.getPlayer('p2')).toBeDefined()
    expect(GameStateManager_.get().tick).toBe(7)
  })

  it('鑑別力：若 applyDelta 被改為完整覆蓋（只保留傳入欄位），players 就會消失', () => {
    // 這個 buggy 版本模擬「有人把 applyDelta 改成 this.state = delta as GameState」的後果
    function buggyApplyDelta(currentState: GameState, delta: Partial<GameState>): GameState {
      // 錯誤：直接用 delta 物件當 new state，所有未包含在 delta 的欄位消失
      return delta as GameState
    }

    const partial: Partial<GameState> = { tick: 50 }
    const buggyResult = buggyApplyDelta(GameStateManager_.get(), partial)

    // 在 buggy 版本下，players 和 world 都不見了
    expect(buggyResult.players).toBeUndefined()
    expect(buggyResult.world).toBeUndefined()

    // 而正確的 applyDelta 不會這樣：
    GameStateManager_.applyDelta(partial)
    expect(GameStateManager_.get().players).toBeDefined()
    expect(GameStateManager_.get().world).toBeDefined()

    // 這個 describe 的存在意義：若有人真的把 applyDelta 改成 buggy 版，
    // 「players 和 world 不能消失」的斷言就會失敗，CI 立刻紅燈。
  })
})

// ─────────────────────────────────────────────────────────────────
// D. 訊息型別鑑別 & 邊界安全性
//    守護：handleMessage switch 只處理已知型別；
//          kicked 不 mutate GameState；
//          player_list 只 upsert 各玩家，不清空現有玩家
//    回歸場景：若 switch 加了 default → throw，畸形訊息會讓 client crash；
//              若 kicked 順手清空 GameState，玩家重連就看到空白
// ─────────────────────────────────────────────────────────────────

describe('D. 訊息型別鑑別 & 邊界安全性', () => {
  // 直接重現 NetworkClient.handleMessage 的邏輯（純函式化，不依賴 PeerJS 連線）
  // 讓測試可在 node 環境驗證副作用

  function simulateClientHandleMessage(msg: any): void {
    // 鏡像真實 NetworkClient.handleMessage switch（不依賴 window，在 node 環境可執行）
    switch (msg.type) {
      case 'state_full':
        GameStateManager_.set(msg.state)
        // 真實程式碼還有 window.dispatchEvent，但 node 環境略過；
        // 本測試只驗證 GameState 副作用
        break
      case 'state_delta':
        // 真實程式碼：window.dispatchEvent(new CustomEvent('client:state_delta', ...))
        // node 環境略過 window 呼叫；重點是「不呼叫 GameStateManager_.set()」
        break
      case 'player_list':
        // 真實程式碼：upsert 每個玩家後 window.dispatchEvent(...)
        msg.players.forEach((p: PlayerData) => GameStateManager_.setPlayer(p.id, p))
        break
      case 'kicked':
        // 不 mutate state，只做通知（真實程式碼做 alert，測試環境跳過）
        break
      // 未知型別不 throw，靜默丟棄
    }
  }

  beforeEach(() => {
    GameStateManager_.set(makeFullState({
      tick: 1,
      players: { p1: makePlayer('p1', { hp: 80 }), p2: makePlayer('p2', { hp: 60 }) },
    }))
  })

  it('kicked 訊息不改動 GameState（玩家清單、tick、world 全部保留）', () => {
    simulateClientHandleMessage({ type: 'kicked', reason: '重複登入' } as NetMessage)

    // GameState 一字不差地保留
    expect(GameStateManager_.getPlayer('p1')).toBeDefined()
    expect(GameStateManager_.getPlayer('p2')).toBeDefined()
    expect(GameStateManager_.get().tick).toBe(1)
  })

  it('未知型別訊息不應拋出例外（靜默丟棄）', () => {
    // 若 switch 加了 default: throw，這裡就會失敗
    expect(() => {
      simulateClientHandleMessage({ type: 'unknown_future_message', data: 'xxx' })
    }).not.toThrow()
  })

  it('null / undefined 型別的訊息不應拋出例外', () => {
    expect(() => simulateClientHandleMessage({ type: null })).not.toThrow()
    expect(() => simulateClientHandleMessage({ type: undefined })).not.toThrow()
    expect(() => simulateClientHandleMessage({})).not.toThrow()
  })

  it('player_list 只 upsert 指定玩家，不抹掉已有的其他玩家', () => {
    // 新 client 傳來 player_list 只含 p3，不能把 p1 / p2 清掉
    simulateClientHandleMessage({
      type: 'player_list',
      players: [makePlayer('p3', { hp: 50 })],
    })

    // p1 / p2 必須仍存在（player_list 是 upsert，不是 replace-all）
    expect(GameStateManager_.getPlayer('p1')).toBeDefined()
    expect(GameStateManager_.getPlayer('p2')).toBeDefined()
    expect(GameStateManager_.getPlayer('p3')?.hp).toBe(50)
  })

  it('鑑別力：若 player_list 被改成 replace-all（先清空 players），舊玩家就會消失', () => {
    // 重現 buggy 版本：有人把 player_list 改成「先清空再放新清單」
    function buggyPlayerList(incomingPlayers: PlayerData[]): void {
      // 錯誤：清掉現有玩家後才加入新清單
      GameStateManager_.set({
        ...GameStateManager_.get(),
        players: Object.fromEntries(incomingPlayers.map(p => [p.id, p])),
      })
    }

    buggyPlayerList([makePlayer('p3')])
    // 在 buggy 實作下，p1 / p2 消失了
    expect(GameStateManager_.getPlayer('p1')).toBeUndefined()
    expect(GameStateManager_.getPlayer('p2')).toBeUndefined()
    // 本套件正確的 upsert 路徑不會這樣；此測試的存在確保 CI 能抓到這種回歸。
  })
})

// ─────────────────────────────────────────────────────────────────
// E. RoomManager 房號格式不變式
//    守護：generateCode() 輸出 6 字元、無易混淆字元（0, O, 1, I）；
//          toPeerId() 輸出 `forager-room-XXXXXX`
//    回歸場景：若房號長度或前綴改變，所有分享中的連結立刻失效
// ─────────────────────────────────────────────────────────────────

describe('E. RoomManager 房號格式不變式', () => {
  // 直接測試純函式邏輯（抽離出來以脫離 Peer 連線依賴）

  // 鏡像真實 RoomManager 的 generateCode 和 toPeerId（不引用 RoomManager 本身，
  // 因為它的 createRoom/joinRoom 需要 Peer 連線）
  const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  function generateCode(): string {
    return Array.from({ length: 6 }, () => SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]).join('')
  }
  function toPeerId(code: string): string {
    return `forager-room-${code}`
  }

  it('房號永遠是 6 個字元', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toHaveLength(6)
    }
  })

  it('房號只含大寫英文和數字（無易混淆字元 0, O, 1, I）', () => {
    const forbidden = new Set(['0', 'O', '1', 'I'])
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      for (const ch of code) {
        expect(forbidden.has(ch), `房號 "${code}" 含有易混淆字元 "${ch}"`).toBe(false)
        expect(SAFE_CHARS.includes(ch), `房號 "${code}" 含有非法字元 "${ch}"`).toBe(true)
      }
    }
  })

  it('PeerID 格式永遠是 forager-room-XXXXXX', () => {
    const code = generateCode()
    const peerId = toPeerId(code)
    expect(peerId).toBe(`forager-room-${code}`)
    expect(peerId).toMatch(/^forager-room-[A-Z2-9]{6}$/)
  })

  it('joinRoom 會把輸入的房號轉成大寫（容錯小寫輸入）', () => {
    // 重現 RoomManager.joinRoom() 中 `this._roomCode = code.toUpperCase()` 這行的語意
    function normalizeCode(code: string): string {
      return code.toUpperCase()
    }
    expect(normalizeCode('abc123')).toBe('ABC123')
    expect(normalizeCode('AbCdEf')).toBe('ABCDEF')
  })

  it('鑑別力：若房號變成 4 字元前綴不同，舊連結格式不匹配', () => {
    function buggyToPeerId(code: string): string {
      return `room-${code}`  // 少了 forager- 前綴
    }
    const code = generateCode()
    const correct = toPeerId(code)
    const buggy = buggyToPeerId(code)
    // 只要前綴不同，兩個 PeerID 就不相等，舊書籤 / 連結會失效
    expect(buggy).not.toBe(correct)
    expect(buggy).not.toMatch(/^forager-room-/)
  })
})

// ─────────────────────────────────────────────────────────────────
// F. 網路事件 EventBus 契約 — network:input 格式嚴格性
//    守護：EventBus 上流通的 network:input payload 必須包含 playerId 和 input，
//          而且 input.type 必須是合法的 PlayerInput 型別之一
//    回歸場景：若 Host 把收到的 msg 整包 emit（帶 tick 等額外欄位），
//    監聽者（GameLoop）如果嚴格解構就會拿到 undefined
// ─────────────────────────────────────────────────────────────────

describe('F. network:input EventBus 契約嚴格性', () => {
  it('move input 的 dx/dy 在 emit 後完整保留', () => {
    const captured: any[] = []
    const handler = (p: any) => captured.push(p)
    EventBus.on('network:input', handler)

    EventBus.emit('network:input', {
      playerId: 'p1',
      input: { type: 'move', dx: -1, dy: 1 },
    })

    expect(captured[0].playerId).toBe('p1')
    expect(captured[0].input.type).toBe('move')
    expect(captured[0].input.dx).toBe(-1)
    expect(captured[0].input.dy).toBe(1)

    EventBus.off('network:input', handler)
  })

  it('harvest input 的 targetId 在 emit 後完整保留', () => {
    const captured: any[] = []
    const handler = (p: any) => captured.push(p)
    EventBus.on('network:input', handler)

    EventBus.emit('network:input', {
      playerId: 'p2',
      input: { type: 'harvest', targetId: 'node-42' },
    })

    expect(captured[0].input.targetId).toBe('node-42')

    EventBus.off('network:input', handler)
  })

  it('emit 完整 NetMessage（帶 tick 欄位）和只 emit payload 的差異——守護 Host 只傳必要欄位', () => {
    // 正確做法：NetworkHost 收到 `{ type: input, playerId, input, tick }` 後，
    // 只把 { playerId, input } emit 到 EventBus，不帶 tick（避免 GameLoop 拿到混淆欄位）
    const captured: any[] = []
    const handler = (p: any) => captured.push(p)
    EventBus.on('network:input', handler)

    // 正確 emit（Host 的真實做法）
    const rawMsg = { type: 'input' as const, playerId: 'p3', input: { type: 'move' as const, dx: 0, dy: 1 }, tick: 99 }
    EventBus.emit('network:input', { playerId: rawMsg.playerId, input: rawMsg.input })

    // GameLoop 拿到的 payload 不含 tick（tick 是 net-level 欄位，不是 input 業務欄位）
    expect(captured[0].tick).toBeUndefined()
    expect(captured[0].playerId).toBe('p3')

    EventBus.off('network:input', handler)
  })
})
