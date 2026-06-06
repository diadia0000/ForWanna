---
name: locales-en
description: en（English）語系的完整翻譯字串資料，逐檔涵蓋全部 22 個 namespace 的實際 key/value。重建 i18n 英文字串、新增或對照翻譯、確保中英 key 對齊時，直接照這份還原 src/locales/en/ 整個目錄。
---

# locales/en/

> 模組：locales｜角色：英文語系的翻譯字串，依 namespace 分檔。本份只負責「字串內容本身」；i18n 載入機制與 t() 實作請看 core/i18n/* 的 skill。en 與 zh-TW 的 key 結構完全相同，只有 value 不同（對照中文版見 locales-zh-tw skill）。

## Namespace 清單（共 22 檔）
與 zh-TW 一一對應，key 結構必須完全一致：
- `armor` — 防具名稱（僅 `{ name }`）
- `building` — 建築名稱 + effect 說明 + upgrade 子物件
- `common` — 共用字串（**空物件 `{}`**，佔位）
- `dungeon` — 遺跡（portal/boss/chest/enemy/floor）
- `game` — 浮動文字、互動提示、地圖/重連/拆除/難度面板（最大檔之一）
- `hud` — 抬頭顯示與操作說明 dock
- `index` — barrel（見 locales-index skill）
- `item` — 所有物品名稱 + rarity
- `lobby` — 大廳/角色/房間/存檔管理
- `monster` — 怪物名稱
- `network` — 連線錯誤訊息
- `quest` — 任務面板/分類/toast + 18 個里程碑
- `recipe` — 配方顯示名稱（依 Research Lv 分組）
- `render` — 渲染層（日夜 DAY N）
- `research` — 研究等級解鎖說明（lv2~lv10）
- `resource` — 場上資源節點名稱
- `save` — 存檔/載入狀態訊息
- `toast` — 通用 toast
- `treasure` — 寶箱互動/獎勵/稀有度/標籤
- `ui` — 各面板 UI 文字（11 個子面板，最大檔）
- `weapon` — 武器名稱（含 fist）
- `world` — 世界字串（**空物件 `{}`**，佔位）

## 各 namespace 字串內容

### armor.ts
```typescript
const armor: Record<string, any> = {
  leather_armor: { name: 'Leather Armor' },
  iron_armor:    { name: 'Iron Armor' },
  gold_armor:    { name: 'Gold Armor' },
  crystal_armor: { name: 'Crystal Armor' },
  shield:        { name: 'Shield' },
}
export default armor
```

### building.ts
```typescript
const building = {
  furnace:        { name: 'Furnace',        effect: 'Automatically smelts ores' },
  farm:           { name: 'Farm',           effect: 'Automatically produces food' },
  market:         { name: 'Market',         effect: 'Sell items for coins' },
  research_lab:   { name: 'Workbench',      effect: 'Press E nearby to open the workbench and unlock more recipes via research' },
  wooden_bridge:  { name: 'Wooden Bridge',  effect: 'Allows crossing water (10 s build time)' },
  wall:           { name: 'Stone Wall',     effect: 'Blocks monsters and fortifies your base' },
  tower:          { name: 'Watchtower',     effect: 'Auto-attacks monsters within 4 tiles' },
  spike_trap:     { name: 'Spike Trap',     effect: 'Deals damage + 50% slow on step (transparent when broken)' },
  fire_trap:      { name: 'Fire Trap',      effect: 'Deals damage + 3 s burn on step (transparent when broken)' },
  ice_trap:       { name: 'Ice Trap',       effect: 'Deals damage + 1.5 s freeze on step (transparent when broken)' },
  base_core:      { name: 'Base Core',      effect: 'Grants HP/ATK bonus and regen to players within 8 tiles; monsters target this first' },
  barracks:       { name: 'Barracks',       effect: 'Spawns a soldier every 30 s to assist in combat' },
  laser_tower:    { name: 'Laser Tower',    effect: 'Auto-attacks monsters within 15 tiles (50+Lv×20 dmg, 2 s cooldown)' },
  cannon_tower:   { name: 'Cannon Tower',   effect: 'Fires cannonballs (20+Lv×8 dmg, 2-tile blast radius, 3.5 s cooldown)' },
  goddess_statue: { name: 'Goddess Statue', effect: 'Press E nearby to pray and summon abundant resources (3 min cooldown)' },
  upgrade: {
    level:   'Level',
    upgrade: 'Upgrade',
    repair:  'Repair',
    cost:    'Cost',
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
    exit: 'Exit',
    enter: 'Enter Ruin',
    leave: 'Leave Ruin',
  },
  boss: {
    label: 'Guardian',
    defeated: 'Guardian defeated!',
  },
  chest: {
    common: 'Common Chest',
    rare: 'Rare Chest',
    epic: 'Epic Chest',
    hint: 'Press F to open chest',
  },
  enemy: {
    label: 'Ruin Guard',
  },
  floor: {
    notice: 'You have entered the ruin — beware!',
  },
}
export default dungeon
```

### game.ts
```typescript
const game: Record<string, any> = {
  // ── floating text ─────────────────────────────────────────
  no_grenade:           'No grenades left',
  grenade_explode:      '💥 Boom!',
  no_food:              'No food left',
  cant_build_dungeon:   'Cannot build inside dungeon',
  bag_no_space:         '⚠ Not enough bag space!',
  cant_equip:           'This item cannot be equipped',
  defense_pct:          'DEF',
  default_player_name:  'Player',
  unequip_armor:        'Unequipped {name}',
  equip_armor:          'Equipped {name}!',
  daytime_now:          '🌞 It\'s daytime…',
  bed_launched:         '🛸 Did you want a peaceful night?',
  bed_crash:            '💥 Crashed!',
  bed_dead_respawn:     '💀 Defeated → Respawning',
  no_nearby_island:     'No nearby locked island',
  island_need_gold:     'Need {cost} 🪙',
  island_need_gold_unlock: 'Need {cost} 🪙 to unlock',
  goddess_cooldown:     'Goddess on cooldown ({remaining}s)',
  praying:              '🙏 Praying…',
  leave_dungeon:        '⬆️ Leave dungeon',
  enter_dungeon:        '⬇️ Entering dungeon…',
  smelt_need_ore:       '🔥 Need {ore}',
  market_not_enough:    '🏪 Not enough items',
  market_get_item:      '📜 Got {name}!',
  trap_repair_done:     '🔧 Trap repaired',
  trap_repair_no_mat:   '🔧 Not enough materials',
  flashlight_on:        '🔦 On',
  flashlight_off:       '🔦 Off',
  soldier_dead:         'Soldier defeated',
  building_damaged:     '💥 Building destroyed!',
  demolish_done:        '🔨 Demolished (75% refund)',
  bag_put_in:           'Put {name} ×{amount} in bag',
  bag_item_into:        'Put {name} ×{amount} in bag',
  attack_fist:          '👊',
  attack_weapon:        '⚔️',
  respawn:              '✨ Respawned!',
  killed:               '💀 Defeated!',
  killed_respawning:    '💀 Defeated! Respawning…',
  level_up:             '⬆ Level Up! Lv.{level}',
  boss_killed:          '👑 Dungeon Guardian defeated!',
  crystal_bonus:        '💎 Crystal ×3',
  barracks_upgrade:     '⚔️ Barracks upgraded to Lv {level}',
  core_upgrade:         '🏰 Base Core upgraded to Lv {level}',
  island_unlocked:      '🏝️ Island unlocked!',
  goddess_arrived:      '🙏 Goddess has arrived!',
  goddess_spawned:      '✨ Summoned {count} resources!',
  dungeon_boss_down:    '👑 Dungeon Guardian defeated!',

  // ── interaction prompts ─────────────────────────────────────
  prompt: {
    use_furnace:    'Use Furnace',
    open_market:    'Open Market',
    workstation:    'Workstation',
    view_base_core: 'View Base Core',
    view_barracks:  'View Barracks',
    pray:           'Pray',
    repair_trap:    'Repair Trap',
    open_chest:     'Open Chest',
    leave_dungeon:  'Leave Dungeon',
    open_dungeon_chest: 'Open Dungeon Chest',
  },

  // ── map overlay ───────────────────────────────────────────
  map_title:          'World Map',
  map_legend_self:    '🟢 You',
  map_legend_ally:    '🔵 Ally',
  map_legend_wild:    '🟠 Wild Monster',
  map_legend_siege:   '🔴 Siege Monster',
  map_legend_build:   '🟡 Building',
  map_legend_close:   'Press M or Esc to close map',
  island_unlock_label: 'Unlock {cost} 🪙 (U)',
  island_locked_label: '🔒 {cost} 🪙',

  // ── reconnect overlay ─────────────────────────────────────
  reconnect_title:    '🔌 Signaling server disconnected',
  reconnect_sub:      'Reconnecting, please wait…',

  // ── demolish panel ────────────────────────────────────────
  demolish_title:     '🔨 Demolish Building',
  demolish_ok:        'Confirm',
  demolish_cancel:    'Cancel',
  demolish_no_cost:   '(No materials required, no refund)',

  // ── difficulty selection ──────────────────────────────────
  difficulty_title:   '🎮 Select Difficulty',
  difficulty_desc:    'Affects monster strength and siege conditions',
  difficulty_easy:    '😊 Easy',
  difficulty_easy_sub: 'No siege monsters in first 2 rings at night',
  difficulty_normal:  '⚔️ Normal',
  difficulty_normal_sub: 'No siege monsters for first 5 nights',
  difficulty_hard:    '💀 Hard',
  difficulty_hard_sub: 'No siege monsters for first 2 nights',
}
export default game
```

### hud.ts
```typescript
const hud = {
  save_btn:          'Save',
  room_prefix:       '🔑 Room: ',
  copied:            '✅ Copied!',
  copy_prompt:       'Copy room code: ',
  player_count:      '{current}/{max} players',
  hunger_title:      'Hunger',
  dock_title:        'Controls',
  action_inventory:  'Inventory',
  action_crafting:   'Crafting',
  action_building:   'Building',
  key_move:          'Move',
  key_attack:        'Attack',
  key_interact:      'Interact: Furnace / Market / Workstation / Base Core / Barracks / Goddess Statue / Enter/Exit Ruin / Bed',
  key_chest:         'Open Chest / Repair Trap / Eat Food / Toggle Flashlight (when held)',
  key_unlock:        'Unlock nearby island',
  key_armor:         'Equip / Unequip armor',
  key_quest:         'Quest panel',
  key_map:           'Map',
  key_demolish:      'Demolish building',
  key_cancel:        'Close panel / Cancel placement',
  key_help:          'Show controls (hold)',
  mouse_left:        'Attack / Harvest / Place building',
  mouse_right:       'Throw grenade',
  mouse_wheel:       'Switch hotbar slot',
  mouse_left_label:  'Left Click',
  mouse_right_label: 'Right Click',
  mouse_wheel_label: 'Scroll Wheel',
}
export default hud
```

### item.ts
```typescript
const item: Record<string, any> = {
  // ── Raw Materials ────────────────────────────────────────────
  wood:             { name: 'Wood' },
  stone:            { name: 'Stone' },
  iron:             { name: 'Iron Ore' },
  gold:             { name: 'Gold Ore' },
  crystal:          { name: 'Crystal' },
  bone:             { name: 'Bone' },
  // ── Processed Materials ──────────────────────────────────────
  plank:            { name: 'Plank' },
  ingot:            { name: 'Iron Ingot' },
  gold_ingot:       { name: 'Gold Ingot' },
  // ── Tools ────────────────────────────────────────────────────
  pickaxe:          { name: 'Stone Pickaxe' },
  iron_pick:        { name: 'Iron Pickaxe' },
  axe:              { name: 'Axe' },
  // ── Swords ───────────────────────────────────────────────────
  stone_sword:      { name: 'Stone Sword' },
  iron_sword:       { name: 'Iron Sword' },
  gold_sword:       { name: 'Gold Sword' },
  magic_sword:      { name: 'Magic Sword' },
  mithril_sword:    { name: 'Mithril Sword' },
  // ── Bows & Arrows ────────────────────────────────────────────
  wood_bow:         { name: 'Wood Bow' },
  iron_bow:         { name: 'Iron Bow' },
  magic_bow:        { name: 'Magic Bow' },
  arrow:            { name: 'Arrow' },
  fire_arrow:       { name: 'Fire Arrow' },
  ice_arrow:        { name: 'Ice Arrow' },
  // ── Food ─────────────────────────────────────────────────────
  berry:            { name: 'Berry' },
  tomato:           { name: 'Tomato' },
  purple_grape:     { name: 'Purple Grape' },
  onion:            { name: 'Onion' },
  carrot:           { name: 'Carrot' },
  pumpkin:          { name: 'Pumpkin' },
  watermelon:       { name: 'Watermelon' },
  bread:            { name: 'Bread' },
  meat:             { name: 'Meat' },
  cooked_meat:      { name: 'Cooked Meat' },
  gourmet:          { name: 'Afternoon Tea Set' },
  // ── Armor ────────────────────────────────────────────────────
  leather_armor:    { name: 'Leather Armor' },
  iron_armor:       { name: 'Iron Armor' },
  gold_armor:       { name: 'Gold Armor' },
  crystal_armor:    { name: 'Crystal Armor' },
  shield:           { name: 'Shield' },
  // ── Traps ────────────────────────────────────────────────────
  spike_trap:       { name: 'Spike Trap' },
  fire_trap:        { name: 'Fire Trap' },
  ice_trap:         { name: 'Ice Trap' },
  // ── Resources ────────────────────────────────────────────────
  leather:          { name: 'Leather' },
  feather:          { name: 'Feather' },
  spice:            { name: 'Spice' },
  seasoning:        { name: 'Seasoning' },
  fire_essence:     { name: 'Fire Essence' },
  ice_essence:      { name: 'Ice Essence' },
  ancient_crystal:  { name: 'Ancient Crystal' },
  // ── Late-game Equipment ──────────────────────────────────────
  laser_orb:        { name: 'Magic Orb' },
  // ── Blueprints ───────────────────────────────────────────────
  blueprint:        { name: 'Blueprint' },
  blueprint_1:      { name: 'Blueprint I (Laser Gun)' },
  blueprint_2:      { name: 'Blueprint II (Laser Tower)' },
  blueprint_3:      { name: 'Blueprint III (Cannon Tower)' },
  blueprint_4:      { name: 'Blueprint IV (Grenade)' },
  blueprint_5:      { name: 'Blueprint V (Whirlwind Hammer)' },
  dungeon_map:      { name: 'Dungeon Map' },
  // ── Advanced Weapons ─────────────────────────────────────────
  laser_gun:        { name: 'Laser Gun' },
  whirlwind_hammer: { name: 'Whirlwind Hammer' },
  // ── Consumable Weapons ───────────────────────────────────────
  grenade:          { name: 'Grenade' },
  // ── Bags ─────────────────────────────────────────────────────
  bag_small:        { name: 'Small Bag' },
  bag_large:        { name: 'Large Bag' },
  // ── Utility ──────────────────────────────────────────────────
  flashlight:       { name: 'Flashlight' },
  bed:              { name: 'Bed' },
  // ── Building Materials ───────────────────────────────────────
  furnace:          { name: 'Furnace' },
  // ── Advanced Towers ──────────────────────────────────────────
  laser_tower:      { name: 'Laser Tower' },
  cannon_tower:     { name: 'Cannon Tower' },
  // ── Rarity Labels ────────────────────────────────────────────
  rarity: {
    common:    'Common',
    uncommon:  'Uncommon',
    rare:      'Rare',
    epic:      'Epic',
    legendary: 'Legendary',
  },
}
export default item
```

### lobby.ts
```typescript
const lobby = {
  title:              '🌿 Forager MP',
  create_char:        'First time? Pick a name for yourself',
  char_name_ph:       'Enter your name',
  create_btn:         '✨ Create Character',
  enter_game:         '▶ Enter Game',
  edit_char_title:    'Edit Character',
  new_name_ph:        'New name',
  save_btn:           '💾 Save',
  back_btn:           '← Back',
  host_btn:           '🏠 Create / Select Map',
  join_btn:           '🚪 Join with Code',
  map_title:          'Select Map',
  new_map_btn:        '🆕 New Map',
  join_title:         'Join Room',
  room_code_ph:       'Enter room code',
  join_confirm:       'Join',
  loading_maps:       'Loading…',
  load_fail:          'Load failed: {err}',
  unknown_date:       'Unknown date',
  rename_ph:          'Enter new name',
  rename_confirm_tip: 'Confirm rename',
  rename_cancel_tip:  'Cancel',
  rename_fail:        '❌ Rename failed: {err}',
  rename_title:       'Rename',
  delete_title:       'Delete Save',
  delete_confirm:     'Delete save "{name}"?\nThis cannot be undone.',
  delete_fail:        '❌ Delete failed: {err}',
  no_name:            'Please enter a name',
  creating_room:      'Creating room…',
  create_fail:        '❌ Create failed: {err}',
  room_code_bad:      'Please enter a 6-character room code',
  connecting:         'Connecting…',
  connect_fail:       '❌ Connection failed: {err}',
  welcome_back:       'Welcome back, {name}!',
  lang_label:         'Language',
}
export default lobby
```

### monster.ts
```typescript
const monster: Record<string, any> = {
  // ── Slime family ────────────────────────────────────────────
  slime:               { name: 'Slime' },
  slime_blue:          { name: 'Blue Slime' },
  giant_slime:         { name: 'Giant Slime' },
  giant_flame:         { name: 'Giant Flame' },
  giant_spirit:        { name: 'Giant Spirit' },
  // ── Frog family ─────────────────────────────────────────────
  giant_frog:          { name: 'Giant Frog' },
  giant_frog_2:        { name: 'Giant Frog II' },
  // ── Raccoon family ──────────────────────────────────────────
  giant_raccoon:       { name: 'Giant Raccoon' },
  giant_raccoon_gold:  { name: 'Golden Giant Raccoon' },
  // ── Goblin family ───────────────────────────────────────────
  goblin:              { name: 'Goblin' },
  goblin_rogue:        { name: 'Goblin Rogue' },
  goblin_shaman:       { name: 'Goblin Shaman' },
  goblin_warrior:      { name: 'Goblin Warrior' },
  // ── Skeleton family ─────────────────────────────────────────
  skeleton:            { name: 'Skeleton' },
  skeleton_mage:       { name: 'Skeleton Mage' },
  skeleton_rogue:      { name: 'Skeleton Rogue' },
  skeleton_warrior:    { name: 'Skeleton Warrior' },
  // ── Tengu family ────────────────────────────────────────────
  tengu_blue:          { name: 'Blue Tengu' },
  tengu_red:           { name: 'Red Tengu' },
  // ── Samurai family (Boss) ────────────────────────────────────
  giant_blue_samurai:  { name: 'Giant Blue Samurai' },
  giant_red_samurai:   { name: 'Giant Red Samurai' },
}
export default monster
```

### network.ts
```typescript
const network: Record<string, any> = {
  kicked: 'Kicked: {reason}',
  timeout_host: 'Connection timed out (10s). Check your network or try a different one.',
  timeout_client: 'Connection timed out (10s)',
  timeout_channel: 'WebRTC data channel timed out (15s). Make sure the Host has created a room.',
}
export default network
```

### quest.ts
```typescript
const quest = {
  // ── Panel fixed text ──────────────────────────────────────────
  panel: {
    title:    '📋 Quest Progress',
    close:    '✕',
    fraction: '{done} / {total}',
  },

  // ── Category names ────────────────────────────────────────────
  category: {
    gather:  'Gather',
    combat:  'Combat',
    build:   'Build',
    explore: 'Explore',
  },

  // ── Toast notification ────────────────────────────────────────
  toast: {
    complete: 'Quest Complete!',
  },

  // ── Milestones: Gather ────────────────────────────────────────
  wood10:   { title: 'Lumberjack Basics',     desc: 'Collect 10 Wood' },
  stone10:  { title: "Miner's First Steps",   desc: 'Collect 10 Stone' },
  iron5:    { title: 'Dawn of Iron',          desc: 'Collect 5 Iron Ore' },
  gold3:    { title: 'Gold Hunter',           desc: 'Collect 3 Gold Ore' },
  crystal1: { title: 'Crystal Bearer',        desc: 'Collect 1 Crystal' },

  // ── Milestones: Combat ────────────────────────────────────────
  kill1:    { title: 'First Blood',    desc: 'Kill the 1st monster' },
  kill10:   { title: 'Warrior',        desc: 'Defeat 10 monsters total' },
  kill50:   { title: 'Monster Hunter', desc: 'Defeat 50 monsters total' },
  coin20:   { title: 'Small Fortune',  desc: 'Accumulate 20 Gold Coins' },
  coin100:  { title: 'Wealthy',        desc: 'Accumulate 100 Gold Coins' },
  survive3: { title: 'Night Owl',      desc: 'Survive 3 nights' },

  // ── Milestones: Build ─────────────────────────────────────────
  build1:     { title: 'Founder',            desc: 'Place the first building' },
  build5:     { title: 'Village Builder',    desc: 'Place 5 buildings' },
  sword1:     { title: 'Swordsmith',         desc: 'Craft the first stone sword' },
  iron_sw:    { title: 'Master Blacksmith',  desc: 'Craft an Iron Sword' },
  blueprint1: { title: 'Blueprint Collector', desc: 'Obtain 1 Blueprint' },
  barracks1:  { title: 'Commander',          desc: 'Build a Barracks' },

  // ── Milestones: Explore ───────────────────────────────────────
  night1:   { title: 'First Night', desc: 'Survive the first night' },
}
export default quest
```
> 注意：`stone10.title` 使用 **雙引號** `"Miner's First Steps"`（因內含撇號）。原檔每個里程碑為多行物件，這裡壓成單行，內容一致。

### recipe.ts
```typescript
const recipe: Record<string, any> = {
  // ── Research Lv 1 ────────────────────────────────────────────
  plank:            { name: 'Plank' },
  axe:              { name: 'Axe' },
  pickaxe:          { name: 'Stone Pickaxe' },
  stone_sword:      { name: 'Stone Sword' },
  // ── Research Lv 2 ────────────────────────────────────────────
  bread:            { name: 'Bread' },
  flashlight:       { name: 'Flashlight' },
  bed:              { name: 'Bed' },
  // ── Research Lv 3 ────────────────────────────────────────────
  iron_pick:        { name: 'Iron Pickaxe' },
  cooked_meat:      { name: 'Cooked Meat' },
  // ── Research Lv 4 ────────────────────────────────────────────
  wood_bow:         { name: 'Wood Bow' },
  arrow:            { name: 'Arrow' },
  ingot:            { name: 'Iron Ingot' },
  iron_sword:       { name: 'Iron Sword' },
  gold_sword:       { name: 'Gold Sword' },
  // ── Research Lv 5 ────────────────────────────────────────────
  bag_small:        { name: 'Small Bag' },
  leather_armor:    { name: 'Leather Armor' },
  iron_armor:       { name: 'Iron Armor' },
  gold_armor:       { name: 'Gold Armor' },
  iron_bow:         { name: 'Iron Bow' },
  fire_arrow:       { name: 'Fire Arrow' },
  ice_arrow:        { name: 'Ice Arrow' },
  shield:           { name: 'Shield' },
  // ── Research Lv 6 ────────────────────────────────────────────
  spike_trap:       { name: 'Spike Trap' },
  fire_trap:        { name: 'Fire Trap' },
  grenade:          { name: 'Grenade' },
  laser_gun:        { name: 'Laser Gun' },
  gourmet_1:        { name: 'Afternoon Tea Set I' },
  // ── Research Lv 7 ────────────────────────────────────────────
  ice_trap:         { name: 'Ice Trap' },
  laser_tower:      { name: 'Laser Tower' },
  cannon_tower:     { name: 'Cannon Tower' },
  magic_sword:      { name: 'Magic Sword' },
  // ── Research Lv 8 ────────────────────────────────────────────
  bag_large:        { name: 'Large Bag' },
  magic_bow:        { name: 'Magic Bow' },
  crystal_armor:    { name: 'Crystal Armor' },
  whirlwind_hammer: { name: 'Whirlwind Hammer' },
  gourmet_2:        { name: 'Afternoon Tea Set II' },
  // ── Research Lv 9 ────────────────────────────────────────────
  mithril_sword:    { name: 'Mithril Sword' },
  // ── Research Lv 10 ───────────────────────────────────────────
  laser_orb:        { name: 'Magic Orb' },
}
export default recipe
```

### render.ts
```typescript
const render = {
  daynight: {
    day: 'DAY {count}',
  },
}
export default render
```

### research.ts
```typescript
const research: Record<string, any> = {
  // Upgrade unlock descriptions, key is "lv<target level>"
  lv2:  { unlocks: 'Market + Food Recipes' },
  lv3:  { unlocks: 'Tool Upgrade Recipes' },
  lv4:  { unlocks: 'Weapon Recipes + Archery' },
  lv5:  { unlocks: 'Armor Recipes' },
  lv6:  { unlocks: 'Defense Trap Recipes' },
  lv7:  { unlocks: 'Siege Weapon Upgrades' },
  lv8:  { unlocks: 'Advanced Magic Recipes' },
  lv9:  { unlocks: 'Ultimate Equipment Recipes' },
  lv10: { unlocks: 'Legendary Recipes' },
}
export default research
```

### resource.ts
```typescript
const resource = {
  tree:         { name: 'Tree' },
  rock:         { name: 'Rock' },
  iron:         { name: 'Iron Ore' },
  gold:         { name: 'Gold Ore' },
  crystal:      { name: 'Crystal' },
  berry:        { name: 'Berry Bush' },
  tomato:       { name: 'Tomato' },
  purple_grape: { name: 'Purple Grape' },
  onion:        { name: 'Onion' },
  carrot:       { name: 'Carrot' },
  pumpkin:      { name: 'Pumpkin' },
  watermelon:   { name: 'Watermelon' },
  fire_node:    { name: 'Lava Stone' },
  ice_node:     { name: 'Ice Crystal' },
}
export default resource
```

### save.ts
```typescript
const save = {
  complete: 'Game saved',
  failed: 'Save failed: {err}',
  loading: 'Loading…',
  deleting: 'Deleting…',
  exported: 'Player data exported',
  imported: 'Player data imported',
  invalidPlayerData: 'Invalid player data',
  worldSaved: 'World saved',
  worldDeleted: 'World deleted',
  worldRenamed: 'Save renamed',
  notFound: 'Save not found: {name}',
}
export default save
```

### toast.ts
```typescript
const toast: Record<string, any> = {
  gold_insufficient:        '💰 Not enough gold!',
  material_insufficient:    '❌ Not enough materials',
  gold_and_material_insuf:  '❌ Not enough gold',
  upgrade_max_or_no_mat:    '❌ Not enough materials or already max level',
  research_upgrading:       '🔬 Researching... ({duration}s)',
  saved:                    '💾 Saved',
  save_failed:              '❌ Save failed: {error}',
}
export default toast
```

### treasure.ts
```typescript
const treasure: Record<string, any> = {
  // ── Chest Interaction ──────────────────────────────────────────
  hint:           'Press [R] to open chest',
  opening:        'Opening chest…',
  opened:         'Chest opened!',
  empty:          'The chest is empty',
  too_far:        'Too far away, get closer to open',
  already_opened: 'This chest has already been opened',

  // ── Reward Notifications ───────────────────────────────────────
  reward:         'Received {item} ×{n}',
  reward_multi:   'Received {count} items!',
  no_reward:      'Nothing this time…',

  // ── Rarity ────────────────────────────────────────────────────
  rarity: {
    common: 'Common',
    rare:   'Rare',
    epic:   'Epic',
  },

  // ── Chest Labels ──────────────────────────────────────────────
  chest: {
    common: 'Common Chest',
    rare:   'Rare Chest',
    epic:   'Epic Chest',
  },
}
export default treasure
```

### ui.ts
```typescript
const ui = {
  common: {
    close:     '✕',
    back:      '← Back',
    free:      'Free',
    unknown:   'Unknown',
    level:     'Level',
    upgrade:   '⬆ Upgrade',
    max_level: '🎉 Max level reached (Lv {lv})',
  },
  bag: {
    title:           '🎒 Bag',
    capacity:        'Capacity: {used} / {max}',
    capacity_inf:    'Capacity: {used} / ∞',
    put_in_label:    '📥 Put In (click item → choose amount)',
    contents_label:  '🎒 Bag Contents',
    empty:           'Bag is empty',
    put_in_btn:      'Put In',
    take_one_btn:    'Take 1',
    take_all_btn:    'Take All',
    prompt_put:      'How many {name}?',
  },
  market: {
    title:             '🏪 Market',
    daily_label:       '🌟 Daily Deal',
    current_price:     'Sell price: ',
    gold_unit:         'gold',
    gold_per_unit:     '{price} gold/ea',
    owned:             'In stock: ',
    earn:              'You will earn: ',
    sell_btn:          '💰 Sell',
    buy_btn:           'Buy',
    no_gold:           'Not enough gold',
    no_items:          'Nothing to sell',
    blueprint_default: 'Blueprint',
  },
  furnace: {
    title:           '🔥 Furnace',
    iron_recipe:     'Iron Ore → Iron Ingot',
    gold_recipe:     'Gold Ore → Gold Ingot (3:1)',
    coin_recipe:     'Gold Ore → Gold Coin (1:1)',
    ore_name_iron:   'Iron Ore',
    ingot_name_iron: 'Iron Ingot',
    ore_name_gold:   'Gold Ore',
    ingot_name_gold: 'Gold Ingot',
    coin_name:       'Gold Coin',
    ratio:           'Ratio: ',
    ore_held:        'Ore held: ',
    can_produce:     'Ingots producible: ',
    smelt_btn:       '🔥 Smelt {name} ×{qty}',
  },
  research: {
    title:          '🛠️ Workstation',
    no_items:       'No upgrades available',
    row_sub:        'Research Route {n}',
    done_mark:      'Completed',
    detail_done:    '✅ Already researched',
    meta_route:     '🔬 Research Route {n}',
    meta_time:      '🕐 Duration: {secs} s',
    meta_gold:      '🪙 Gold: {gold}',
    mats_label:     'Materials Required',
    mat_free:       'No materials required',
    upgrade_btn:    '⚡ Start Research (+1 level)',
    progress_label: '🔄 Upgrading…',
    time_left:      'Remaining: {secs} s',
  },
  building: {
    title:       '🏗️ Buildings',
    place_btn:   'Place',
    size:        '{w}×{h}',
  },
  barracks: {
    title:              '⚔️ Barracks',
    stats_title:        '⚔️ Current Soldier Stats',
    stat_max_soldiers:  'Max Soldiers',
    stat_hp:            'HP',
    stat_atk:           'ATK',
    stat_speed:         'SPD',
    stat_spawn:         'Spawn Interval',
    stat_respawn:       'Respawn Time',
    level_row:          'Level: Lv {lv} / {max}',
    upgrade_title:      '⬆ Upgrade to Lv {lv}',
    preview:            'Max Soldiers +{diff} | HP {hp_from} → {hp_to} | ATK {atk_from} → {atk_to} | Spawn {int_from}s → {int_to}s',
    upgrade_btn:        '⬆ Upgrade',
    max:                '🎉 Max level reached (Lv {lv})',
    req_have:           '{name}: need {need} (have {have})',
  },
  base_core: {
    title:          '🏰 Base Core',
    level_row:      'Level: {lv} / 10',
    hp_bonus:       '❤️ HP Bonus: +{pct}%',
    atk_bonus:      '⚔️ ATK Bonus: +{pct}%',
    regen:          '💚 HP Regen/s: +{val}',
    upgrade_title:  'Upgrade to Lv {lv}',
    preview_hp:     '❤️ HP Bonus → +{pct}%',
    preview_atk:    '⚔️ ATK → +{pct}%',
    preview_regen:  '💚 Regen → +{val}/s',
    upgrade_btn:    '⬆ Upgrade',
    max:            '🎉 Max level reached (Lv 10)',
    req_have:       '{name}: need {need} (have {have})',
  },
  equip: {
    title:      '🛡 Equipment',
    no_armor:   'No armor',
    unequip:    'Unequip',
    def_pct:    '-{pct}% damage taken',
  },
  hotbar: {
    bag_hint: 'right-click',
    unknown:  'Unknown',
  },
  crafting: {
    empty_hint:     '← Select a recipe',
    owned:          'Owned: {qty}',
    weapon_title:   '⚔ Weapon Stats',
    stat_damage:    'Damage',
    stat_res:       'Resource DMG',
    stat_range:     'Range',
    stat_range_val: '{val} tiles',
    stat_cooldown:  'Cooldown',
    stat_cd_val:    '{val} s',
    locked_msg:     '🔒 Unlock by researching Route {lv} at the Workstation',
    craft_btn:      '⚒ Craft ×{qty}',
  },
}
export default ui
```

### weapon.ts
```typescript
const weapon: Record<string, any> = {
  fist:              { name: 'Bare Hands' },
  stone_sword:       { name: 'Stone Sword' },
  pickaxe:           { name: 'Pickaxe' },
  axe:               { name: 'Axe' },
  iron_sword:        { name: 'Iron Sword' },
  iron_pick:         { name: 'Iron Pickaxe' },
  gold_sword:        { name: 'Gold Sword' },
  magic_sword:       { name: 'Magic Sword' },
  mithril_sword:     { name: 'Mithril Sword' },
  laser_orb:         { name: 'Magic Orb' },
  laser_gun:         { name: 'Laser Gun' },
  whirlwind_hammer:  { name: 'Whirlwind Hammer' },
}
export default weapon
```
> 注意：英文版 `weapon.laser_orb` 與 `item.laser_orb` 同為「Magic Orb」（中文版 weapon 則作「魔法泡泡」、item 作「魔法球」，僅中文有差異）。

### world.ts
```typescript
// 由模組擁有者填內容，例如 { wood: { name: '木材' } }
const world: Record<string, any> = {}
export default world
```

## 重建提示
- **檔案骨架**：每檔 `const <name>... = {...}` + `export default <name>`。標 `Record<string, any>` 的有 `armor/common/game/item/monster/network/recipe/research/toast/treasure/weapon/world`；不標型別的有 `building/dungeon/hud/lobby/quest/render/resource/save/ui`。型別標註照原檔即可。
- **中英 key 必須完全對齊**：en 與 zh-TW 的 key 結構一字不差，只有 value 不同。對照中文版見 locales-zh-tw skill。
- **插值參數**：與 zh-TW 同名同位置（`{name}`、`{cost}`、`{level}`、`{lv}`、`{secs}`、`{qty}`、`{used}`/`{max}`、`{pct}`、`{val}`、`{err}`/`{error}`、`{done}`/`{total}`、`{item}`/`{n}`、`{w}`/`{h}`、`{remaining}`、`{duration}`、`{price}`、`{need}`/`{have}`、`{hp_from}`/`{hp_to}`、`{int_from}`/`{int_to}`、`{atk_from}`/`{atk_to}`、`{diff}`、`{reason}`、`{ore}`、`{amount}`、`{count}`、`{gold}` 等）。
- **英文特有的引號/跳脫**：`game.daytime_now` 用 `'🌞 It\'s daytime…'`（單引號內跳脫撇號）；`quest.stone10.title` 用雙引號 `"Miner's First Steps"`；`lobby.delete_confirm` 含 `\n` 換行。忠實保留。
- **巢狀 namespace 路徑**與 zh-TW 完全相同（`ui.bag.title`、`quest.wood10.desc`、`building.upgrade.cost`、`research.lvN.unlocks` 等）。
- **空檔佔位**：`common`、`world` 兩語系皆為空物件 `{}`，仍要存在並被 index 匯入，勿刪。
- 易漏：22 個 namespace 缺一不可，特別是空檔（common/world）與容易忘的 render/network。
