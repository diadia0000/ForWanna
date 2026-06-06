# Forager MP

4 人連線 2D 資源採集遊戲，融合**探索**與**守城**兩大玩法軸線。  
玩家在隨機生成的世界中採集資源、製作物品、蓋建築，並與最多 3 位朋友同時連線遊玩。

**技術棧**：PixiJS 8 · PeerJS (WebRTC P2P) · Dexie.js · TypeScript · Vite · i18n (zh-TW + English)

> 本專案為**私人多人協作 repo**。`.env`（含 Railway peer server 網址）已納入版控，clone 後即可直接使用。

---

## 🎮 核心玩法

### 軸線 1：探索 — 環狀島嶼解鎖

從中心島出發，花**金幣**逐步解鎖外圈小島：

- 1環 50 🪙、2環 200 🪙、3環 500 🪙、4環 1200 🪙
- 靠近鎖定島時螢幕顯示圓圈和解鎖費用（按 U 鍵解鎖）
- 各環資源更豐富、怪物更強，難度遞增
- 持有**遺跡地圖**（🗺️）時按 E 進入程序生成地下遺跡，挑戰 Boss 獲取設計圖

### 軸線 2：守城 — 夜晚防禦浪潮

**白天**：採集資源、製作裝備、蓋防禦建築  
**夜晚**：守城怪以**波次**出現（10–30秒隨機間隔，每波 1–3 組，每組 1–5 隻同類），用石牆、瞭望塔、陷阱守住基地

- **野怪**（不追人）：白天夜晚都有
- **守城怪**（追玩家/基地核心）：強度 = 夜晚數 × 所在環數
- **菁英怪**：HP×3、ATK×2、速度×1.5
- **世界 Boss**：每 5 夜 1 隻，HP×10、ATK×3，30% 機率掉落遺跡地圖

**遺跡系統**：
- 持有**遺跡地圖**（🗺️，世界 Boss 30% 掉落）按   E 進入程序生成多房間副本
- 副本最長分支末端為 **Boss 房**，擊殺後自動傳送出去
- **遺跡地圖消耗制**：進入副本後消耗 1 張，每次生成隨機種子

> ⚠️ **床的懲罰機制**：夜晚使用床（E 鍵消耗 1 個）會：彈飛到 y-5000（🛸 跳字）→ 背包所有物品散落地面 → 1.5秒後墜回 → 💥 墜落死亡 → 重生點復活滿血。白天使用床會給提示。

### 金幣經濟

**來源**：打怪掉落 · 熔爐冶煉金礦 · 市場賣出資源  
**用途**：解鎖新島 · 研究所升級 · 市場購買設計圖

---

## 🔧 系統總覽

### 雙等級系統

| 等級 | 範圍 | 升級方式 | 效果 |
|------|------|---------|------|
| **Combat Lvl** | 1–20 | 打怪累積 XP | HP / ATK / DEF 屬性成長 |
| **Research Lvl** | 1–10 | 花時間 + 材料升級研究所 | 解鎖製作配方與建築 |

**配方解鎖機制**：
- 每個配方對應所需的 Research Lvl（例：進階建築需 Lv 5+）
- 製作時自動檢查玩家等級，不足時禁用製作按鈕

Combat 屬性公式：
- HP = 100 + (Lv-1) × 15
- ATK = 10 + (Lv-1) × 5
- DEF = 0% + (Lv-1) × 2%

### 物品品級系統

| 品級 | 顏色 | 市場定價倍率 |
|------|------|------------|
| 普通 Common | 灰 | ×1.0 |
| 優良 Uncommon | 綠 | ×1.5 |
| 稀有 Rare | 藍 | ×2.5 |
| 史詩 Epic | 紫 | ×5.0 |
| 傳說 Legendary | 橙 | ×10.0 |

### 裝備系統

- **G 鍵**穿脫盔甲，右下角 EquipUI 顯示已穿戴裝備
- 5 種盔甲：皮甲(10%) → 鐵甲(15%) → 黃金甲(20%) → 晶體甲(25%) → 盾牌(35%) 減傷

### 武器 / 工具

