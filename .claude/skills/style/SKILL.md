---
name: style
description: 全域 CSS 樣式表（src/style.css）的重建指南，涵蓋 HUD、Hotbar、Day/Night 橫條、大廳 LobbyScreen、Tab Dock、各種 UI 面板（背包/製作/熔爐/市場/研究/基地核心/兵營/拆除）、漂浮框、拖曳 ghost、Toast 與動畫 keyframes。重建或調整任何 DOM-based UI 的版面、配色、邊框、z-index 疊放、滾動條、彈窗置中或動畫時，務必先參考這份。
---

# style.css

> 模組：root｜角色：全域樣式表（純 DOM/HTML 層，與 PixiJS canvas 分離），涵蓋 HUD、各種 UI 面板、大廳、彈窗、動畫等。約 1889 行，無 CSS 變數，所有顏色皆為硬編碼 hex/rgba。

## 整體結構 / 區塊清單
依檔案順序：

1. **全域 reset / body / #game-container** — `* { margin:0; padding:0; box-sizing:border-box }`、body 深色底、canvas 鋪滿。
2. **Lobby（大廳）** — `#lobby` 全屏遮罩、`.lobby-box`、`.section`、共用 `input[type=text]` / `button` base、`#lobby-status`、`.lobby-hint`、`.welcome-msg`、`.lobby-row`、`.btn-icon`、`.btn-secondary`。
3. **地圖/存檔列表** — `#map-list`、`.map-row`、`.map-item`（`.map-new`）、`.map-action-btn`（`.map-delete-btn` / `.map-confirm-btn`）、`.map-rename-input`。
4. **重連覆蓋層** — `#reconnect-overlay`、`.reconnect-box`、`.reconnect-spinner`、`.reconnect-sub`、`@keyframes spin`。
5. **Day/Night 橫條** — `#daynight-bar`、`#dn-icon`、`#dn-day`、`#dn-track`（漸層）、`#dn-dot`（嵌入 HUD flex row）。
6. **HUD（頂列）** — `#hud`、`.hud-left` / `#hud-center` / `.hud-right`、生命愛心 `.hud-vitals` / `.heart` / `.hud-hp-text`、飢餓 `#hud-hunger-row` / `#hud-hunger-segs`、XP `.hud-xp-block` / `#hud-xp-bar`、`.hud-save-btn`、房號 `#hud-room` / `#hud-room-code`。
7. **Tab Dock（按 TAB 全屏說明）** — `#side-dock`、`.dock-panel`、`.dock-title`、`.dock-grid`、`.dock-row`（`--action`）、`.dock-keys` / `.dock-key`（`--static` / `--listening`）、`.dock-row-icon`。
8. **Hotbar（底部工具列）** — `#hotbar`、`.hotbar-slot`（`--active`）、`.hotbar-icon` / `.hotbar-count` / `.hotbar-name`。
9. **漂浮框基底** — `.float-panel`（只管 z-index / pointer-events）。
10. **Inventory 疊層** — `#inventory-ui`（靠左）、`.inv-container`（裸格無外框）。
11. **Crafting 漂浮框（雙欄）** — `#crafting-ui` 固定 620x520、`.craft-list-col` / `.craft-row`(+modifiers) / `.craft-detail-col` / `.craft-reqs` / `.craft-req-row` / `.btn-craft-main`。
12. **Building Panel + Forager 風格格子** — `#building-ui`、共用 `.panel` / `.panel-header`、`.item-grid`（9 欄 x 100px）、`.item-slot`（`.has-item`）、`.item-icon` / `.item-amount` / `.item-label`。
13. **舊版 Crafting 卡片** — `.crafting-panel`、`#crafting-list`、`.recipe-card`(+craftable/locked)、`.recipe-*`、`.req-ok` / `.req-missing`、`.btn-craft`。
14. **島嶼費用標籤** — `.island-label`（`--afford` / `--locked`）、內含 `kbd`。
15. **背包拖曳 ghost** — `.drag-ghost`、`.item-slot--dragging` / `--dragover`。
16. **解鎖提示** — `#unlock-hint`（`--afford` / `--locked`）、`@keyframes hintPulse`。
17. **食物吃掉動畫** — `.eat-anim`、`@keyframes eatSlam`。
18. **製作數量列（共用）** — `.craft-qty-row` / `.craft-qty-num` / `.btn-qty-arrow` / `.btn-craft-extra`。
19. **熔爐面板** — `#furnace-ui`、`.furnace-panel`（後段被改成 row）、header/tabs/recipe/stock/`.btn-smelt`、後段 `.furnace-list-col` / `.furnace-detail-col` 兩欄重構。
20. **市場面板** — `#market-ui`、`.market-panel`、header、`.market-content`、items list、`.market-detail`、每日特賣 `.market-daily-*`、`.btn-buy-blueprint` / `.btn-sell`。
21. **研究所面板（雙欄）** — `#research-ui`（z-index 5000）、`.research-panel` 680px、header/level-badge、`.research-list-col` / `.research-row`(+modifiers)、`.research-detail-col`、materials、progress bar、`.btn-research-upgrade`、舊版 `.btn-upgrade`。
22. **背包 UI（BagUI）** — `#bag-ui` 460px、`.bag-header` / `#bag-title` / `#bag-capacity` / `.bag-close-btn`、`.bag-body`、`.bag-section`、放入清單 `.bag-inv-*` / `.bag-put-btn`、內容 `.bag-content-row` / `.bag-ci/cn/ca` / `.bag-take-one` / `.bag-take-all`、`.item-icon-img`、Hotbar 懸停 `.hotbar-slot--bag-hover` / `--bag-flash`。
23. **BuildingUI 捲動列表 + 武器數值** — `.building-list-scroll`、`.craft-weapon-stats` / `.craft-stats-grid`。
24. **BaseCoreUI** — `#base-core-ui`（綠色系）、`.base-core-panel` / header、`.bcu-*` 系列。
25. **BarracksUI** — `#barracks-ui`（藍色系）、`.barracks-panel` / header、`.barracks-stats-grid`（3 欄）、`.barracks-*`、`.btn-upgrade-barracks`。
26. **拆除確認** — `#demolish-panel`（紅色系）、`.demolish-*`、`#demolish-ok` / `#demolish-cancel`。
27. **UI Toast** — `.ui-toast`、`@keyframes ui-toast-fade`。

