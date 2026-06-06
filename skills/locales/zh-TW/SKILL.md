---
name: locales-zh-tw
description: zh-TW（繁體中文）語系的完整翻譯字串資料，逐檔涵蓋全部 22 個 namespace 的實際 key/value。重建 i18n 繁中字串、新增或對照翻譯、確保中英 key 對齊時，直接照這份還原 src/locales/zh-TW/ 整個目錄。
---

# locales/zh-TW/

> 模組：locales｜角色：繁體中文語系的翻譯字串，依 namespace 分檔。本份只負責「字串內容本身」；i18n 的載入機制、t() 實作請看 core/i18n/* 的 skill。

## Namespace 清單（共 22 檔）
每檔皆為 `const <name> = {...}; export default <name>`（多數標註 `Record<string, any>`）。

- `armor` — 防具名稱（與 item 中防具同名，僅 `{ name }`）
- `building` — 建築名稱 + 效果說明 + upgrade 子物件
- `common` — 共用字串（**目前為空物件 `{}`**，佔位）
- `dungeon` — 遺跡（傳送門/Boss/寶箱/敵人/樓層）
- `game` — 遊戲流程浮動文字、互動提示、地圖/重連/拆除/難度面板（最大檔之一）
- `hud` — 抬頭顯示：存檔、房號、操作說明 dock
- `index` — barrel，把 22 個 namespace 組成 default export（見 locales-index skill）
- `item` — 所有物品名稱（原料/加工/工具/武器/食物/防具/陷阱/資源/設計圖/道具…）+ rarity
- `lobby` — 大廳/角色建立/房間建立加入/存檔管理
- `monster` — 怪物名稱（史萊姆/青蛙/浣熊/地精/骷髏/天狗/武士 Boss）
- `network` — 連線錯誤訊息
- `quest` — 任務面板/分類/toast + 18 個里程碑 title/desc
- `recipe` — 配方顯示名稱（依 Research Lv 分組，與 item 名稱對應）
- `render` — 渲染層字串（目前僅日夜「第 N 天」）
- `research` — 各研究等級解鎖說明（lv2~lv10）
- `resource` — 場上可採集資源節點名稱
- `save` — 存檔/載入/匯入匯出狀態訊息
- `toast` — 通用 toast（金幣/材料不足、研究、存檔）
- `treasure` — 寶箱互動/獎勵/稀有度/寶箱標籤
- `ui` — 各面板 UI 文字（common/bag/market/furnace/research/building/barracks/base_core/equip/hotbar/crafting，最大檔）
- `weapon` — 武器名稱（含徒手 fist）
- `world` — 世界相關字串（**目前為空物件 `{}`**，佔位）

## 各 namespace 字串內容

### armor.ts
```typescript
const armor: Record<string, any> = {
  leather_armor: { name: '皮甲' },
  iron_armor:    { name: '鐵甲' },
  gold_armor:    { name: '黃金甲' },
  crystal_armor: { name: '晶體甲' },
  shield:        { name: '盾牌' },
}
export default armor
```

### building.ts
```typescript
const building = {
  furnace:        { name: '熔爐',    effect: '自動冶煉礦石' },
  farm:           { name: '農場',    effect: '自動生產食物' },
  market:         { name: '市場',    effect: '可以販賣物品換金幣' },
  research_lab:   { name: '工作站',  effect: '靠近後按 E 開啟工作站，依需求選擇研究路線以解鎖更多配方' },
  wooden_bridge:  { name: '木橋',    effect: '允許穿過水面（建造 10 秒）' },
  wall:           { name: '石牆',    effect: '阻擋怪物進入，構築堡壘防線' },
  tower:          { name: '瞭望塔',  effect: '自動攻擊 4 格範圍內的怪物' },
  spike_trap:     { name: '刺製陷阱', effect: '踩踏自動造成傷害 + 減速 50%（破損後透明失效）' },
  fire_trap:      { name: '火焰陷阱', effect: '踩踏自動造成傷害 + 灼燒 3 秒（破損後透明失效）' },
  ice_trap:       { name: '冰凍陷阱', effect: '踩踏自動造成傷害 + 凍結 1.5 秒（破損後透明失效）' },
  base_core:      { name: '基地核心', effect: '8格範圍內玩家獲得HP/ATK加成與被動回血，怪物優先攻擊此建築' },
  barracks:       { name: '兵營',    effect: '每 30 秒自動召喚士兵協助戰鬥' },
  laser_tower:    { name: '雷射塔',  effect: '自動攻擊 15 格範圍內怪物（50+Lv×20 傷害，2 秒冷卻）' },
  cannon_tower:   { name: '加農砲',  effect: '自動發射砲彈（20+Lv×8 傷害，爆炸半徑 2 格，3.5 秒冷卻）' },
  goddess_statue: { name: '女神像',  effect: '靠近後按 E 祈禱，召喚周圍大量資源（3 分鐘冷卻）' },
  upgrade: {
    level:   '等級',
    upgrade: '升級',
    repair:  '修復',
    cost:    '費用',
  },
}
export default building
```

### common.ts
```typescript
// 由模組擁有者填內容，例如 { wood: { name: '木材' } }
const common: Record<string, any> = {}
export default common
```

### dungeon.ts
```typescript
const dungeon = {
  portal: {
    exit: '出口',
    enter: '進入遺跡',
    leave: '離開遺跡',
  },
  boss: {
    label: '守護者',
    defeated: '守護者已被擊敗！',
  },
  chest: {
    common: '普通寶箱',
    rare: '稀有寶箱',
    epic: '史詩寶箱',
    hint: '靠近按 F 開啟寶箱',
  },
  enemy: {
    label: '遺跡守衛',
  },
  floor: {
    notice: '你進入了遺跡 —— 小心！',
  },
}
export default dungeon
```

### game.ts
```typescript
const game: Record<string, any> = {
  // ── 浮動文字 ───────────────────────────────────────────────
  no_grenade:           '沒有手榴彈了',
  grenade_explode:      '💥 爆炸！',
  no_food:              '沒有食物了',
  cant_build_dungeon:   '遺跡內無法建造',
  bag_no_space:         '⚠ 背包空格不足！',
  cant_equip:           '此物品無法裝備',
  defense_pct:          '防禦',
  default_player_name:  '玩家',
  unequip_armor:        '卸下 {name}',
  equip_armor:          '裝備 {name}！',
  daytime_now:          '🌞 現在是白天…',
  bed_launched:         '🛸 你還想享受和平的夜晚嗎？',
  bed_crash:            '💥 墜落！',
  bed_dead_respawn:     '💀 陣亡 → 重生',
  no_nearby_island:     '附近沒有可解鎖的島嶼',
  island_need_gold:     '需要 {cost} 🪙',
  island_need_gold_unlock: '需要 {cost} 🪙 才能解鎖',
  goddess_cooldown:     '女神像冷卻中 ({remaining}s)',
  praying:              '🙏 祈禱中…',
  leave_dungeon:        '⬆️ 離開遺跡',
  enter_dungeon:        '⬇️ 進入遺跡…',
  smelt_need_ore:       '🔥 需要 {ore}',
  market_not_enough:    '🏪 沒有足夠的物品',
  market_get_item:      '📜 獲得 {name}！',
  trap_repair_done:     '🔧 陷阱修復完成',
  trap_repair_no_mat:   '🔧 材料不足',
  flashlight_on:        '🔦 開',
  flashlight_off:       '🔦 關',
  soldier_dead:         '士兵陣亡',
  building_damaged:     '💥 建築損壞！',
  demolish_done:        '🔨 拆除完成（返還 75%）',
  bag_put_in:           '放入 {name} ×{amount}',
  bag_item_into:        '放入 {name} ×{amount}',
  attack_fist:          '👊',
  attack_weapon:        '⚔️',
  respawn:              '✨ 重生！',
  killed:               '💀 陣亡！',
  killed_respawning:    '💀 陣亡！重生中…',
  level_up:             '⬆ 等級提升！Lv.{level}',
  boss_killed:          '👑 遺跡守護者倒下了！',
  crystal_bonus:        '💎 晶體 ×3',
  barracks_upgrade:     '⚔️ 兵營升至 Lv {level}',
  core_upgrade:         '🏰 基地核心升至 Lv {level}',
  island_unlocked:      '🏝️ 島嶼解鎖！',
  goddess_arrived:      '🙏 女神降臨！',
  goddess_spawned:      '✨ 召喚了 {count} 個資源！',
  dungeon_boss_down:    '👑 遺跡守護者倒下了！',

  // ── 互動提示 ───────────────────────────────────────────────
  prompt: {
    use_furnace:    '使用熔爐',
    open_market:    '打開市場',
    workstation:    '工作站',
    view_base_core: '查看基地核心',
    view_barracks:  '查看兵營',
    pray:           '祈禱',
    repair_trap:    '修復陷阱',
    open_chest:     '開啟寶箱',
    leave_dungeon:  '離開遺跡',
    open_dungeon_chest: '開啟遺跡寶箱',
  },

  // ── 地圖覆蓋層 ─────────────────────────────────────────────
  map_title:          '世界地圖',
  map_legend_self:    '🟢 自己',
  map_legend_ally:    '🔵 隊友',
  map_legend_wild:    '🟠 野怪',
  map_legend_siege:   '🔴 守城怪',
  map_legend_build:   '🟡 建築',
  map_legend_close:   '按 M 或 Esc 關閉地圖',
  island_unlock_label: '解鎖 {cost} 🪙（U）',
  island_locked_label: '🔒 {cost} 🪙',

  // ── 重連覆蓋層 ─────────────────────────────────────────────
  reconnect_title:    '🔌 信令伺服器斷線',
  reconnect_sub:      '重連中，請稍候…',

  // ── 拆除面板 ───────────────────────────────────────────────
  demolish_title:     '🔨 拆除建築',
  demolish_ok:        '確認拆除',
  demolish_cancel:    '取消',
  demolish_no_cost:   '（無需材料，無返還）',

  // ── 難度選擇 ───────────────────────────────────────────────
  difficulty_title:   '🎮 選擇難度',
  difficulty_desc:    '影響怪物強度與守城怪出現條件',
  difficulty_easy:    '😊 簡單',
  difficulty_easy_sub: '前兩環夜晚無守城怪',
  difficulty_normal:  '⚔️ 普通',
  difficulty_normal_sub: '前 5 夜無守城怪',
  difficulty_hard:    '💀 困難',
  difficulty_hard_sub: '前 2 夜無守城怪',
}
export default game
```

### hud.ts
```typescript
const hud = {
  save_btn:          '儲存',
  room_prefix:       '🔑 房號：',
  copied:            '✅ 已複製！',
  copy_prompt:       '複製房號：',
  player_count:      '{current}/{max} 人',
  hunger_title:      '飢餓度',
  dock_title:        '操作說明',
  action_inventory:  '背包',
  action_crafting:   '製作',
  action_building:   '建築',
  key_move:          '移動',
  key_attack:        '攻擊',
  key_interact:      '互動：熔爐 / 市場 / 工作站 / 基地核心 / 兵營 / 女神像 / 遺跡進出 / 睡床',
  key_chest:         '開寶箱 / 修復陷阱 / 吃食物 / 手電筒開關（手持手電筒時）',
  key_unlock:        '解鎖鄰近島嶼',
  key_armor:         '裝備 / 卸下防具',
  key_quest:         '任務面板',
  key_map:           '地圖',
  key_demolish:      '拆除建築',
  key_cancel:        '關閉面板 / 取消放置',
  key_help:          '操作說明（按住顯示）',
  mouse_left:        '攻擊 / 採集 / 放置建築',
  mouse_right:       '投擲手榴彈',
  mouse_wheel:       '切換快捷欄',
  mouse_left_label:  '滑鼠左鍵',
  mouse_right_label: '滑鼠右鍵',
  mouse_wheel_label: '滑鼠滾輪',
}
export default hud
```

### item.ts
```typescript
const item: Record<string, any> = {
  // ── 原料 ──────────────────────────────────────────────────────
  wood:             { name: '木材' },
  stone:            { name: '石頭' },
  iron:             { name: '鐵礦' },
  gold:             { name: '金礦' },
  crystal:          { name: '水晶' },
  bone:             { name: '骨頭' },
  // ── 加工品 ────────────────────────────────────────────────────
  plank:            { name: '木板' },
  ingot:            { name: '鐵錠' },
  gold_ingot:       { name: '金錠' },
  // ── 工具 ──────────────────────────────────────────────────────
  pickaxe:          { name: '石鎬' },
  iron_pick:        { name: '鐵鎬' },
  axe:              { name: '斧頭' },
  // ── 武器 ──────────────────────────────────────────────────────
  stone_sword:      { name: '石劍' },
  iron_sword:       { name: '鐵劍' },
  gold_sword:       { name: '金劍' },
  magic_sword:      { name: '魔法劍' },
  mithril_sword:    { name: '秘銀劍' },
  // ── 弓箭 ──────────────────────────────────────────────────────
  wood_bow:         { name: '木弓' },
  iron_bow:         { name: '鐵弓' },
  magic_bow:        { name: '魔法弓' },
  arrow:            { name: '箭矢' },
  fire_arrow:       { name: '火箭' },
  ice_arrow:        { name: '冰箭' },
  // ── 食物 ──────────────────────────────────────────────────────
  berry:            { name: '漿果' },
  tomato:           { name: '番茄' },
  purple_grape:     { name: '紫色葡萄' },
  onion:            { name: '洋蔥' },
  carrot:           { name: '蘿蔔' },
  pumpkin:          { name: '南瓜' },
  watermelon:       { name: '西瓜' },
  bread:            { name: '麵包' },
  meat:             { name: '肉類' },
  cooked_meat:      { name: '烤肉' },
  gourmet:          { name: '下午茶套餐' },
  // ── 防具 ──────────────────────────────────────────────────────
  leather_armor:    { name: '皮甲' },
  iron_armor:       { name: '鐵甲' },
  gold_armor:       { name: '黃金甲' },
  crystal_armor:    { name: '晶體甲' },
  shield:           { name: '盾牌' },
  // ── 陷阱 ──────────────────────────────────────────────────────
  spike_trap:       { name: '刺製陷阱' },
  fire_trap:        { name: '火焰陷阱' },
  ice_trap:         { name: '冰凍陷阱' },
  // ── 資源 ──────────────────────────────────────────────────────
  leather:          { name: '皮革' },
  feather:          { name: '羽毛' },
  spice:            { name: '香料' },
  seasoning:        { name: '調味料' },
  fire_essence:     { name: '火焰精華' },
  ice_essence:      { name: '冰凍精華' },
  ancient_crystal:  { name: '遠古結晶' },
  // ── 後期裝備 ────────────────────────────────────────────────
  laser_orb:        { name: '魔法球' },
  // ── 設計圖 ──────────────────────────────────────────────────
  blueprint:        { name: '設計圖' },
  blueprint_1:      { name: '設計圖I（雷射槍）' },
  blueprint_2:      { name: '設計圖II（雷射塔）' },
  blueprint_3:      { name: '設計圖III（加農砲）' },
  blueprint_4:      { name: '設計圖IV（手榴彈）' },
  blueprint_5:      { name: '設計圖V（旋風槌）' },
  dungeon_map:      { name: '遺跡地圖' },
  // ── 進階武器 ────────────────────────────────────────────────
  laser_gun:        { name: '雷射槍' },
  whirlwind_hammer: { name: '旋風槌' },
  // ── 消耗品武器 ──────────────────────────────────────────────
  grenade:          { name: '手榴彈' },
  // ── 背包 ────────────────────────────────────────────────────
  bag_small:        { name: '小背包' },
  bag_large:        { name: '大背包' },
  // ── 道具 ────────────────────────────────────────────────────
  flashlight:       { name: '手電筒' },
  bed:              { name: '床' },
  // ── 建築材料 ────────────────────────────────────────────────
  furnace:          { name: '熔爐' },
  // ── 進階防禦塔 ──────────────────────────────────────────────
  laser_tower:      { name: '雷射塔' },
  cannon_tower:     { name: '加農砲' },
  // ── 品級標籤 ────────────────────────────────────────────────
  rarity: {
    common:    '普通',
    uncommon:  '優良',
    rare:      '稀有',
    epic:      '史詩',
    legendary: '傳說',
  },
}
export default item
```

### lobby.ts
```typescript
const lobby = {
  title:              '🌿 Forager MP',
  create_char:        '第一次遊玩，幫自己取個名字吧',
  char_name_ph:       '輸入你的名稱',
  create_btn:         '✨ 建立角色',
  enter_game:         '▶ 進入遊戲',
  edit_char_title:    '編輯角色',
  new_name_ph:        '新名稱',
  save_btn:           '💾 儲存',
  back_btn:           '← 返回',
  host_btn:           '🏠 建立 / 選擇地圖',
  join_btn:           '🚪 輸入代碼加入',
  map_title:          '選擇地圖',
  new_map_btn:        '🆕 全新地圖',
  join_title:         '加入房間',
  room_code_ph:       '輸入房號',
  join_confirm:       '加入',
  loading_maps:       '讀取中…',
  load_fail:          '讀取失敗：{err}',
  unknown_date:       '未知日期',
  rename_ph:          '輸入新名稱',
  rename_confirm_tip: '確認重新命名',
  rename_cancel_tip:  '取消',
  rename_fail:        '❌ 重新命名失敗：{err}',
  rename_title:       '重新命名',
  delete_title:       '刪除存檔',
  delete_confirm:     '確定要刪除存檔「{name}」嗎？\n此操作無法復原。',
  delete_fail:        '❌ 刪除失敗：{err}',
  no_name:            '請輸入名稱',
  creating_room:      '建立房間中…',
  create_fail:        '❌ 建立失敗：{err}',
  room_code_bad:      '請輸入 6 位房號',
  connecting:         '連線中…',
  connect_fail:       '❌ 連線失敗：{err}',
  welcome_back:       '歡迎回來，{name}！',
  lang_label:         '語言',
}
export default lobby
```

### monster.ts
```typescript
const monster: Record<string, any> = {
  // ── 史萊姆系 ────────────────────────────────────────────────
  slime:               { name: '史萊姆' },
  slime_blue:          { name: '藍史萊姆' },
  giant_slime:         { name: '巨型史萊姆' },
  giant_flame:         { name: '巨型火焰怪' },
  giant_spirit:        { name: '巨型靈魂怪' },
  // ── 青蛙系 ─────────────────────────────────────────────────
  giant_frog:          { name: '巨型青蛙' },
  giant_frog_2:        { name: '巨型青蛙II' },
  // ── 浣熊系 ─────────────────────────────────────────────────
  giant_raccoon:       { name: '巨型浣熊' },
  giant_raccoon_gold:  { name: '黃金巨浣熊' },
  // ── 地精系 ─────────────────────────────────────────────────
  goblin:              { name: '地精' },
  goblin_rogue:        { name: '地精刺客' },
  goblin_shaman:       { name: '地精薩滿' },
  goblin_warrior:      { name: '地精戰士' },
  // ── 骷髏系 ─────────────────────────────────────────────────
  skeleton:            { name: '骷髏' },
  skeleton_mage:       { name: '骷髏法師' },
  skeleton_rogue:      { name: '骷髏刺客' },
  skeleton_warrior:    { name: '骷髏戰士' },
  // ── 天狗系 ─────────────────────────────────────────────────
  tengu_blue:          { name: '藍天狗' },
  tengu_red:           { name: '紅天狗' },
  // ── 武士系（Boss） ──────────────────────────────────────────
  giant_blue_samurai:  { name: '巨型藍武士' },
  giant_red_samurai:   { name: '巨型紅武士' },
}
export default monster
```

### network.ts
```typescript
const network: Record<string, any> = {
  kicked: '被踢出：{reason}',
  timeout_host: '連線逾時（10秒），請確認網路或改用其他網路',
  timeout_client: '連線逾時（10秒）',
  timeout_channel: 'WebRTC 資料通道逾時（15秒），請確認 Host 已開房間',
}
export default network
```

### quest.ts
```typescript
const quest = {
  // ── 面板固定文字 ──────────────────────────────────────────────
  panel: {
    title:    '📋 任務進度',
    close:    '✕',
    fraction: '{done} / {total}',
  },

  // ── 分類名稱 ─────────────────────────────────────────────────
  category: {
    gather:  '採集',
    combat:  '戰鬥',
    build:   '建設',
    explore: '探索',
  },

  // ── Toast 通知 ───────────────────────────────────────────────
  toast: {
    complete: '任務完成！',
  },

  // ── 里程碑：採集 ─────────────────────────────────────────────
  wood10:   { title: '砍柴入門',   desc: '收集 10 木材' },
  stone10:  { title: '礦工初體驗', desc: '收集 10 石頭' },
  iron5:    { title: '鐵器曙光',   desc: '收集 5 鐵礦' },
  gold3:    { title: '黃金獵人',   desc: '收集 3 金礦' },
  crystal1: { title: '水晶使者',   desc: '收集 1 水晶' },

  // ── 里程碑：戰鬥 ─────────────────────────────────────────────
  kill1:    { title: '初戰告捷', desc: '擊殺第 1 個怪物' },
  kill10:   { title: '戰士',     desc: '累計擊殺 10 個' },
  kill50:   { title: '怪物獵人', desc: '累計擊殺 50 個' },
  coin20:   { title: '小有積蓄', desc: '累積 20 金幣' },
  coin100:  { title: '富甲一方', desc: '累積 100 金幣' },
  survive3: { title: '熬夜老手', desc: '熬過 3 個夜晚' },

  // ── 里程碑：建設 ─────────────────────────────────────────────
  build1:     { title: '奠基者',     desc: '放置第一棟建築' },
  build5:     { title: '村莊建設者', desc: '放置 5 棟建築' },
  sword1:     { title: '鑄劍師',     desc: '製作第一把石劍' },
  iron_sw:    { title: '鐵匠師傅',   desc: '製作鐵劍' },
  blueprint1: { title: '藍圖蒐集者', desc: '獲得 1 張設計圖' },
  barracks1:  { title: '兵團長',     desc: '建造兵營' },

  // ── 里程碑：探索 ─────────────────────────────────────────────
  night1:   { title: '第一個夜晚', desc: '第一次撐過夜晚' },
}
export default quest
```
> 注意：原檔每個里程碑是多行 `{ title: ..., desc: ... }` 物件，此處為節省篇幅壓成單行，內容完全一致；展開回多行也可。

### recipe.ts
```typescript
const recipe: Record<string, any> = {
  // ── Research Lv 1 ────────────────────────────────────────────
  plank:            { name: '木板' },
  axe:              { name: '斧頭' },
  pickaxe:          { name: '石鎬' },
  stone_sword:      { name: '石劍' },
  // ── Research Lv 2 ────────────────────────────────────────────
  bread:            { name: '麵包' },
  flashlight:       { name: '手電筒' },
  bed:              { name: '床' },
  // ── Research Lv 3 ────────────────────────────────────────────
  iron_pick:        { name: '鐵鎬' },
  cooked_meat:      { name: '烤肉' },
  // ── Research Lv 4 ────────────────────────────────────────────
  wood_bow:         { name: '木弓' },
  arrow:            { name: '箭矢' },
  ingot:            { name: '鐵錠' },
  iron_sword:       { name: '鐵劍' },
  gold_sword:       { name: '金劍' },
  // ── Research Lv 5 ────────────────────────────────────────────
  bag_small:        { name: '小背包' },
  leather_armor:    { name: '皮甲' },
  iron_armor:       { name: '鐵甲' },
  gold_armor:       { name: '黃金甲' },
  iron_bow:         { name: '鐵弓' },
  fire_arrow:       { name: '火箭' },
  ice_arrow:        { name: '冰箭' },
  shield:           { name: '盾牌' },
  // ── Research Lv 6 ────────────────────────────────────────────
  spike_trap:       { name: '刺製陷阱' },
  fire_trap:        { name: '火焰陷阱' },
  grenade:          { name: '手榴彈' },
  laser_gun:        { name: '雷射槍' },
  gourmet_1:        { name: '下午茶套餐 I' },
  // ── Research Lv 7 ────────────────────────────────────────────
  ice_trap:         { name: '冰凍陷阱' },
  laser_tower:      { name: '雷射塔' },
  cannon_tower:     { name: '加農砲' },
  magic_sword:      { name: '魔法劍' },
  // ── Research Lv 8 ────────────────────────────────────────────
  bag_large:        { name: '大背包' },
  magic_bow:        { name: '魔法弓' },
  crystal_armor:    { name: '晶體甲' },
  whirlwind_hammer: { name: '旋風槌' },
  gourmet_2:        { name: '下午茶套餐 II' },
  // ── Research Lv 9 ────────────────────────────────────────────
  mithril_sword:    { name: '秘銀劍' },
  // ── Research Lv 10 ───────────────────────────────────────────
  laser_orb:        { name: '魔法球' },
}
export default recipe
```

### render.ts
```typescript
const render = {
  daynight: {
    day: '第 {count} 天',
  },
}
export default render
```

### research.ts
```typescript
const research: Record<string, any> = {
  // 升級解鎖說明，key 為「lv<目標等級>」
  lv2:  { unlocks: '市場 + 食物配方' },
  lv3:  { unlocks: '工具升級配方' },
  lv4:  { unlocks: '武器配方 + 弓箭' },
  lv5:  { unlocks: '防具配方' },
  lv6:  { unlocks: '防禦陷阱配方' },
  lv7:  { unlocks: '守城兵器升級' },
  lv8:  { unlocks: '進階魔法配方' },
  lv9:  { unlocks: '終極裝備配方' },
  lv10: { unlocks: '傳說級配方' },
}
export default research
```

### resource.ts
```typescript
const resource = {
  tree:         { name: '樹木' },
  rock:         { name: '石頭' },
  iron:         { name: '鐵礦' },
  gold:         { name: '金礦' },
  crystal:      { name: '水晶' },
  berry:        { name: '莓果叢' },
  tomato:       { name: '番茄' },
  purple_grape: { name: '紫葡萄' },
  onion:        { name: '洋蔥' },
  carrot:       { name: '紅蘿蔔' },
  pumpkin:      { name: '南瓜' },
  watermelon:   { name: '西瓜' },
  fire_node:    { name: '火焰岩漿石' },
  ice_node:     { name: '冰晶' },
}
export default resource
```

### save.ts
```typescript
const save = {
  complete: '已存檔',
  failed: '存檔失敗：{err}',
  loading: '載入中…',
  deleting: '刪除中…',
  exported: '玩家資料已匯出',
  imported: '玩家資料已匯入',
  invalidPlayerData: '無效的玩家資料',
  worldSaved: '世界已儲存',
  worldDeleted: '世界已刪除',
  worldRenamed: '存檔已重命名',
  notFound: '找不到存檔：{name}',
}
export default save
```

### toast.ts
```typescript
const toast: Record<string, any> = {
  gold_insufficient:        '💰 金幣不足！',
  material_insufficient:    '❌ 材料不足',
  gold_and_material_insuf:  '❌ 金幣不足',
  upgrade_max_or_no_mat:    '❌ 材料不足或已達最高等級',
  research_upgrading:       '🔬 研究升級中... ({duration}s)',
  saved:                    '💾 已存檔',
  save_failed:              '❌ 存檔失敗：{error}',
}
export default toast
```

### treasure.ts
```typescript
const treasure: Record<string, any> = {
  // ── 寶箱互動 ───────────────────────────────────────────────────
  hint:           '按 [R] 開啟寶箱',
  opening:        '正在開啟寶箱…',
  opened:         '寶箱已開啟！',
  empty:          '寶箱是空的',
  too_far:        '太遠了，請靠近後再開啟',
  already_opened: '這個寶箱已經被打開了',

  // ── 獎勵通知 ───────────────────────────────────────────────────
  reward:         '獲得 {item} ×{n}',
  reward_multi:   '獲得 {count} 種物品！',
  no_reward:      '這次什麼都沒得到…',

  // ── 稀有度 ─────────────────────────────────────────────────────
  rarity: {
    common: '普通',
    rare:   '稀有',
    epic:   '史詩',
  },

  // ── 寶箱標籤 ──────────────────────────────────────────────────
  chest: {
    common: '普通寶箱',
    rare:   '稀有寶箱',
    epic:   '史詩寶箱',
  },
}
export default treasure
```

### ui.ts
```typescript
const ui = {
  common: {
    close:     '✕',
    back:      '← 返回',
    free:      '免費',
    unknown:   '未知',
    level:     '等級',
    upgrade:   '⬆ 升級',
    max_level: '🎉 已達最高等級（Lv {lv}）',
  },
  bag: {
    title:           '🎒 背包',
    capacity:        '容量：{used} / {max}',
    capacity_inf:    '容量：{used} / ∞',
    put_in_label:    '📥 放入（點選物品 → 選擇數量）',
    contents_label:  '🎒 背包內容',
    empty:           '背包是空的',
    put_in_btn:      '放入',
    take_one_btn:    '取1',
    take_all_btn:    '全取',
    prompt_put:      '放入幾個 {name}？',
  },
  market: {
    title:             '🏪 市場',
    daily_label:       '🌟 今日特賣',
    current_price:     '當前售價：',
    gold_unit:         '金幣',
    gold_per_unit:     '{price} 金幣/個',
    owned:             '持有數量：',
    earn:              '可得金幣：',
    sell_btn:          '💰 售賣',
    buy_btn:           '購買',
    no_gold:           '金幣不足',
    no_items:          '沒有可售物品',
    blueprint_default: '設計圖',
  },
  furnace: {
    title:         '🔥 熔爐',
    iron_recipe:   '鐵礦 → 鐵錠',
    gold_recipe:   '金礦 → 金錠 (3:1)',
    coin_recipe:   '金礦 → 金幣 (1:1)',
    ore_name_iron:   '鐵礦',
    ingot_name_iron: '鐵錠',
    ore_name_gold:   '金礦',
    ingot_name_gold: '金錠',
    coin_name:       '金幣',
    ratio:         '比例：',
    ore_held:      '持有礦石：',
    can_produce:   '可產錠：',
    smelt_btn:     '🔥 冶煉 {name} ×{qty}',
  },
  research: {
    title:          '🛠️ 工作站',
    no_items:       '沒有升級項目',
    row_sub:        '研究路線 {n}',
    done_mark:      '已完成',
    detail_done:    '✅ 已研究完成',
    meta_route:     '🔬 研究路線 {n}',
    meta_time:      '🕐 研究時間：{secs} 秒',
    meta_gold:      '🪙 金幣：{gold}',
    mats_label:     '材料需求',
    mat_free:       '無材料消耗',
    upgrade_btn:    '⚡ 開始研究（+1 等級）',
    progress_label: '🔄 升級中…',
    time_left:      '剩餘：{secs} 秒',
  },
  building: {
    title:       '🏗️ 建築',
    place_btn:   '放置',
    size:        '{w}×{h} 格',
  },
  barracks: {
    title:              '⚔️ 兵營',
    stats_title:        '⚔️ 當前士兵屬性',
    stat_max_soldiers:  '最多士兵',
    stat_hp:            'HP',
    stat_atk:           '攻擊力',
    stat_speed:         '移速',
    stat_spawn:         '生成間隔',
    stat_respawn:       '重生時間',
    level_row:          '等級：Lv {lv} / {max}',
    upgrade_title:      '⬆ 升級至 Lv {lv}',
    preview:            '最多士兵 +{diff} ｜ HP {hp_from} → {hp_to} ｜ ATK {atk_from} → {atk_to} ｜ 生成間隔 {int_from}s → {int_to}s',
    upgrade_btn:        '⬆ 升級',
    max:                '🎉 已達最高等級（Lv {lv}）',
    req_have:           '{name}：需要 {need}（擁有 {have}）',
  },
  base_core: {
    title:          '🏰 基地核心',
    level_row:      '等級：{lv} / 10',
    hp_bonus:       '❤️ HP 加成：+{pct}%',
    atk_bonus:      '⚔️ ATK 加成：+{pct}%',
    regen:          '💚 每秒回血：+{val}',
    upgrade_title:  '升級至 Lv {lv}',
    preview_hp:     '❤️ HP 加成 → +{pct}%',
    preview_atk:    '⚔️ ATK → +{pct}%',
    preview_regen:  '💚 回血 → +{val}/s',
    upgrade_btn:    '⬆ 升級',
    max:            '🎉 已達最高等級（Lv 10）',
    req_have:       '{name}：需要 {need}（擁有 {have}）',
  },
  equip: {
    title:      '🛡 裝備欄',
    no_armor:   '未裝備',
    unequip:    '卸下',
    def_pct:    '-{pct}% 傷害',
  },
  hotbar: {
    bag_hint: '右鍵開',
    unknown:  '未知',
  },
  crafting: {
    empty_hint:     '← 選擇配方',
    owned:          '持有：{qty}',
    weapon_title:   '⚔ 武器數值',
    stat_damage:    '攻擊力',
    stat_res:       '採集力',
    stat_range:     '射程',
    stat_range_val: '{val} 格',
    stat_cooldown:  '冷卻',
    stat_cd_val:    '{val} s',
    locked_msg:     '🔒 需在工作站研究「路線 {lv}」後解鎖',
    craft_btn:      '⚒ 製作 ×{qty}',
  },
}
export default ui
```

### weapon.ts
```typescript
const weapon: Record<string, any> = {
  fist:              { name: '徒手' },
  stone_sword:       { name: '石劍' },
  pickaxe:           { name: '石鎬' },
  axe:               { name: '斧頭' },
  iron_sword:        { name: '鐵劍' },
  iron_pick:         { name: '鐵鎬' },
  gold_sword:        { name: '金劍' },
  magic_sword:       { name: '魔法劍' },
  mithril_sword:     { name: '秘銀劍' },
  laser_orb:         { name: '魔法泡泡' },
  laser_gun:         { name: '雷射槍' },
  whirlwind_hammer:  { name: '旋風槌' },
}
export default weapon
```
> 注意：`laser_orb` 在 weapon 為「魔法泡泡」，而 item / recipe 為「魔法球」——刻意不同，重建時勿統一。

### world.ts
```typescript
// 由模組擁有者填內容，例如 { wood: { name: '木材' } }
const world: Record<string, any> = {}
export default world
```

## 重建提示
- **檔案骨架**：每檔 `const <name>... = {...}`，結尾 `export default <name>`。`armor/common/item/monster/network/recipe/research/toast/treasure/world` 標 `Record<string, any>`；`building/dungeon/game(亦標 Record)/hud/lobby/quest/render/resource/save/ui/weapon` 視原檔（game/item/monster/network/recipe/research/toast/treasure/weapon/common/world/armor 都是 `Record<string, any>`，其餘 `building/dungeon/hud/lobby/quest/render/resource/save/ui` 不標型別）。型別標註不影響執行，但盡量照原檔。
- **中英 key 必須完全對齊**：zh-TW 與 en 兩份的 key 結構一字不差，只有 value 不同。新增字串時務必兩語系同步。對照 en 請看 locales-en skill。
- **插值參數格式**：用大括號 `{name}`、`{cost}`、`{count}`、`{level}`、`{lv}`、`{secs}`、`{qty}`、`{used}`/`{max}`、`{pct}`、`{val}`、`{err}`/`{error}`、`{done}`/`{total}`、`{item}`/`{n}`、`{w}`/`{h}`、`{remaining}`、`{duration}`、`{price}`、`{need}`/`{have}`、`{hp_from}`/`{hp_to}` 等。zh/en 同一 key 的參數名必須一致。
- **巢狀 namespace**：`building.upgrade`、`dungeon.*`（portal/boss/chest/enemy/floor）、`game.prompt`、`item.rarity`、`quest.panel/category/toast` + 各里程碑、`treasure.rarity/chest`、`ui.*`（11 個子面板）、`render.daynight`、`research.lvN`。t() 以點號路徑取用，例如 `t('ui.bag.title')`、`t('quest.wood10.desc')`。
- **空檔佔位**：`common` 與 `world` 兩語系都是空物件 `{}`，但仍要存在並被 index 匯入（否則 barrel 會缺 key）。勿刪。
- **跨檔同名但措辭可不同**：物品名集中於 `item`，但 `armor`/`weapon`/`recipe`/`resource` 各有自己的同 key 名稱（如 resource.berry「莓果叢」vs item.berry「漿果」、resource.carrot「紅蘿蔔」vs item.carrot「蘿蔔」），重建時逐檔照抄，不要互相覆寫。
- **特殊字元**：`\n`（lobby.delete_confirm 換行）、emoji、全形冒號「：」與引號「」、`∞`、`×`、箭頭 `→`/`←`/`⬆`/`⬇️` 等都要忠實保留。
- 易漏：22 個 namespace 一個都不能少，尤其兩個空檔（common/world）與容易忘的 render/network。
