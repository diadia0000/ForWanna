# Forager MP — AGENTS.md

## 專案入口
專案名稱：Forager MP（多人聯網沙盒遊戲）
專案用途：PixiJS 2D 像素風格的多人沙盒遊戲，支持網路同步、資源採集、建築系統、戰鬥機制
主要工作目錄：D:\coding\forager-mp
GitHub repo：https://github.com/你的repo位置
預設 branch：dev

## Obsidian 對應筆記
Obsidian vault：未使用
專案駕駛艙：未使用

## 同步規則
開工時：讀本檔、檢查 Git 狀態
收工時：整理已有功能/待辦/重要決策到本檔、必要時 commit + push

## 上次做到哪
### 已完成功能

**UI 改版**
- ✅ 熔爐 UI 改為垂直兩欄佈局（左欄配方列表 + 右欄詳細，與製作 UI 一致）
- ✅ 建築 UI 可捲動（overflow-y: auto，最高 420px）+ 補全所有建築圖示
- ✅ 製作 UI 列表加高（460px）、物品名稱顯示中文（移除 toUpperCase）
- ✅ 製作 UI 顯示武器/工具數值（攻擊力/採集力/射程/冷卻）
- ✅ 製作/建築/熔爐面板的滾輪事件不再冒泡到快捷欄
- ✅ 基地核心 UI（E 鍵開啟，顯示等級/加成/升級成本，升級按鈕）

**數值修正**
- ✅ 金礦冶煉比例改為 1:1（1 金礦 → 1 金錠）
- ✅ 從 C 製作選單移除建築類配方（熔爐/農場/市場/瞭望塔/城牆）
- ✅ 從 C 製作選單移除金錠配方（只能用熔爐冶煉）
- ✅ 高級食物改名為「下午茶套餐」

**掉落系統改版**
- ✅ 掉落物更大（圓形 r=12）+ 光暈呼吸效果（雙層半透明圓脈衝）
- ✅ 骨頭/羽毛不再自動入背包，掉落在地上讓玩家自行撿取
- ✅ 農場每 30 秒掉落 2 顆漿果（地面掉落，不自動給予）

**背包系統（前次）**
- ✅ 小背包（30皮革）/ 大背包（1000皮革）
- ✅ 快捷欄右鍵開啟背包 UI、拖曳物品放入背包

---
### 舊版已完成功能

**Priority 1：基地核心 + 守城完整化**
- ✅ 陷阱建築定義（spike_trap、fire_trap、ice_trap）+ base_core
- ✅ BuildingSystem.takeDamage() + repair()（破損透明 alpha=0.3）
- ✅ 怪物-陷阱碰撞 + 減速/灼燒/凍結狀態效果
- ✅ base_core 範圍加成（HP/ATK/被動回血）
- ✅ 菁英怪（HP×3、ATK×2、速度×1.5）+ Boss怪（每5夜1隻，HP×10、ATK×3）
- ✅ 怪物攻擊建築（城牆/陷阱/核心優先級）

**Priority 2：內容擴充**
- ✅ 兵營士兵系統（每30秒生成1名，最多3名，AI追怪攻擊，60秒後重生）
- ✅ 設計圖系統（blueprint_1~5 物品 + 對應配方消耗）
- ✅ 手榴彈（右鍵投擲，1.5s延遲引爆，3格 AoE 60傷害）
- ✅ 寶箱重構（2×2尺寸、靠近3格按R開啟、物品飛散特效、消失）

**Priority 3（部分，不需渲染器）：**
- ✅ 瞭望塔自動攻擊邏輯（4格範圍，15傷害，2秒冷卻）
- ✅ 雷射塔自動攻擊邏輯（15格，50+Lv×20傷害，2秒冷卻，菁英優先）
- ✅ 加農砲爆炸傷害邏輯（8格，20+Lv×8傷害，3.5秒冷卻，AoE爆炸）
- ✅ 雷射槍、旋風槌（物品定義 + 武器屬性 + 配方）
- ✅ laser_tower / cannon_tower（建築定義 + 升級配置 Lv 1-5）
- ✅ 兵營升級配置（Lv 1-3）

