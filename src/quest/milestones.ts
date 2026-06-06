// src/quest/milestones.ts — FTB Quest 風格進度里程碑

export type MilestoneCategory = 'gather' | 'combat' | 'build' | 'explore'

export interface Milestone {
  id:       string
  title:    string
  desc:     string
  category: MilestoneCategory
  icon:     string
  goal:     number          // 目標數量
  trackKey: string          // QuestSystem 內部計數鍵
}

export const MILESTONES: Milestone[] = [
  // ── 🌿 採集 ──────────────────────────────────────────────────
  { id: 'wood10',   title: '砍柴入門',   desc: '收集 10 木材',    category: 'gather',  icon: '🪵', goal: 10, trackKey: 'wood'    },
  { id: 'stone10',  title: '礦工初體驗', desc: '收集 10 石頭',    category: 'gather',  icon: '🪨', goal: 10, trackKey: 'stone'   },
  { id: 'iron5',    title: '鐵器曙光',   desc: '收集 5 鐵礦',     category: 'gather',  icon: '⬛', goal:  5, trackKey: 'iron'    },
  { id: 'gold3',    title: '黃金獵人',   desc: '收集 3 金礦',     category: 'gather',  icon: '🟨', goal:  3, trackKey: 'gold'    },
  { id: 'crystal1', title: '水晶使者',   desc: '收集 1 水晶',     category: 'gather',  icon: '💎', goal:  1, trackKey: 'crystal' },

  // ── ⚔️ 戰鬥 ──────────────────────────────────────────────────
  { id: 'kill1',    title: '初戰告捷',   desc: '擊殺第 1 個怪物',  category: 'combat',  icon: '⚔️', goal:  1, trackKey: 'kills'   },
  { id: 'kill10',   title: '戰士',       desc: '累計擊殺 10 個',   category: 'combat',  icon: '🗡️', goal: 10, trackKey: 'kills'   },
  { id: 'kill50',   title: '怪物獵人',   desc: '累計擊殺 50 個',   category: 'combat',  icon: '💀', goal: 50, trackKey: 'kills'   },
  { id: 'coin20',   title: '小有積蓄',   desc: '累積 20 金幣',     category: 'combat',  icon: '🪙', goal: 20, trackKey: 'gold_earned' },
  { id: 'coin100',  title: '富甲一方',   desc: '累積 100 金幣',    category: 'combat',  icon: '💰', goal: 100,trackKey: 'gold_earned' },
  { id: 'survive3', title: '熬夜老手',   desc: '熬過 3 個夜晚',    category: 'combat',  icon: '🌙', goal:  3, trackKey: 'nights'  },

  // ── 🏗️ 建設 ──────────────────────────────────────────────────
  { id: 'build1',   title: '奠基者',     desc: '放置第一棟建築',   category: 'build',   icon: '🏗️', goal:  1, trackKey: 'buildings' },
  { id: 'build5',   title: '村莊建設者', desc: '放置 5 棟建築',    category: 'build',   icon: '🏘️', goal:  5, trackKey: 'buildings' },
  { id: 'sword1',   title: '鑄劍師',     desc: '製作第一把石劍',   category: 'build',   icon: '🗡️', goal:  1, trackKey: 'stone_sword' },
  { id: 'iron_sw',  title: '鐵匠師傅',   desc: '製作鐵劍',         category: 'build',   icon: '⚔️', goal:  1, trackKey: 'iron_sword'  },
  { id: 'blueprint1',title: '藍圖蒐集者',desc: '獲得 1 張設計圖',  category: 'build',   icon: '📜', goal:  1, trackKey: 'blueprint'   },
  { id: 'barracks1',title: '兵團長',     desc: '建造兵營',         category: 'build',   icon: '⚔️', goal:  1, trackKey: 'barracks'    },

  // ── 🗺️ 探索 ──────────────────────────────────────────────────
  { id: 'night1',   title: '第一個夜晚', desc: '第一次撐過夜晚',   category: 'explore', icon: '🌑', goal:  1, trackKey: 'nights'  },
]

export const CATEGORY_ICONS: Record<MilestoneCategory, string> = {
  gather:  '🌿',
  combat:  '⚔️',
  build:   '🏗️',
  explore: '🗺️',
}

export const CATEGORY_NAMES: Record<MilestoneCategory, string> = {
  gather:  '採集',
  combat:  '戰鬥',
  build:   '建設',
  explore: '探索',
}
