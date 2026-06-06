// Agent 7 — src/locales/zh-TW/building.ts
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
