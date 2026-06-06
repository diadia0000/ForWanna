# 比賽開始 — 前 5 分鐘 SOP

比賽 10:30 鳴槍，目標 10:35 前 Codex 已就緒、第一個 prompt 送出。

---

## Step 1 — 環境確認（2 min）

```bash
# 1. 確認 Node + npm
node -v   # 需 >= 18
npm -v

# 2. 安裝依賴（若是 fresh clone）
npm ci

# 3. 啟動本地 PeerJS 信令伺服器（多人連線必須）
npm run peer
# 確認輸出包含 "Started PeerServer on port 9000"

# 4. 啟動 dev server（另一個 terminal）
npm run dev
# 確認 http://localhost:5175 可開啟遊戲

# 5. TypeScript 型別檢查（Codex 產的 code 不能爆這個）
npx tsc --noEmit
# 應為 0 errors 才能繼續
```

> ⚠️ 若 `npm run peer` 失敗：確認 `package.json` 有 `"peer": "peerjs --port 9000"` 腳本

---

## Step 2 — Codex 初始化（1 min）

開啟 Codex，貼入 **Prompt 00**（見 `PROMPT_SEQUENCE.md` 的 `## Prompt 00` 段落）。

這個 prompt 把整個架構、禁止規則、EventBus schema 一次餵給 Codex，後續所有 prompt 都不需要重新解釋。

---

## Step 3 — 確認 Codex 已理解（30 sec）

貼完 Prompt 00 後，問 Codex：

> "Which module owns the crafting sync? What EventBus event should be emitted when a client crafts an item?"

預期回答：`inventory-crafting` 模組，事件 `craft:request`（Host 驗證）→ `craft:success` 廣播。

若回答不對，重貼 Prompt 00 或補充 `CONTRACTS.md` 的相關段落。

---

## Step 4 — 開始第一個 Feature（2 min）

按 `PROMPT_SEQUENCE.md` 的順序，貼 **Prompt 01**（多人製作同步）。

```
建議工作節奏：
10:30 - 10:35  環境確認 + Codex 初始化
10:35 - 11:05  Prompt 01（多人製作同步，~30 min）
11:05 - 11:10  Review + tsc 驗證
11:10 - 11:50  Prompt 02（遺跡多人同步，~40 min）
11:50 - 12:00  Buffer / 測試
12:00 - 12:30  Lunch
12:30 - 13:00  Prompt 03（建築破損同步）
13:00 - 13:30  Prompt 04（士兵同步 or 裝備同步）
13:30 - 14:30  Prompt 05（視覺效果）
14:30 - 15:00  Buffer + polish + bug fix
15:00 - 15:30  Demo 準備（不要加新功能！）
15:30 - 16:00  Demo Round
```

---

## 常見緊急狀況

| 問題 | 解法 |
|------|------|
| Codex 產出 code 無法編譯 | 貼 tsc 錯誤訊息給 Codex，說「fix these TypeScript errors」 |
| Codex 直接 import 其他模組 | 告訴它「use EventBus instead of direct import」，指向 CONTRACTS.md |
| 多人不同步 | 先確認 Host 端有 emit，Client 端有 listen；用 DevTools console 驗證事件 |
| PeerJS 連不上 | 確認 `npm run peer` 在跑；確認連線 `localhost:9000` 不是公共 server |
| dev server 吃舊 code | `pkill -f vite && npm run dev`；確認 `src/` 下沒有 `.js` 殘留 |

---

## 快速 Codex 指令 cheatsheet

```
# 查某個模組在哪
"Which file handles [feature]?"

# 讓 Codex 只改特定檔案
"Only edit src/inventory/CraftingSystem.ts and src/main.ts"

# 讓 Codex 用 EventBus
"Use EventBus.emit/on from src/core/EventBus.ts, do NOT directly import other modules"

# 讓 Codex 跑驗收
"After implementing, tell me what console.log I should see when a client crafts an item"
```