| 類型 | 系列 |
|------|------|
| 近戰 | 石劍 → 鐵劍 → 金劍 → 魔法劍 → 秘銀劍 |
| 弓箭 | 木弓 → 鐵弓 → 魔法弓（配合基礎/火焰/冰凍箭矢）|
| 特殊 | 雷射槍、旋風槌（設計圖解鎖）|
| 工具 | 斧頭 → 石鎬 → 鐵鎬（採集效率遞增）|
| 輔助 | 手電筒🔦（夜晚開啟 25 度錐形光束，距離 5 格）|

### 建築系統

| 類別 | 建築 |
|------|------|
| 防禦 | 石牆、瞭望塔（自動攻擊）、刺製/火焰/冰凍陷阱 |
| 進階防禦 | 雷射塔、加農砲（設計圖解鎖，可升級 Lv 1–5）|
| 生產 | 熔爐（冶煉礦石）、農場（自動生產漿果）、各類食物植物|
| 功能 | 基地核心（範圍加成 HP/ATK/回血，可升級 Lv 1–10）|
| 交易 | 市場（賣出資源換金幣，每日特賣設計圖）|
| 兵力 | 兵營（每 30 秒生成 1 名士兵，最多 3 名，可升級 Lv 1–3）|

**建築狀態同步**：
- **破損機制**：建築被攻擊時透明度降低（alpha=0.3），視覺表示受損
- **修復系統**：玩家可修復破損建築
- **怪物優先級**：優先攻擊石牆 → 陷阱 → 基地核心

### 遺跡系統（完整實裝）

- **入口機制**：持有**遺跡地圖**（🗺️ epic 品級）按 E 進入副本（消耗 1 張）
- **地圖生成**：程序生成多房間地圖（凸字形佈局，偏移座標 150,000+），每次進入隨機種子
- **Boss 房機制**：DungeonGenerator 追蹤最長分支，末端房間指定為 Boss 房
- **Boss 擊殺後**：自動傳送出去，不掉遺跡地圖（防無限刷）
- **敵人 HP 條**：所有副本敵人頭上有血量條（>50% 綠，25-50% 黃，<25% 紅）
- **來源**：世界 Boss（每 5 夜 1 隻）擊殺 30% 機率掉落

### 多語言支援（i18n）

- **支援語言**：繁體中文（zh-TW）+ English
- **動態載入**：根據系統或玩家選擇自動切換
- **涵蓋範圍**：UI 面板、物品名稱、提示訊息、遊戲內文本

### 玩家移動與控制

- **移動速度**：調整為 10（從原本 3），提升遊戲節奏
- **滑鼠跟隨**：玩家角色自動面向滑鼠方向
- **手持物品顯示**：選取快捷欄物品時，角色旁邊顯示物品圖示

---

## 🚀 開始開發

```bash
git clone https://github.com/diadia0000/ForWanna.git
cd ForWanna
npm install
npm run dev    # → http://localhost:5175
```


### 📋 開發文檔快速連結

改程式碼前讀這些：

- **開發禁止事項**：[.claude/rules/development-rules.md](.claude/rules/development-rules.md)
- **CodeGraph 使用**：[.claude/rules/codegraph-rules.md](.claude/rules/codegraph-rules.md)

---

## 🧩 從 Skill 重建專案（重生順序 & 驗收里程碑）

本專案採 **skill 驅動重建**：`skills/` 內每個模組/符號各一份 `SKILL.md`（含公開
API、核心邏輯、常數、依賴、重建提示）＝重建規格；`src/` 是由這些規格生成的產物。
角色分工見 [.claude/claudemd/agents.md](.claude/claudemd/agents.md)（17 個角色）。

> 二進位資產（`public/assets/`）無法生成，必須直接帶入；建置設定（`package.json`
> 等）可現場 `npm install` + 標準樣板產生，或參考 `skills/vite-config`。

### 要帶進場的檔案（種子包）

**✅ 必帶**
- `.claude/`（**已含 `.claude/skills/` 全套 skill** ＋ `agents/`(17 角色定義) ＋ `claudemd/`(architecture / game-design / **events 契約** / troubleshooting / agents) ＋ `rules/` ＋ `settings.json`）
  - 註：最上層 `skills/` 與 `.claude/skills/` 內容**完全相同**，擇一即可；帶 `.claude/` 連 agent 定義與契約文件一起到位。
