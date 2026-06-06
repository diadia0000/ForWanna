import { describe, it, expect } from 'vitest'
import { Inventory } from './Inventory'

describe('Inventory', () => {
  it('add 已知物品後 getAmount 反映數量', () => {
    const pid = 'inv-test-1'
    expect(Inventory.add(pid, 'wood', 5)).toBe(true)
    expect(Inventory.getAmount(pid, 'wood')).toBe(5)
  })

  it('重複 add 會堆疊', () => {
    const pid = 'inv-test-2'
    Inventory.add(pid, 'stone', 3)
    Inventory.add(pid, 'stone', 4)
    expect(Inventory.getAmount(pid, 'stone')).toBe(7)
  })

  it('add 未知物品回傳 false', () => {
    const pid = 'inv-test-3'
    expect(Inventory.add(pid, 'not_a_real_item', 1)).toBe(false)
    expect(Inventory.getAmount(pid, 'not_a_real_item')).toBe(0)
  })

  it('堆疊到既有格時不超過 maxStack（crystal maxStack=99）', () => {
    const pid = 'inv-test-4'
    Inventory.add(pid, 'crystal', 50)
    Inventory.add(pid, 'crystal', 80) // 50 + 80 = 130 → clamp 到 99
    expect(Inventory.getAmount(pid, 'crystal')).toBe(99)
  })

  it('首次 add 建立新格時也 clamp 到 maxStack（crystal maxStack=99）', () => {
    const pid = 'inv-test-4b'
    Inventory.add(pid, 'crystal', 200) // 超過 maxStack=99，應被 clamp
    expect(Inventory.getAmount(pid, 'crystal')).toBe(99)
  })

  it('remove 扣除數量，扣到 0 會移除該格', () => {
    const pid = 'inv-test-5'
    Inventory.add(pid, 'wood', 10)
    expect(Inventory.remove(pid, 'wood', 4)).toBe(true)
    expect(Inventory.getAmount(pid, 'wood')).toBe(6)
    expect(Inventory.remove(pid, 'wood', 6)).toBe(true)
    expect(Inventory.getAmount(pid, 'wood')).toBe(0)
    expect(Inventory.get(pid).find(i => i.itemId === 'wood')).toBeUndefined()
  })

  it('數量不足時 remove 回傳 false 且不改動', () => {
    const pid = 'inv-test-6'
    Inventory.add(pid, 'iron', 2)
    expect(Inventory.remove(pid, 'iron', 5)).toBe(false)
    expect(Inventory.getAmount(pid, 'iron')).toBe(2)
  })

  it('setInventory 覆蓋整個背包', () => {
    const pid = 'inv-test-7'
    Inventory.add(pid, 'wood', 1)
    Inventory.setInventory(pid, [{ itemId: 'gold', amount: 3 }])
    expect(Inventory.getAmount(pid, 'wood')).toBe(0)
    expect(Inventory.getAmount(pid, 'gold')).toBe(3)
  })
})
