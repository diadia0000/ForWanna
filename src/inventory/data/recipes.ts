// Agent 6 負責 — src/inventory/data/recipes.ts
import type { RecipeDef } from '@/types'

export const RECIPES: Record<string, RecipeDef> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 1】基礎製作
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  plank: {
    id: 'plank', name: '木板',
    requires: [{ itemId: 'wood', amount: 2 }],
    produces: [{ itemId: 'plank', amount: 4 }],
    unlockLevel: 1,
  },
  axe: {
    id: 'axe', name: '斧頭',
    requires: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 3 }],
    produces: [{ itemId: 'axe', amount: 1 }],
    unlockLevel: 1,
  },
  pickaxe: {
    id: 'pickaxe', name: '石鎬',
    requires: [{ itemId: 'plank', amount: 3 }, { itemId: 'stone', amount: 5 }],
    produces: [{ itemId: 'pickaxe', amount: 1 }],
    unlockLevel: 1,
  },
  stone_sword: {
    id: 'stone_sword', name: '石劍',
    requires: [{ itemId: 'stone', amount: 6 }, { itemId: 'plank', amount: 2 }],
    produces: [{ itemId: 'stone_sword', amount: 1 }],
    unlockLevel: 1,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 2】工具與市場
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bread: {
    id: 'bread', name: '麵包',
    requires: [{ itemId: 'berry', amount: 2 }],
    produces: [{ itemId: 'bread', amount: 1 }],
    unlockLevel: 2,
  },
  flashlight: {
    id: 'flashlight', name: '手電筒',
    requires: [{ itemId: 'ingot', amount: 5 }, { itemId: 'crystal', amount: 2 }],
    produces: [{ itemId: 'flashlight', amount: 1 }],
    unlockLevel: 2,
  },
  bed: {
    id: 'bed', name: '床',
    requires: [{ itemId: 'wood', amount: 30 }, { itemId: 'plank', amount: 15 }],
    produces: [{ itemId: 'bed', amount: 1 }],
    unlockLevel: 2,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 3】工具升級
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  iron_pick: {
    id: 'iron_pick', name: '鐵鎬',
    requires: [{ itemId: 'ingot', amount: 3 }, { itemId: 'plank', amount: 2 }],
    produces: [{ itemId: 'iron_pick', amount: 1 }],
    unlockLevel: 3,
  },
  cooked_meat: {
    id: 'cooked_meat', name: '烤肉',
    requires: [{ itemId: 'meat', amount: 1 }],
    produces: [{ itemId: 'cooked_meat', amount: 1 }],
    unlockLevel: 3,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 4】弓箭與金武器
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  wood_bow: {
    id: 'wood_bow', name: '木弓',
    requires: [{ itemId: 'wood', amount: 10 }, { itemId: 'leather', amount: 10 }],
    produces: [{ itemId: 'wood_bow', amount: 1 }],
    unlockLevel: 4,
  },
  arrow: {
    id: 'arrow', name: '箭矢',
    requires: [{ itemId: 'wood', amount: 10 }],
    produces: [{ itemId: 'arrow', amount: 50 }],
    unlockLevel: 4,
  },
  ingot: {
    id: 'ingot', name: '鐵錠',
    requires: [{ itemId: 'iron', amount: 3 }, { itemId: 'wood', amount: 1 }],
    produces: [{ itemId: 'ingot', amount: 1 }],
    unlockLevel: 4,
  },
  iron_sword: {
    id: 'iron_sword', name: '鐵劍',
    requires: [{ itemId: 'ingot', amount: 4 }, { itemId: 'plank', amount: 2 }],
    produces: [{ itemId: 'iron_sword', amount: 1 }],
    unlockLevel: 4,
  },
  gold_sword: {
    id: 'gold_sword', name: '金劍',
    requires: [{ itemId: 'gold_ingot', amount: 4 }, { itemId: 'plank', amount: 2 }],
    produces: [{ itemId: 'gold_sword', amount: 1 }],
    unlockLevel: 4,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 5】防具、弓箭升級、背包
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bag_small: {
    id: 'bag_small', name: '小背包',
    requires: [{ itemId: 'leather', amount: 30 }],
    produces: [{ itemId: 'bag_small', amount: 1 }],
    unlockLevel: 5,
  },
  leather_armor: {
    id: 'leather_armor', name: '皮甲',
    requires: [{ itemId: 'leather', amount: 10 }],
    produces: [{ itemId: 'leather_armor', amount: 1 }],
    unlockLevel: 5,
  },
  iron_armor: {
    id: 'iron_armor', name: '鐵甲',
    requires: [{ itemId: 'iron', amount: 20 }],
    produces: [{ itemId: 'iron_armor', amount: 1 }],
    unlockLevel: 5,
  },
  gold_armor: {
    id: 'gold_armor', name: '黃金甲',
    requires: [{ itemId: 'gold_ingot', amount: 4 }],
    produces: [{ itemId: 'gold_armor', amount: 1 }],
    unlockLevel: 5,
  },
  iron_bow: {
    id: 'iron_bow', name: '鐵弓',
    requires: [{ itemId: 'iron', amount: 5 }, { itemId: 'wood', amount: 10 }],
    produces: [{ itemId: 'iron_bow', amount: 1 }],
    unlockLevel: 5,
  },
  fire_arrow: {
    id: 'fire_arrow', name: '火箭',
    requires: [{ itemId: 'arrow', amount: 10 }, { itemId: 'fire_essence', amount: 1 }],
    produces: [{ itemId: 'fire_arrow', amount: 10 }],
    unlockLevel: 5,
  },
  ice_arrow: {
    id: 'ice_arrow', name: '冰箭',
    requires: [{ itemId: 'arrow', amount: 10 }, { itemId: 'ice_essence', amount: 1 }],
    produces: [{ itemId: 'ice_arrow', amount: 10 }],
    unlockLevel: 5,
  },
  shield: {
    id: 'shield', name: '盾牌',
    requires: [{ itemId: 'plank', amount: 8 }, { itemId: 'iron', amount: 5 }],
    produces: [{ itemId: 'shield', amount: 1 }],
    unlockLevel: 5,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 6】防禦陷阱
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  spike_trap: {
    id: 'spike_trap', name: '刺製陷阱',
    requires: [{ itemId: 'wood', amount: 5 }, { itemId: 'stone', amount: 5 }],
    produces: [{ itemId: 'spike_trap', amount: 1 }],
    unlockLevel: 6,
  },
  fire_trap: {
    id: 'fire_trap', name: '火焰陷阱',
    requires: [{ itemId: 'wood', amount: 5 }, { itemId: 'iron', amount: 3 }],
    produces: [{ itemId: 'fire_trap', amount: 1 }],
    unlockLevel: 6,
  },
  grenade: {
    id: 'grenade', name: '手榴彈',
    requires: [{ itemId: 'stone', amount: 5 }, { itemId: 'ingot', amount: 3 }, { itemId: 'blueprint_4', amount: 1 }],
    produces: [{ itemId: 'grenade', amount: 3 }],
    unlockLevel: 6,
  },
  laser_gun: {
    id: 'laser_gun', name: '雷射槍',
    requires: [{ itemId: 'crystal', amount: 3 }, { itemId: 'ingot', amount: 5 }, { itemId: 'blueprint_1', amount: 1 }],
    produces: [{ itemId: 'laser_gun', amount: 1 }],
    unlockLevel: 6,
  },
  gourmet_1: {
    id: 'gourmet_1', name: '下午茶套餐 I',
    requires: [{ itemId: 'meat', amount: 1 }, { itemId: 'spice', amount: 1 }],
    produces: [{ itemId: 'gourmet', amount: 1 }],
    unlockLevel: 6,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 7】進階魔法
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ice_trap: {
    id: 'ice_trap', name: '冰凍陷阱',
    requires: [{ itemId: 'wood', amount: 5 }, { itemId: 'crystal', amount: 3 }],
    produces: [{ itemId: 'ice_trap', amount: 1 }],
    unlockLevel: 7,
  },
  laser_tower: {
    id: 'laser_tower', name: '雷射塔',
    requires: [{ itemId: 'crystal', amount: 10 }, { itemId: 'ingot', amount: 8 }, { itemId: 'blueprint_2', amount: 1 }],
    produces: [{ itemId: 'laser_tower', amount: 1 }],
    unlockLevel: 7,
  },
  cannon_tower: {
    id: 'cannon_tower', name: '加農砲',
    requires: [{ itemId: 'stone', amount: 15 }, { itemId: 'ingot', amount: 10 }, { itemId: 'blueprint_3', amount: 1 }],
    produces: [{ itemId: 'cannon_tower', amount: 1 }],
    unlockLevel: 7,
  },
  magic_sword: {
    id: 'magic_sword', name: '魔法劍',
    requires: [{ itemId: 'crystal', amount: 5 }, { itemId: 'gold_ingot', amount: 2 }, { itemId: 'blueprint', amount: 1 }],
    produces: [{ itemId: 'magic_sword', amount: 1 }],
    unlockLevel: 7,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 8】魔法弓、裝備、大背包
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bag_large: {
    id: 'bag_large', name: '大背包',
    requires: [{ itemId: 'leather', amount: 1000 }],
    produces: [{ itemId: 'bag_large', amount: 1 }],
    unlockLevel: 8,
  },
  magic_bow: {
    id: 'magic_bow', name: '魔法弓',
    requires: [{ itemId: 'crystal', amount: 3 }, { itemId: 'blueprint', amount: 1 }],
    produces: [{ itemId: 'magic_bow', amount: 1 }],
    unlockLevel: 8,
  },
  crystal_armor: {
    id: 'crystal_armor', name: '晶體甲',
    requires: [{ itemId: 'crystal', amount: 5 }],
    produces: [{ itemId: 'crystal_armor', amount: 1 }],
    unlockLevel: 8,
  },
  whirlwind_hammer: {
    id: 'whirlwind_hammer', name: '旋風槌',
    requires: [{ itemId: 'gold_ingot', amount: 10 }, { itemId: 'crystal', amount: 5 }, { itemId: 'blueprint_5', amount: 1 }],
    produces: [{ itemId: 'whirlwind_hammer', amount: 1 }],
    unlockLevel: 8,
  },
  gourmet_2: {
    id: 'gourmet_2', name: '下午茶套餐 II',
    requires: [{ itemId: 'meat', amount: 2 }, { itemId: 'spice', amount: 2 }, { itemId: 'seasoning', amount: 1 }],
    produces: [{ itemId: 'gourmet', amount: 1 }],
    unlockLevel: 8,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 9】終極裝備
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mithril_sword: {
    id: 'mithril_sword', name: '秘銀劍',
    requires: [{ itemId: 'ancient_crystal', amount: 1 }, { itemId: 'gold_sword', amount: 1 }],
    produces: [{ itemId: 'mithril_sword', amount: 1 }],
    unlockLevel: 9,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【Research Lv 10】傳說級配方
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  laser_orb: {
    id: 'laser_orb', name: '魔法球',
    requires: [{ itemId: 'crystal', amount: 3 }, { itemId: 'gold_ingot', amount: 2 }, { itemId: 'blueprint', amount: 1 }],
    produces: [{ itemId: 'laser_orb', amount: 1 }],
    unlockLevel: 10,
  },
}