## 設計變數 / 配色 / 關鍵數值
無 CSS 變數；皆硬編碼。各面板用**色票區分功能**，這是視覺一致性的核心：

- **主綠（大廳 / 基地核心 / 通用按鈕）**：`#4caf50`（hover `#388e3c`）、`#81c784`、亮 `#88ff88`；底色 `#1e2a1e` / `#0f1a0f`。
- **木質金（背包 / 建築 / 熔爐 / Forager 格子）**：邊框 `#c8901a`、hover/亮 `#ffd060`、底色 `#1a110a` / `#2a1c0e` / `#3a2610`、輔助 `#7a4e0a` / `#6b3d06`。
- **藍（Crafting 漂浮框 / 數量列）**：`#2a6acc`、`rgba(80,140,220,*)`、文字 `#b8d8ff` / `#8aaccc`、底色 `#0f1932` / `#141e37`。
- **市場綠（青翠）**：`#2eb872`、`#5fdd9f`、底色 `#0a1a10`；每日特賣用琥珀金 `#d4a020` / `#f0c040`。
- **研究紫**：`#9050ff`、`#d090ff`、`#6030a0`、底色 `#1a1520` / `#0a0614` / `#140e23`。
- **兵營藍**：`#5588ee`、`#88aaff`、`#aaccff`、底色 `#0f1020` / `#1a2040`。
- **拆除紅**：`#8b3030` / `#ff7777` / `#8b2020`，底色 `#1a0f0f`。
- **狀態色（通用）**：可負擔/足夠 `.req-ok` `#81c784`；缺少 `.req-missing` `#ef9a9a`；橘色提示 `#ff9800` / `#ffaa55`。
- **字型**：`'Segoe UI', sans-serif`（body）；按鍵/標籤/島嶼標籤用 `monospace`。
- **z-index 階層（由低到高）**：`#hud` / `#hotbar` / `#side-dock` = **50**；`.island-label` = 55；`#unlock-hint` = 60；`.float-panel` 與多數面板（inventory/crafting/building/furnace/market）= **80**；`#base-core-ui` / `#barracks-ui` = 90；`#lobby` = 100；`#bag-ui` / `.drag-ghost` = **200**；`#reconnect-overlay` = 999；`.eat-anim` = 999；`#demolish-panel` = 9999；`#research-ui` = **5000**；`.ui-toast` = **99999**（最高，蓋過所有面板）。
- **置中面板共用法**：`position:fixed; top:50%; left:50%; transform:translate(-50%,-50%)`。
- **共用面板邊框立體陰影模式**：`box-shadow: inset 0 0 0 2px <深色>, 0 0 0 2px <更深>, 0 8px 32px rgba(0,0,0,0.75)`（熔爐/市場/研究/核心/兵營皆用此公式，僅換顏色）。
- **Forager 格子尺寸**：`.item-grid` = `repeat(9, 100px)`、gap `14px 6px`；`.item-slot` = 100x100。Hotbar slot = 54x54。

