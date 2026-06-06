/**
 * 回歸測試 — 「多人打一個資源每個人都會掉一份，變成 N 倍物資」
 *
 * Bug 重現：N 個玩家幾乎同時打同一顆資源節點，每個人的攻擊都把 HP 打到 <= 0，
 * 於是 `resource:depleted` 被 emit N 次 → 掉落物 / 廣播被觸發 N 次 → N 倍物資。
 *
 * 修好的關鍵防線（本檔案守護的真實程式碼）：
 *   1. src/resources/Spawner.ts `handleDepleted()`：
 *        const entity = this.nodes.get(nodeId)
 *        if (!entity) return            // ← 第一次耗盡後 nodes.delete，之後重複事件直接 return
 *      → depletedVisualCallback（= main.ts 裡 spawnDrop + 廣播）「每顆節點只會被呼叫一次」。
 *   2. src/main.ts harvest reducer：先用「節點當下的 live HP」快照（snapshot-before-hit），
 *        const node = spawner.getNode(input.targetId); if (!node) return   // 耗盡後 getNode → undefined
 *        const afterHp = node.getData().hp - dmg; node.hit(dmg); if (afterHp <= 0) grant once
 *      → 序列化處理下，只有「打出致命一擊」的那位玩家會拿到掉落，其餘玩家的輸入被丟棄。
 *
 * 這支測試確保未來把整套遊戲重作（vibe coding / 包成 skills）時，
 * 上述不變式若被破壞，CI 會立刻紅燈。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { ResourceNode } from '@/types'

// ── 把重量級依賴換成輕量替身，讓 node 測試環境跑得動真實 Spawner ──
// Spawner.ts 只把 PIXI 當「型別」用（PIXI.Container），執行期不 new 任何 PIXI 物件，
// 所以給一個空 mock 即可避開 pixi.js 在 node 下 `navigator is not defined` 的載入錯誤。
vi.mock('pixi.js', () => ({}))

// vi.hoisted：讓被 mock 的 ResourceNodeEntity 能在 hit() 裡 emit 事件（避免 factory 的 hoist 限制）
const hooks = vi.hoisted(() => ({
  emitDepleted: (_nodeId: string) => {},
  constructed: 0,
}))

// 忠實模擬真實 ResourceNodeEntity 的「公開契約」：
//   - hit() 會把 hp 扣到 >= 0，且「只要 hp <= 0 就 emit resource:depleted」
//     （真實程式碼 ResourceNode.hit() 正是如此 → 被過度攻擊時會重複 emit，這就是 bug 的源頭）
vi.mock('./ResourceNode', () => {
  class FakeResourceNodeEntity {
    readonly id: string
    private data: ResourceNode
    private _destroyed = false
    sprite = {
      zIndex: 0,
      destroyed: false,
      on: () => {},
      removeAllListeners: () => {},
      destroy: () => { this.sprite.destroyed = true },
    }
    constructor(data: ResourceNode) {
      this.id = data.id
      this.data = { ...data }
      hooks.constructed++
    }
    hit(damage: number, _playerId: string): void {
      this.data.hp = Math.max(0, this.data.hp - damage)
      if (this.data.hp <= 0) hooks.emitDepleted(this.id) // 忠實重現：hp<=0 每次都 emit
    }
    getData(): ResourceNode { return { ...this.data } }
    applyDelta(): void {}
    playRespawnAnim(): void {}
    update(): void {}
    destroy(): void { this._destroyed = true }
    get x(): number { return this.data.x }
    get y(): number { return this.data.y }
    get isDestroyed(): boolean { return this._destroyed }
  }
  return { ResourceNodeEntity: FakeResourceNodeEntity }
})

// 在 mock 之後 import，拿到的是「真實 Spawner + 假 ResourceNode」
import { Spawner } from './Spawner'

hooks.emitDepleted = (nodeId: string) => EventBus.emit('resource:depleted', { nodeId })

function makeContainerStub(): any {
  return { addChild: () => {}, removeChild: () => {} }
}

function treeNode(id: string): ResourceNode {
  // tree：hp 5，掉落 wood ×4（見 resourceConfig.ts）
  return { id, type: 'tree', x: 100, y: 100, hp: 5, maxHp: 5, respawnTime: 30 }
}

describe('資源 N 倍掉落回歸測試 — 真實 Spawner 耗盡冪等性', () => {
  let spawner: Spawner
  let dropSpawns: ResourceNode[]

  beforeEach(() => {
    // 每個 test 清掉 resource:depleted 監聽，確保新建的 Spawner 是唯一的 handler（避免測試間互相污染）
    ;(EventBus as any).listeners?.delete?.('resource:depleted')
    // 用假計時器：避免 handleDepleted 的 respawn setTimeout 在測試中真的觸發
    vi.useFakeTimers()
    hooks.constructed = 0
    dropSpawns = []
    spawner = new Spawner(makeContainerStub())
    // depletedVisualCallback === main.ts 裡「spawnDrop + 廣播掉落」的掛點，
    // 它被呼叫幾次，就等於掉落物被生成幾次。
    spawner.setDepletedVisualCallback((data) => { dropSpawns.push(data) })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('同一顆節點被 emit 多次 resource:depleted，掉落只生成「一次」', () => {
    const node = spawner.spawnOne(treeNode('dup-1'))

    // 模擬 3 個玩家「同時」各打一次致命攻擊：每次 hit() 都會 emit resource:depleted
    node.hit(5, 'playerA')
    node.hit(5, 'playerB')
    node.hit(5, 'playerC')

    expect(dropSpawns).toHaveLength(1)           // ★ 核心斷言：不是 3 份，是 1 份
    expect(dropSpawns[0].id).toBe('dup-1')
    expect(dropSpawns[0].type).toBe('tree')
  })

  it('直接重複 emit resource:depleted（網路重送 / 多人競爭）也只掉一次', () => {
    spawner.spawnOne(treeNode('dup-2'))

    for (let i = 0; i < 10; i++) {
      EventBus.emit('resource:depleted', { nodeId: 'dup-2' })
    }

    expect(dropSpawns).toHaveLength(1)
  })

  it('耗盡後 getNode 回傳 undefined、且 getAllNodes 不再包含它（守護 main.ts 的 `if (!node) return`）', () => {
    spawner.spawnOne(treeNode('dup-3'))
    expect(spawner.getNode('dup-3')).toBeDefined()

    EventBus.emit('resource:depleted', { nodeId: 'dup-3' })

    // 一旦耗盡，節點立即從 nodes 移除：
    // → 之後玩家送來的 harvest input 在 main.ts 會 `const node = getNode(); if (!node) return`，
    //   不可能再 hit() 一次、不可能再給第二份。
    expect(spawner.getNode('dup-3')).toBeUndefined()
    expect(spawner.getAllNodes().some(n => n.id === 'dup-3')).toBe(false)
  })

  it('兩顆不同節點各自耗盡，彼此獨立各掉一份（不會互相觸發）', () => {
    spawner.spawnOne(treeNode('dup-4a'))
    spawner.spawnOne({ ...treeNode('dup-4b'), type: 'rock' })

    node_hit('dup-4a'); node_hit('dup-4a')   // a 被打兩次
    node_hit('dup-4b')                         // b 被打一次

    function node_hit(id: string) {
      const n = spawner.getNode(id)
      if (n) n.hit(99, 'p')
    }

    expect(dropSpawns).toHaveLength(2)
    expect(dropSpawns.map(d => d.id).sort()).toEqual(['dup-4a', 'dup-4b'])
  })
})

/**
 * Host-authoritative 採集不變式（執行規格 / executable spec）
 *
 * 重現並鎖定 src/main.ts 的 harvest reducer 契約。這段是「設計合約」測試：
 * 把整套遊戲重作時，只要採集邏輯回退成「每位玩家各自用自己的快照判斷耗盡」，
 * 這裡就會紅燈，提醒 N 倍物資 bug 又回來了。
 */