- `README.md`（本檔：玩法、系統、重生順序）
- 🔴 `public/assets/`（216MB 二進位貼圖 ＋ `main_resources/items_json/*` manifest）— **唯一硬性非帶不可、AI 生不出來**
- `peer-server/` ＋ `.env`（多人連線；`.env` 那串 Railway 網址猜不到）
- `src/**/*.test.ts` ＋ `vitest.config.ts`（驗收網，比賽允許帶測試）

**🟡 可選便利帶**
- `vite.config.ts`（已包成 `skills/vite-config`；帶原檔可省得 `@` 別名 / port 設錯）

**❌ 不帶（比賽現場由 agent 生成）**
- 全部 `src/**/*.ts` 遊戲邏輯（這正是要被「coding」出來的產物）
- `package.json` / `package-lock.json` / `tsconfig.json` / `index.html`（現場 `npm install` ＋ 標準樣板自然產生）
- `src/**/*.js`（tsc 編譯產物）、`dist/`、`node_modules/`、`.codegraph*/`、`tmp/`、`.playwright-mcp/`

### 重生順序（依賴關係，必須照順序）

**第 0 步 — 契約先行（Event Architect）**
- 生 `src/types/index.ts`，並對齊 `.claude/claudemd/events.md` 的事件契約。
- 為何最先：所有模組都 `import '@/types'`、靠 `GameEvents` 事件溝通。契約沒定死，
  後面各 agent 各做各的會兜不起來。
- ✅ 驗收：`types` 編譯通過、`events.md` 契約確認無缺。

**第 1 步 — 16 個模組 agent 並行**
- 每個 agent 照自己的 `skills/<模組>/` 生對應 `src/<模組>/`（彼此不互 import，只走
  EventBus / `@/core`）。
- ✅ 驗收（模組級）：跑該模組的 `*.test.ts`（EventBus、GameState、Inventory、
  CraftingSystem、MarketPricing、Spawner、network、persistence）轉綠；`npx tsc --noEmit` 過。
- 預計：此步完成後，**各模組應能獨立重生、單元測試轉綠**（為比賽目標，尚未實測驗證）。

**第 2 步 — 整合（整合者 Agent 10）**
- 用 `skills/main/`（＋ `reference_01~05`）生 `src/main.ts`：依正確順序初始化各系統、
  註冊 EventBus 監聽、串接 Host / Client 兩條啟動路徑、跑主迴圈。
- ⚠️ **最關鍵、最容易卡的一步**——「能不能搓出可用的 `main.ts`」決定所有重生好的模組
  能否組裝成可玩遊戲。
- ✅ 驗收（整合級）：`npm run build`（= `tsc && vite build`）通過，無型別/接線錯誤。

**第 3 步 — 跑起來 + 視覺驗收**
- `npm run dev` → 瀏覽器 → 大廳進遊戲 → 採集 / 製作 / 建築 / 守城 / 遺跡 / 多人連線。
- 修貼圖載入（`public/assets` 路徑）、UI 樣式（`skills/style`）、接線細節。

### 復現指令

```bash
npm install         # 相依套件（pixi.js 8 / dexie / peerjs）
npm test            # ① 模組級驗收：全綠才往下
npm run build       # ② 整合級驗收：tsc + vite build 通過
npm run dev         # ③ 跑起來：http://localhost:5175 瀏覽器驗收
```

### 驗收里程碑

| 里程碑 | 驗收方式 | 重點 |
|--------|---------|------|
| **A — 模組重生** | 各模組 `*.test.ts` 綠 ＋ `tsc --noEmit` | 每塊各自正確 |
| **B — 整合 main** | `npm run build` 過 | 能否「搓出 main」把模組接起來（最關鍵）|
| **C — 可玩** | `npm run dev` 瀏覽器跑通 + 多人連線 | 端到端目標 |

---

## 🗂️ 檔案架構