## 關鍵樣式片段

### Day/Night 橫條（漸層 track + 移動點，靠記憶必錯）
```css
#dn-track {
  position: relative;
  width: 110px; height: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.28);
  background: linear-gradient(to right,
    #87CEEB 0%, #87CEEB 25%,
    #FF7040 35%,
    #0d1b3e 50%,
    #FF9050 65%,
    #87CEEB 75%, #87CEEB 100%
  );
  overflow: visible;
}
#dn-dot {
  position: absolute; top: 50%;
  width: 11px; height: 11px;
  background: #fff; border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.45);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 5px rgba(0,0,0,0.7);
  transition: left 0.08s linear;  /* 由 JS 設定 left% 來移動 */
}
```

### HUD 版面（三段式 space-between）
```css
#hud {
  position: fixed; top: 0; left: 0; right: 0;
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: rgba(0,0,0,0.6);
  z-index: 50;
}
.hud-left  { display: flex; align-items: center; gap: 10px; font-size: 0.88rem; }
.hud-right { display: flex; align-items: center; gap: 8px; }
/* 生命/飢餓縱向；XP 區塊 min-width 150px，內含 5px 高漸層條 */
.hud-vitals { display: flex; flex-direction: column; gap: 2px; }
.heart--full  { color: #e84040; }
.heart--empty { color: #333; }
#hud-xp-bar {
  height: 100%;
  background: linear-gradient(to right, #7ec8e3, #3a9fd5);
  border-radius: 3px; transition: width 0.3s ease; width: 0%;
}
```

### Tab Dock 全屏覆蓋 + 雙欄 grid
```css
#side-dock {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}
.dock-panel {
  max-width: 920px; width: 100%; max-height: 100%;
  overflow-y: auto;
  background: rgba(20, 22, 28, 0.92);
  border: 2px solid rgba(255,255,255,0.25);
  border-radius: 16px; padding: 24px 28px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}
.dock-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 24px; }
/* .dock-key--listening 重綁按鍵時用黃色高亮 rgba(255,200,0,0.25)/#ffd060 */
```