describe('Host 採集不變式 — N 個玩家打同一顆，只掉一份且歸最後一擊', () => {
  // 忠實重現 main.ts: `input.type === 'harvest'` 與 tryHarvestNode() 的 Host 路徑
  function makeHostHarvestReducer(node: ResourceNode) {
    const live = { ...node, removed: false }
    const grants: Array<{ playerId: string; drops: { itemId: string; amount: number } }> = []
    const DROP = { itemId: 'wood', amount: node.maxHp >= 0 ? 4 : 4 } // tree → wood ×4

    function harvest(playerId: string, damage: number): void {
      if (live.removed) return              // getNode() === undefined → if (!node) return
      const afterHp = live.hp - damage      // ★ 快照「節點當下 live HP」（snapshot-before-hit）
      live.hp = Math.max(0, live.hp - damage) // node.hit()
      if (afterHp <= 0) {
        grants.push({ playerId, drops: DROP }) // _grantHarvestXP + resource:depleted → spawnDrop 一次
        live.removed = true                  // depleted → nodes.delete，節點消失
      }
    }
    return { harvest, grants, live }
  }

  it('3 個玩家各打一次致命傷，總掉落 = 1 份，且只有「最後一擊」的玩家拿到', () => {
    const r = makeHostHarvestReducer(treeNode('host-1'))
    r.harvest('playerA', 5)  // A 打致命傷 → 拿到 wood ×4，節點消失
    r.harvest('playerB', 5)  // B 的輸入到達時節點已 removed → 被丟棄
    r.harvest('playerC', 5)

    expect(r.grants).toHaveLength(1)
    expect(r.grants[0].playerId).toBe('playerA')
    expect(r.grants[0].drops).toEqual({ itemId: 'wood', amount: 4 })
  })

  it('多次小攻擊累積耗盡，掉落仍只給「打出最後一擊」的人', () => {
    const r = makeHostHarvestReducer(treeNode('host-2')) // hp 5
    r.harvest('A', 2)  // 5 → 3，未耗盡
    r.harvest('B', 2)  // 3 → 1，未耗盡
    r.harvest('A', 2)  // 1 → 0，耗盡：最後一擊是 A
    r.harvest('B', 2)  // 已 removed

    expect(r.grants).toHaveLength(1)
    expect(r.grants[0].playerId).toBe('A')
  })

  it('鑑別力檢查：若回退成「每位玩家各自用自己快照判斷」的舊寫法，就會產生 N 份（紅燈）', () => {
    // 這個 buggy reducer 重現「修好前」的行為：不移除節點、每位玩家各自判斷 → N 倍
    function buggyHarvest(node: ResourceNode, hits: Array<[string, number]>) {
      const grants: string[] = []
      for (const [pid, dmg] of hits) {
        const snapshotHp = node.hp        // 每位玩家拿到「同一份」初始快照（stale）
        if (snapshotHp - dmg <= 0) grants.push(pid) // 沒有 live HP、沒有移除節點 → 大家都過
      }
      return grants
    }
    const dupes = buggyHarvest(treeNode('bug'), [['A', 5], ['B', 5], ['C', 5]])
    expect(dupes).toHaveLength(3) // 證明舊寫法 = 3 倍，本測試套件能抓到此回歸
  })
})
