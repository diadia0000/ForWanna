// Agent 7 負責 — src/building/data/buildings.ts
import type { BuildingDef } from '@/types'

export const BUILDING_DEFS: Record<string, BuildingDef> = {
  // ── 基礎 ────────────────────────────────────────────────
  furnace: {
    id: 'furnace', name: '熔爐',
    cost: [{ itemId: 'stone', amount: 2 }],
    size: { x: 1, y: 1 },
    effect: '自動冶煉礦石',
  },
  farm: {
    id: 'farm', name: '農場',
    cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 3 }],
    size: { x: 2, y: 2 },
    effect: '自動生產食物',
  },
  market: {
    id: 'market', name: '市場',
    cost: [{ itemId: 'wood', amount: 8 }, { itemId: 'stone', amount: 5 }],
    size: { x: 2, y: 2 },
    effect: '可以販賣物品換金幣',
  },
  research_lab: {
    id: 'research_lab', name: '工作站',
    cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'stone', amount: 10 }, { itemId: 'iron', amount: 3 }],
    size: { x: 3, y: 1 },
    effect: '靠近後按 E 開啟工作站，依需求選擇研究路線以解鎖更多配方',
  },
  // ── 實用 ────────────────────────────────────────────────
  wooden_bridge: {
    id: 'wooden_bridge', name: '木橋',
    cost: [{ itemId: 'plank', amount: 4 }],
    size: { x: 1, y: 1 },
    effect: '允許穿過水面（建造 10 秒）',
  },
  // ── 防禦 ────────────────────────────────────────────────
  wall: {
    id: 'wall', name: '石牆',
    cost: [{ itemId: 'stone', amount: 8 }],
    size: { x: 1, y: 1 },
    effect: '阻擋怪物進入，構築堡壘防線',
  },
  tower: {
    id: 'tower', name: '瞭望塔',
    cost: [{ itemId: 'stone', amount: 12 }, { itemId: 'plank', amount: 6 }],
    size: { x: 1, y: 1 },
    effect: '自動攻擊 4 格範圍內的怪物',
  },
  // ── 陷阱（Research Lv 6-7） ───────────────────────────────
  spike_trap: {
    id: 'spike_trap', name: '刺製陷阱',
    cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 5 }],
    size: { x: 1, y: 1 },
    effect: '踩踏自動造成傷害 + 減速 50%（破損後透明失效）',
  },
  fire_trap: {
    id: 'fire_trap', name: '火焰陷阱',
    cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'iron', amount: 3 }],
    size: { x: 1, y: 1 },
    effect: '踩踏自動造成傷害 + 灼燒 3 秒（破損後透明失效）',
  },
  ice_trap: {
    id: 'ice_trap', name: '冰凍陷阱',
    cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'crystal', amount: 3 }],
    size: { x: 1, y: 1 },
    effect: '踩踏自動造成傷害 + 凍結 1.5 秒（破損後透明失效）',
  },
  // ── 基地核心 ──────────────────────────────────────────────
  base_core: {
    id: 'base_core', name: '基地核心',
    cost: [{ itemId: 'stone', amount: 30 }, { itemId: 'wood', amount: 10 }, { itemId: 'ingot', amount: 5 }],
    size: { x: 2, y: 2 },
    effect: '8格範圍內玩家獲得HP/ATK加成與被動回血，怪物優先攻擊此建築',
  },
  // ── 進階（需設計圖） ─────────────────────────────────────
  barracks: {
    id: 'barracks', name: '兵營',
    cost: [{ itemId: 'stone', amount: 20 }, { itemId: 'ingot', amount: 8 }, { itemId: 'blueprint', amount: 1 }],
    size: { x: 2, y: 2 },
    effect: '每 30 秒自動召喚士兵協助戰鬥',
  },
  laser_tower: {
    id: 'laser_tower', name: '雷射塔',
    cost: [{ itemId: 'crystal', amount: 10 }, { itemId: 'ingot', amount: 8 }, { itemId: 'blueprint_2', amount: 1 }],
    size: { x: 1, y: 2 },
    effect: '自動攻擊 15 格範圍內怪物（50+Lv×20 傷害，2 秒冷卻）',
  },
  cannon_tower: {
    id: 'cannon_tower', name: '加農砲',
    cost: [{ itemId: 'stone', amount: 15 }, { itemId: 'ingot', amount: 10 }, { itemId: 'blueprint_3', amount: 1 }],
    size: { x: 1, y: 2 },
    effect: '自動發射砲彈（20+Lv×8 傷害，爆炸半徑 2 格，3.5 秒冷卻）',
  },
  // ── 神聖建築 ──────────────────────────────────────────────
  goddess_statue: {
    id: 'goddess_statue', name: '女神像',
    cost: [
      { itemId: 'stone',      amount: 30 },
      { itemId: 'crystal',    amount: 3  },
      { itemId: 'gold_ingot', amount: 2  },
    ],
    size: { x: 1, y: 1 },
    effect: '靠近後按 E 祈禱，召喚周圍大量資源（3 分鐘冷卻）',
  },
}