```
forager-mp/
├── peer-server/          # 獨立 Node.js app，部署到 Railway
│   ├── server.js         #   PeerJS 信令伺服器
│   └── package.json
│
├── .env                  # PeerJS 信令伺服器位址（已提交，共用 Railway URL）
│
├── src/
│   ├── main.ts           # 整合進入點（串連所有模組）
│   ├── style.css         # 全域樣式（HUD、Panel、Lobby）
│   │
│   ├── types/index.ts    # 所有共用型別（PlayerData、WorldData、NetMessage…）
│   │
│   ├── core/             # GameLoop、EventBus、GameState
│   ├── network/          # PeerJS WebRTC P2P（RoomManager、NetworkHost、NetworkClient）
│   ├── world/            # Seeded 地圖生成 + Per-chunk TileMap 渲染
│   ├── player/           # 玩家實體（移動、HP、動畫、客戶端預測）
│   ├── resources/        # 資源節點（採集、HP、respawn、多人同步）
│   │
│   ├── inventory/        # 背包 + 製作系統
│   │   └── data/
│   │       ├── items.ts              # 80+ 物品定義（含品級）
│   │       ├── recipes.ts            # 配方定義（按 Research Lvl 分組）
│   │       └── researchUpgradeCosts.ts # 研究所升級成本表
│   │
│   ├── building/         # 建築系統（放置、碰撞、升級、陷阱觸發）
│   │   └── data/buildings.ts        # 所有建築 + BUILDING_UPGRADES 配置
│   │
│   ├── combat/           # 戰鬥系統
│   │   ├── MonsterSpawner.ts        # 野怪 + 波次守城怪
│   │   ├── WeaponDefs.ts            # 武器傷害/射程定義
│   │   └── ArmorDefs.ts             # 盔甲減傷定義
│   │
│   ├── dungeon/          # 遺跡系統
│   │   ├── DungeonGenerator.ts      # 程序生成多房間地圖
│   │   └── DungeonScene.ts          # PixiJS 渲染 + 敵人 AI + Boss 房
│   │
│   ├── locales/          # 多語言（i18n）
│   │   ├── index.ts      # i18n 初始化與語言切換
│   │   ├── zh-TW/        # 繁體中文翻譯
│   │   └── en/           # English 翻譯
│   │
│   ├── treasure/         # 寶箱系統（棕/藍/金稀有度，各島嶼獨立生成）
│   ├── quest/            # 任務/里程碑系統
│   ├── render/           # 粒子特效、日夜循環、資源預載
│   ├── save/             # Dexie.js IndexedDB 存檔（世界 + 玩家）
│   │
│   └── ui/               # 所有介面元件
│       ├── HUD.ts                   # 抬頭顯示（HP/XP/金幣/日夜）
│       ├── HotbarUI.ts              # 快捷欄（1–5）
│       ├── InventoryUI.ts           # 背包（I 鍵）
│       ├── CraftingUI.ts            # 製作（C 鍵）
│       ├── BuildingUI.ts            # 建築（B 鍵）
│       ├── FurnaceUI.ts             # 熔爐（靠近按 E）
│       ├── MarketUI.ts              # 市場（靠近按 E）
│       ├── ResearchUI.ts            # 研究所（靠近按 E）
│       ├── EquipUI.ts               # 裝備欄（右下角常駐）
│       └── BarracksUI.ts            # 兵營（靠近按 E）
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── .gitignore
```

---

## 🌐 網路架構

```
Host                              Client (最多 3 人)
────────────────────────────────────────────────────
開房間 → PeerJS 信令伺服器         加入房間 → 連到 Host
         (Railway 部署)
         ↓
         WebRTC P2P DataChannel（直連）

移動同步（每幀）：
  Client 按鍵 → ClientPrediction（本地即時預測）
              → send(input) → Host
                              → applyInput
                              → broadcast(state_delta)
              ← 收到 state_delta → syncFromServer
```

---

## ⚙️ 備用：切換到本地 Peer Server

Railway 掛掉、或需要 debug 網路層時使用：

```bash
# 1. 修改 .env
VITE_PEER_HOST=localhost
VITE_PEER_PORT=9000
VITE_PEER_SECURE=false

# 2. 啟動本地 peer server（另開終端機）
npm run peer   # → localhost:9000

# 3. 啟動遊戲
npm run dev
```

> 完成後記得把 `.env` 改回 Railway 設定再 commit。
