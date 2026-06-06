---
name: combat
description: 戰鬥模組總綱：怪物 AI 狀態機、怪物/攻城生成、精英與 Boss、武器與護甲定義。重建怪物行為、波次生成、戰鬥平衡、武器數值先看這份，再按需展開 reference 子檔。
---

# combat 模組總綱

本檔是 `src/combat/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`combat/index`](./index/reference.md) — 重建 combat 模組的對外匯出桶（barrel）時查這裡——哪些類別/函式/型別對外公開、哪些是內部不匯出。
- [`combat/ArmorDefs`](./ArmorDefs/reference.md) — 重建 ARMOR_DEFS 防具資料表（傷害減免百分比 defPct、icon）與 getArmorDef/getArmorName 查詢函式時查這裡。
- [`combat/Monster`](./Monster/reference.md) — 重建 MonsterEntity（怪物實體、MONSTER_STATS 屬性表、PixiJS sprite/HP bar、受擊與攻擊動畫、狀態機旗標、狀態效果欄位）時查這裡。
- [`combat/MonsterSpawner`](./MonsterSpawner/reference.md) — 重建 MonsterSpawner（野怪/守城波次生成、難度乘數、菁英/Boss、AI 狀態機、陷阱碰撞、灼燒、死亡掉落、Host tick 與 Client applyDelta 同步）時查這裡。
- [`combat/WeaponDefs`](./WeaponDefs/reference.md) — 重建 WEAPON_DEFS 武器資料表（傷害/資源傷害/範圍/冷卻/攻擊弧度）與 getWeaponDef/getWeaponName 查詢函式時查這裡。