// ── 陷阱維修成本（HP=0後按R修復） ───────────────────────────────────
export const TRAP_REPAIR_COST: Record<string, Array<{ itemId: string; amount: number }>> = {
  spike_trap: [{ itemId: 'wood', amount: 5 }],
  fire_trap:  [{ itemId: 'iron', amount: 3 }],
  ice_trap:   [{ itemId: 'crystal', amount: 2 }],
  tower:      [{ itemId: 'stone', amount: 6 }, { itemId: 'plank', amount: 3 }],
}

// ── 建築升級配置 ──────────────────────────────────────────────────
export const BUILDING_UPGRADES: Record<string, Array<{ level: number; cost: typeof BUILDING_DEFS['wall']['cost']; hp: number }>> = {
  wall: [
    { level: 1, cost: [{ itemId: 'stone', amount: 8 }], hp: 50 },
    { level: 2, cost: [{ itemId: 'stone', amount: 16 }], hp: 75 },
    { level: 3, cost: [{ itemId: 'stone', amount: 24 }, { itemId: 'iron', amount: 5 }], hp: 100 },
    { level: 4, cost: [{ itemId: 'stone', amount: 32 }, { itemId: 'iron', amount: 10 }], hp: 125 },
    { level: 5, cost: [{ itemId: 'stone', amount: 40 }, { itemId: 'ingot', amount: 5 }], hp: 150 },
  ],
  tower: [
    { level: 1, cost: [{ itemId: 'stone', amount: 12 }, { itemId: 'plank', amount: 6 }], hp: 60 },
    { level: 2, cost: [{ itemId: 'stone', amount: 24 }, { itemId: 'plank', amount: 12 }], hp: 90 },
    { level: 3, cost: [{ itemId: 'stone', amount: 36 }, { itemId: 'iron', amount: 8 }], hp: 120 },
    { level: 4, cost: [{ itemId: 'stone', amount: 48 }, { itemId: 'ingot', amount: 6 }], hp: 150 },
    { level: 5, cost: [{ itemId: 'stone', amount: 60 }, { itemId: 'ingot', amount: 12 }], hp: 180 },
  ],
  spike_trap: [
    { level: 1, cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 5 }], hp: 50 },
    { level: 2, cost: [{ itemId: 'wood', amount: 10 }, { itemId: 'stone', amount: 10 }], hp: 75 },
    { level: 3, cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'iron', amount: 5 }], hp: 100 },
  ],
  fire_trap: [
    { level: 1, cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'iron', amount: 3 }], hp: 75 },
    { level: 2, cost: [{ itemId: 'wood', amount: 10 }, { itemId: 'iron', amount: 6 }], hp: 100 },
    { level: 3, cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'ingot', amount: 4 }], hp: 125 },
  ],
  ice_trap: [
    { level: 1, cost: [{ itemId: 'wood', amount: 5 }, { itemId: 'crystal', amount: 3 }], hp: 100 },
    { level: 2, cost: [{ itemId: 'wood', amount: 10 }, { itemId: 'crystal', amount: 6 }], hp: 125 },
    { level: 3, cost: [{ itemId: 'wood', amount: 15 }, { itemId: 'crystal', amount: 12 }], hp: 150 },
  ],
  barracks: [
    { level: 1, cost: [{ itemId: 'stone', amount: 20 }, { itemId: 'ingot', amount: 8 }], hp: 300 },
    { level: 2, cost: [{ itemId: 'ingot', amount: 15 }, { itemId: 'stone', amount: 30 }], hp: 450 },
    { level: 3, cost: [{ itemId: 'ingot', amount: 25 }, { itemId: 'crystal', amount: 5 }], hp: 600 },
  ],
  laser_tower: [
    { level: 1, cost: [{ itemId: 'crystal', amount: 10 }, { itemId: 'ingot', amount: 8 }], hp: 120 },
    { level: 2, cost: [{ itemId: 'crystal', amount: 20 }, { itemId: 'ingot', amount: 15 }], hp: 180 },
    { level: 3, cost: [{ itemId: 'crystal', amount: 30 }, { itemId: 'ancient_crystal', amount: 3 }], hp: 240 },
    { level: 4, cost: [{ itemId: 'crystal', amount: 45 }, { itemId: 'ancient_crystal', amount: 6 }], hp: 300 },
    { level: 5, cost: [{ itemId: 'ancient_crystal', amount: 10 }], hp: 360 },
  ],
  cannon_tower: [
    { level: 1, cost: [{ itemId: 'stone', amount: 15 }, { itemId: 'ingot', amount: 10 }], hp: 180 },
    { level: 2, cost: [{ itemId: 'stone', amount: 30 }, { itemId: 'ingot', amount: 18 }], hp: 250 },
    { level: 3, cost: [{ itemId: 'ingot', amount: 25 }, { itemId: 'crystal', amount: 8 }], hp: 320 },
    { level: 4, cost: [{ itemId: 'ingot', amount: 35 }, { itemId: 'crystal', amount: 15 }], hp: 400 },
    { level: 5, cost: [{ itemId: 'crystal', amount: 20 }, { itemId: 'ancient_crystal', amount: 8 }], hp: 480 },
  ],
  base_core: [
    { level: 1,  cost: [],                                                                                    hp: 500  },
    { level: 2,  cost: [{ itemId: 'wood', amount: 100 }, { itemId: 'stone', amount: 50 }],                   hp: 650  },
    { level: 3,  cost: [{ itemId: 'wood', amount: 200 }, { itemId: 'stone', amount: 100 }],                  hp: 800  },
    { level: 4,  cost: [{ itemId: 'ingot', amount: 100 }, { itemId: 'wood', amount: 200 }],                  hp: 1000 },
    { level: 5,  cost: [{ itemId: 'ingot', amount: 50 }, { itemId: 'gold', amount: 100 }],                   hp: 1200 },
    { level: 6,  cost: [{ itemId: 'crystal', amount: 100 }],                                                 hp: 1500 },
    { level: 7,  cost: [{ itemId: 'crystal', amount: 150 }, { itemId: 'ancient_crystal', amount: 50 }],      hp: 1800 },
    { level: 8,  cost: [{ itemId: 'crystal', amount: 200 }, { itemId: 'ancient_crystal', amount: 100 }],     hp: 2200 },
    { level: 9,  cost: [{ itemId: 'crystal', amount: 300 }, { itemId: 'ancient_crystal', amount: 150 }],     hp: 2700 },
    { level: 10, cost: [{ itemId: 'crystal', amount: 500 }, { itemId: 'ancient_crystal', amount: 250 }],     hp: 3500 },
  ],
}
