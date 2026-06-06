---
name: quest-milestones
description: Look up here when rebuilding the milestone data — full schema, every entry with exact id/trackKey/goal values, category icons, and category names.
---

# quest/milestones.ts

> 模組：quest｜角色：純資料定義，無邏輯，提供所有里程碑記錄與分類常數

## 公開 API

- `MILESTONES: Milestone[]` — 所有里程碑的有序陣列（17 筆）
- `CATEGORY_ICONS: Record<MilestoneCategory, string>` — 各分類的 emoji 圖示
- `CATEGORY_NAMES: Record<MilestoneCategory, string>` — 各分類的中文名稱
- `type MilestoneCategory` — `'gather' | 'combat' | 'build' | 'explore'`
- `interface Milestone` — 單筆里程碑的型別定義

## 核心邏輯

### Milestone 介面

```typescript
export interface Milestone {
  id:       string           // 唯一識別，也是 i18n key 前綴：quest.${id}.title / .desc
  title:    string           // 中文 fallback 標題
  desc:     string           // 中文 fallback 描述
  category: MilestoneCategory
  icon:     string           // emoji
  goal:     number           // 完成所需數量
  trackKey: string           // QuestSystem 內計數鍵，多個里程碑可共用同一個 key
}
```

### 完整 MILESTONES 陣列

```typescript
export const MILESTONES: Milestone[] = [
  // 採集 (gather)
  { id: 'wood10',      title: '砍柴入門',    desc: '收集 10 木材',      category: 'gather',  icon: '🪵', goal: 10,  trackKey: 'wood'        },
  { id: 'stone10',     title: '礦工初體驗',  desc: '收集 10 石頭',      category: 'gather',  icon: '🪨', goal: 10,  trackKey: 'stone'       },
  { id: 'iron5',       title: '鐵器曙光',    desc: '收集 5 鐵礦',       category: 'gather',  icon: '⬛', goal:  5,  trackKey: 'iron'        },
  { id: 'gold3',       title: '黃金獵人',    desc: '收集 3 金礦',       category: 'gather',  icon: '🟨', goal:  3,  trackKey: 'gold'        },
  { id: 'crystal1',    title: '水晶使者',    desc: '收集 1 水晶',       category: 'gather',  icon: '💎', goal:  1,  trackKey: 'crystal'     },

  // 戰鬥 (combat)
  { id: 'kill1',       title: '初戰告捷',    desc: '擊殺第 1 個怪物',   category: 'combat',  icon: '⚔️', goal:  1,  trackKey: 'kills'       },
  { id: 'kill10',      title: '戰士',        desc: '累計擊殺 10 個',    category: 'combat',  icon: '🗡️', goal: 10,  trackKey: 'kills'       },
  { id: 'kill50',      title: '怪物獵人',    desc: '累計擊殺 50 個',    category: 'combat',  icon: '💀', goal: 50,  trackKey: 'kills'       },
  { id: 'coin20',      title: '小有積蓄',    desc: '累積 20 金幣',      category: 'combat',  icon: '🪙', goal: 20,  trackKey: 'gold_earned' },
  { id: 'coin100',     title: '富甲一方',    desc: '累積 100 金幣',     category: 'combat',  icon: '💰', goal: 100, trackKey: 'gold_earned' },
  { id: 'survive3',    title: '熬夜老手',    desc: '熬過 3 個夜晚',     category: 'combat',  icon: '🌙', goal:  3,  trackKey: 'nights'      },

  // 建設 (build)
  { id: 'build1',      title: '奠基者',      desc: '放置第一棟建築',    category: 'build',   icon: '🏗️', goal:  1,  trackKey: 'buildings'   },
  { id: 'build5',      title: '村莊建設者',  desc: '放置 5 棟建築',     category: 'build',   icon: '🏘️', goal:  5,  trackKey: 'buildings'   },
  { id: 'sword1',      title: '鑄劍師',      desc: '製作第一把石劍',    category: 'build',   icon: '🗡️', goal:  1,  trackKey: 'stone_sword' },
  { id: 'iron_sw',     title: '鐵匠師傅',    desc: '製作鐵劍',          category: 'build',   icon: '⚔️', goal:  1,  trackKey: 'iron_sword'  },
  { id: 'blueprint1',  title: '藍圖蒐集者',  desc: '獲得 1 張設計圖',   category: 'build',   icon: '📜', goal:  1,  trackKey: 'blueprint'   },
  { id: 'barracks1',   title: '兵團長',      desc: '建造兵營',          category: 'build',   icon: '⚔️', goal:  1,  trackKey: 'barracks'    },

  // 探索 (explore)
  { id: 'night1',      title: '第一個夜晚',  desc: '第一次撐過夜晚',    category: 'explore', icon: '🌑', goal:  1,  trackKey: 'nights'      },
]
```

### 分類常數

```typescript
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
```

## EventBus 互動

無。

## 依賴

無（純資料定義）。

## 重建提示

- `trackKey` 命名不等同於資源 type 名稱：金幣用 `gold_earned`（非 `gold`）；`gold` 這個 key 是給採集金礦用的。`nights` 被 `survive3`（combat）和 `night1`（explore）兩個不同分類的里程碑共用。
- `kills`、`buildings`、`gold_earned`、`nights` 這四個 trackKey 有多個里程碑共用——QuestSystem 的 `_checkMilestones` 全掃才能正確處理。
- i18n key 格式：`quest.${id}.title` / `quest.${id}.desc`，fallback 為欄位內的中文字串。
- `CATEGORY_ICONS` 和 `CATEGORY_NAMES` 分開存放；QuestUI 使用 `CATEGORY_ICONS` 做 tab 按鈕，`CATEGORY_NAMES` 目前僅備用（未在 QuestUI 直接渲染，tab 文字走 `t('quest.category.${cat}')`）。
- 總計 17 筆里程碑：gather 5、combat 6、build 6、explore 1。`MILESTONES.length === 17`。
- `id` 值在 QuestSystem 的 `completed: Set<string>` 內當 key，也是 i18n key 前綴，重建時不可改動。