### Hotbar（底部置中，slot 名稱用絕對定位放底外）
```css
#hotbar {
  position: fixed; bottom: 14px; left: 50%;
  transform: translateX(-50%); z-index: 50;
  display: flex; gap: 5px;
  background: rgba(0,0,0,0.45); border-radius: 10px;
  padding: 5px; border: 1px solid rgba(255,255,255,0.08);
}
.hotbar-slot { width: 54px; height: 54px; border: 2px solid rgba(255,255,255,0.22); border-radius: 7px; position: relative; }
.hotbar-slot--active { border-color: rgba(255,255,255,0.95); background: rgba(255,255,255,0.18); box-shadow: 0 0 10px rgba(255,255,255,0.3); }
.hotbar-name { position: absolute; bottom: -18px; left: 0; right: 0; font-size: 0.55rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

### Crafting 漂浮框：固定尺寸雙欄（左 300 + 右 flex）
```css
#crafting-ui {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  z-index: 80; display: flex; align-items: stretch;
  width: 620px; height: 520px;   /* 左 300 + 右 320 */
  border-radius: 12px; border: 2px solid rgba(80, 140, 220, 0.5);
  overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.75);
  background: #0f1932;
}
.craft-list-col {
  width: 300px; flex-shrink: 0;
  align-self: stretch;   /* 與右欄等高，勿用 height:100% */
  min-height: 0; box-sizing: border-box; overflow-y: auto;
  background: #0f1932; border-right: 1px solid rgba(80,140,220,0.25);
}
.craft-detail-col { flex: 1; height: 100%; min-height: 0; overflow-y: auto; background: #141e37; padding: 28px 20px 20px; }
```

### Forager 風格背包格子（9 欄 grid + has-item 變色）
```css
.item-grid { display: grid; grid-template-columns: repeat(9, 100px); gap: 14px 6px; user-select: none; }
.item-slot {
  width: 100px; height: 100px;
  background: #2a1c0e; border: 2px solid #7a5818; border-radius: 4px;
  position: relative; display: flex; align-items: center; justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255,200,80,0.08), inset 0 -1px 0 rgba(0,0,0,0.3);
}
.item-slot.has-item { background: #3a2610; border-color: #c8901a; }
.item-slot.has-item:hover { background: #4a3218; border-color: #ffd060; box-shadow: inset 0 1px 0 rgba(255,220,100,0.25), 0 0 6px rgba(255,180,40,0.3); }
.item-amount { position: absolute; bottom: 3px; left: 5px; color: #ffe88a; }
.item-label  { position: absolute; bottom: 3px; right: 5px; color: #fff; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-name { display: none; }  /* 改用 title tooltip */
```

### 通用面板立體邊框（以基地核心為例，其他面板換色照抄結構）
```css
.base-core-panel {
  background: #0f1a0f;
  border: 4px solid #4caf50;
  border-radius: 10px;
  box-shadow:
    inset 0 0 0 2px #2a5a2a,
    0 0 0 2px #1a3a1a,
    0 8px 32px rgba(0,0,0,0.75),
    0 0 24px rgba(76,175,80,0.25);   /* 額外外光暈，核心/兵營有 */
  display: flex; flex-direction: column; overflow: hidden;
}
```

### 拖曳 ghost 與拖放狀態（!important 蓋掉 slot 既有樣式）
```css
.drag-ghost {
  position: fixed; width: 64px; height: 64px;
  background: rgba(255, 200, 60, 0.25); border: 2px solid #ffd060;
  border-radius: 8px; pointer-events: none; z-index: 200;
  font-size: 2.2rem; backdrop-filter: blur(2px);
}
.item-slot--dragging { opacity: 0.35; border-style: dashed !important; border-color: rgba(255,255,255,0.3) !important; }
.item-slot--dragover { border-color: #ffd060 !important; background: rgba(255, 200, 60, 0.18) !important; box-shadow: 0 0 10px rgba(255, 200, 60, 0.45) !important; }
```

### 自訂滾動條（webkit，多處共用此 4px 細條樣式）
```css
.craft-list-col::-webkit-scrollbar { width: 4px; }
.craft-list-col::-webkit-scrollbar-thumb { background: rgba(80,140,220,0.35); border-radius: 2px; }
/* research / building 列表同模式，僅換 thumb 顏色 */
```

### 關鍵動畫 keyframes
```css
@keyframes spin { to { transform: rotate(360deg); } }   /* reconnect-spinner 0.8s linear infinite */

@keyframes hintPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.75; } }  /* unlock-hint 2s */

@keyframes eatSlam {   /* 食物砸下 0.5s ease-in forwards */
  0%   { transform: translateY(-48px) rotate(-18deg) scale(1.3); opacity: 1; }
  55%  { transform: translateY(8px)  rotate(8deg)  scale(1.5); opacity: 1; }
  72%  { transform: translateY(-4px) rotate(-5deg) scale(0.92); opacity: 1; }
  86%  { transform: translateY(3px)  rotate(2deg)  scale(1.08); opacity: 0.8; }
  100% { transform: translateY(0px)  rotate(0deg)  scale(0.55); opacity: 0; }
}

@keyframes ui-toast-fade {   /* Toast 2.2s ease forwards，由螢幕上方滑入再淡出 */
  0%   { opacity: 0; transform: translate(-50%, -195px); }
  12%  { opacity: 1; transform: translate(-50%, -180px); }
  70%  { opacity: 1; transform: translate(-50%, -180px); }
  100% { opacity: 0; transform: translate(-50%, -168px); }
}
```

### 熔爐後段重構（覆蓋前面的 column 定義，改成 row 雙欄）
```css
/* 前段 .furnace-panel 是 flex-direction:column；後段這裡用 !important 改成 row */
.furnace-panel { flex-direction: row !important; padding: 0 !important; min-width: unset !important; max-height: 480px; }
.furnace-list-col { width: 180px; min-width: 180px; border-right: 2px solid #7a4e0a; overflow-y: auto; }
.furnace-detail-col { flex: 1; display: flex; flex-direction: column; min-width: 240px; }
.furnace-tabs { display: none !important; }  /* 舊 tab 列被左欄取代 */
```

## 重建提示
- **此檔是純 DOM/HTML UI 層**，與 PixiJS canvas（`#game-container canvas`，鋪滿 100%）完全分離。HUD/面板都浮在 canvas 之上。
- **class 與 UI 模組對應**：`#hud*` → HUD skill；`#hotbar` → Hotbar；`#side-dock` / `.dock-*` → Tab dock 說明面板；`#lobby` / `.lobby-*` / `.map-*` → LobbyScreen；`#inventory-ui` / `.item-grid` / `.item-slot` / `.drag-ghost` → 背包 InventoryUI；`#crafting-ui` / `.craft-*` → CraftingUI；`#furnace-ui` / `.furnace-*` → FurnaceUI；`#market-ui` / `.market-*` → MarketUI；`#research-ui` / `.research-*` → ResearchUI；`#bag-ui` / `.bag-*` → BagUI；`#base-core-ui` / `.bcu-*` → BaseCoreUI；`#barracks-ui` / `.barracks-*` → BarracksUI；`#demolish-panel` → 拆除確認；`.ui-toast` → UI Toast 回饋。
- **z-index 是疊放正確性的命脈**，務必照上面階層表。最常踩雷：Toast 必須 99999（蓋過所有面板）、`#research-ui` 異常地高（5000）、`#bag-ui` 與 `.drag-ghost` 同為 200（拖曳要浮在背包上）。多數面板停在 80。
- **置中 + 立體邊框是兩套可複用公式**：所有彈窗 `translate(-50%,-50%)` 置中；面板邊框用「`inset` 內描邊 + `0 0 0 2px` 外描邊 + 大投影」三層 box-shadow，換顏色即得不同面板。重建時抓一個照抄、改色票即可。
- **`#base-core-ui` 與 `#barracks-ui` 預設 `display:none`**（由 JS 切換成 flex）；其餘面板靠 JS 掛載/移除節點，CSS 不負責顯隱。
- **覆蓋順序重要**：`.furnace-panel` 在檔案前段是 column 版、後段又用 `!important` 改成 row 雙欄版；`.furnace-tabs` 同樣被後段 `display:none` 隱藏。重建時兩段都要保留且維持先後順序，否則熔爐版面會錯。`.crafting-panel` 的舊覆蓋已移除（註解保留說明）。
- **共用 base 元素**：頂層 `button` 有全域樣式（綠底圓角），各面板按鈕多半再覆蓋；`input[type="text"]` 也有全域樣式（綠框深底置中）。新增按鈕若不想要綠底，記得覆蓋 `background`。
- **RWD/resize**：版面靠 `position:fixed` + flex 置中自適應，無 media query。canvas 用 `resizeTo: window`（見 core/App）。面板用 `max-height: 70vh~80vh` + `overflow-y:auto` 防止小視窗溢出；Tab dock 用 `padding:40px` 留邊。
- **無 CSS 變數**：所有顏色硬編碼，改色票需逐處替換；重建時優先確保「同一面板內色票自洽」即可。
- **emoji 圖示**：`.hotbar-icon` / `.item-icon` / `.craft-row-icon` 等多為 emoji 字元（用 `font-size` 控制大小），少數用 `.item-icon-img`（`image-rendering: pixelated` 的點陣圖）。