**System 5：採集素質調整**
- ✅ 資源 HP 重平衡（tree:5, rock:8, iron:10, gold:15, crystal:20）
- ✅ 工具效率（fist:0.5, axe:2, pickaxe:3, iron_pick:5）
- ✅ 掉落量調整

**舊功能（原有）：**
- ✅ 雙等級系統（Combat Lvl + Research Lvl）
- ✅ 物品/配方系統（~55+ 物品，50+ 配方）
- ✅ 熔爐（鐵礦→鐵錠 + 金礦→金錠，兩個 tab）
- ✅ 建築升級系統（BUILDING_UPGRADES）
- ✅ 快捷欄改進

- ✅ 寶箱系統澄清
  - 移除 chest 物品定義（不可製作）
  - 移除建築系統中的 _drawChest() 方法和相關渲染邏輯
  - 地圖寶箱由獨立 TreasureChest 系統管理（稀有度掉落：棕/藍/金 = 70%/25%/5%）

- ✅ 多個 Bug 修復
  - researchLevel 初始化（NetworkClient、SyncProtocol）
  - 事件型別定義（building:upgraded）
  - 編譯錯誤（require → import、型別標註）
  - 白屏問題解決

## 待辦事項
### Priority 3（需渲染器配合）
- [ ] 雷射槍光束視覺（藍色直線 beam，需組員的渲染 PR 配合）
- [ ] 雷射塔光束動畫
- [ ] 加農砲砲彈飛行軌跡（拋物線動畫）
- [ ] 旋風槌旋轉動畫 + 圓形 AoE 範圍顯示

### Priority 4（數值平衡）
- [ ] 建築破損半透明同步給 Client 端（目前只 Host 端更新 alpha）
- [ ] 士兵系統多人同步（目前只 Host 端運行，Client 端看不到士兵）
- [ ] 手榴彈多人同步（目前只本地端視覺）
- [ ] 怪物攻擊建築事件廣播到 Client 端

### 系統六：遺跡系統（未開始）
- [ ] 遺跡入口（Boss 30% 掉落，玩家靠近按 R 進入）
- [ ] 地牢地圖生成（20×20 格）
- [ ] 5 波怪物系統 + 地牢寶箱

### 其他
- [ ] 市場系統：每天早上隨機價格波動（已有 MarketUI 基礎）
- [ ] 研究所升級 UI 時間倒數視覺化

## 重要決策
- **寶箱系統雙軌**：地圖寶箱（自然資源）獨立於建築系統，由 TreasureChest 管理
- **雙等級設計**：Combat Lvl → 戰鬥屬性；Research Lvl → 配方解鎖（完全分離）
- **建築升級機制**：使用配置表（BUILDING_UPGRADES）管理成本與效果，支援多層級
- **事件驅動設計**：所有跨模組通訊透過 EventBus（避免直接 import）
- **開發分支策略**：日常開發在 `dev`，穩定發布在 `main`
- **CraftingUI 武器數值**：本地複製 WEAPON_STATS 記錄（不跨模組 import combat），避免模組循環依賴
- **非資源掉落物**：使用 `'wood' as ResourceType` 型別強轉 workaround，因 DropItem 需要 resourceType 欄位
- **背包物品不計入交易**：Inventory.get() 只回傳主背包，bag 物品不能用於製作/交易（已確認設計）
- **市場只支援賣出**：MarketUI 目前無購買系統，buy 端留空（設計決策，不是 bug）

## 不要做
- 🚫 不要修改 `src/types/index.ts`（需共識）
- 🚫 不要在模組間直接 import 並呼叫方法，一律透過 EventBus
- 🚫 不要 `npm install` 未在 package.json 的套件
- 🚫 Commit message 不含「Codex」，改用英文或中文描述
