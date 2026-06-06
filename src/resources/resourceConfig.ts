/**
 * 資源節點全局設定表
 * hp          → 血量（需要攻擊幾下才能採集）
 * drops       → 掉落物清單（amount 可加技能加成倍率）
 * respawnTime → 重生時間（秒）
 */
export interface ResourceConfig {
  hp:          number
  drops:       Array<{ itemId: string; amount: number }>
  respawnTime: number
}

export const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  // hp 調整：符合 System 5 設計目標
  // 徒手(resDmg=0.5) / 斧頭(2.0) / 石鎬(3.0) / 鐵鎬(5.0)
  tree:    { hp: 5,  drops: [{ itemId: 'wood',    amount: 4 }], respawnTime: 30  },
  rock:    { hp: 8,  drops: [{ itemId: 'stone',   amount: 4 }], respawnTime: 45  },
  iron:    { hp: 10, drops: [{ itemId: 'iron',    amount: 3 }], respawnTime: 60  },
  gold:    { hp: 15, drops: [{ itemId: 'gold',    amount: 2 }], respawnTime: 90  },
  crystal: { hp: 20, drops: [{ itemId: 'crystal', amount: 2 }], respawnTime: 120 },
  berry:   { hp: 3,  drops: [{ itemId: 'berry',   amount: 3 }], respawnTime: 20  },
  tomato:  { hp: 3,  drops: [{ itemId: 'tomato',  amount: 3 }], respawnTime: 20  },
  purple_grape: { hp: 3, drops: [{ itemId: 'purple_grape', amount: 3 }], respawnTime: 20 },
  onion:   { hp: 3,  drops: [{ itemId: 'onion',   amount: 3 }], respawnTime: 20  },
  carrot:  { hp: 3,  drops: [{ itemId: 'carrot',  amount: 3 }], respawnTime: 20  },
  pumpkin: { hp: 3,  drops: [{ itemId: 'pumpkin', amount: 3 }], respawnTime: 20  },
  watermelon: { hp: 3, drops: [{ itemId: 'watermelon', amount: 3 }], respawnTime: 20 },
  // ── 特殊區域資源 ─────────────────────────────────────────
  // 火焰岩漿石：沙漠生物群（desert biome），需鐵鎬採集
  fire_node: { hp: 12, drops: [{ itemId: 'fire_essence', amount: 2 }], respawnTime: 120 },
  // 冰晶：雪地生物群（snow biome），需鐵鎬採集
  ice_node:  { hp: 12, drops: [{ itemId: 'ice_essence',  amount: 2 }], respawnTime: 120 },
}
