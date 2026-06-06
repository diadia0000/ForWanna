# Forager MP — AGENTS.md（Codex 入口）

**Forager Multiplayer** — PixiJS 2D 像素風多人沙盒遊戲（PixiJS + PeerJS + Dexie, TypeScript）
📌 Repo：https://github.com/diadia0000/ForWanna · 預設開發 branch：`rebuildTest`

> 這份 `AGENTS.md` 是給 **Codex** 的入口檔。Codex 不會自動跟著連結爬子文檔，
> 所以關鍵規則已**直接內嵌**在下方。詳細內容仍保留在 `.claude/` 底下（見「文檔導航」）。
> 對應的 Claude Code 設定請見 `CLAUDE.md` 與 `.claude/`（兩套並存，互不覆蓋）。

---

## 🚫 絕對禁止事項（所有 agent 一律遵守）

- 🚫 **只能修改自己負責目錄內的檔案**，不得碰其他 `src/` 模組或刪除他人檔案。
- 🚫 **禁止修改 `src/types/index.ts`** — 只有 `event-architect` 可改（需共識）。
- 🚫 **禁止跨模組直接 `import` 並呼叫方法** — 一律透過 `EventBus`。唯一允許的跨模組
  直接 import 是 `@/core/EventBus` 與 `@/core/GameState`。
- 🚫 **禁止 `npm install` 任何不在 `package.json` 的套件**。
- 🚫 **禁止在 git commit message 出現「claude」**（隱私考量，用英文或中文描述）。
- 🚫 **禁止把測試圖片推到根目錄**（`*.png` 應在 `.gitignore`）。
- 🚫 **完成後只能勾選自己的【完成狀態】**，不可改動他人欄位。

## 🔄 模組通訊原則：EventBus only

```typescript
import { EventBus } from '@/core/EventBus'

EventBus.emit('resource:collected', { playerId, type: 'wood', amount: 3 })
EventBus.on('player:moved', ({ playerId, x, y }) => { /* ... */ })
EventBus.off('player:moved', handler)
```

- ❌ 不要 `import { Inventory } from '@/inventory'` 再直接呼叫 → 改 emit 事件。
- 事件命名：`module:action`（`resource:collected`）、`module:action:state`
  （`network:connected`）、UI 用 `ui:action`。
- **所有事件名稱必須先在 `.claude/claudemd/events.md` 定義**；要新增事件請先找
  `event-architect` review，不可自行發明。
- Listener 一律集中註冊在 `src/main.ts`（由 `integrator` 處理），不要寫在模組
  建構子裡。

---

## 🔧 模組 → 目錄 → 負責 subagent

| 模組 | 目錄 | Subagent |
|------|------|----------|
| Core Engine | `src/core/` | `core-engine` |
| Network | `src/network/` | `network-layer` |
| World / Map | `src/world/` | `world-map` |
| Player | `src/player/` | `player` |
| Resources | `src/resources/` | `resources` |
| Inventory + Crafting | `src/inventory/` | `inventory-crafting` |
| Building | `src/building/` | `building` |
| Save System | `src/save/` | `save-system` |
| UI / HUD | `src/ui/` | `ui-hud` |
| Combat | `src/combat/` | `combat` |
| Quest | `src/quest/` | `quest` |
| Render | `src/render/` | `render` |
| 整合（main.ts） | `src/main.ts` | `integrator` |
| 事件 / 共享型別 | `events.md` + `types/index.ts` | `event-architect` |
| 通用單模組工作 | 任一 `src/` 子目錄 | `module-owner` |
| 代碼審查（唯讀） | — | `code-reviewer` |

Subagent 定義在 **`.codex/agents/*.toml`**（由 `.claude/agents/*.md` 轉換而來）。

---

## 📖 文檔導航（詳細內容，需要時自行開啟）

| 用途 | 位置 |
|------|------|
| 完成功能清單、待辦優先度 | `.claude/claudemd/project-status.md` |
| 遊戲設計與玩法機制 | `.claude/claudemd/game-design.md` |
| 系統架構與模組概述 | `.claude/claudemd/architecture.md` |
| 事件名稱與通訊定義 | `.claude/claudemd/events.md` |
| 故障排查與 Bug 解決 | `.claude/claudemd/troubleshooting.md` |
| Agent 角色與職責 | `.claude/claudemd/agents.md` |
| 開發與禁止事項（完整版） | `.claude/rules/development-rules.md` |
| CodeGraph 使用指南 | `.claude/rules/codegraph-rules.md` |
| 專案進度記憶檔 | `.claude/AGENTS.md`（收工時更新） |

---

## 🎯 開工檢查清單

- [ ] `git status` — 確認分支為 `dev`
- [ ] 讀 `.claude/claudemd/project-status.md` — 瞭解進度與「尚未實作」section
- [ ] 讀對應 subagent（`.codex/agents/<module>.toml`）— 掌握自己負責的模組契約
- [ ] 收工時：把已完成功能/待辦/重要決策整理回 `.claude/AGENTS.md`，必要時 commit + push

## ✅ 提交前審查清單

- [ ] 只修改了自己負責目錄內的檔案
- [ ] 沒有跨模組直接 import（除了 `@/core/`）
- [ ] 所有跨模組通訊都用 EventBus，新事件已在 `events.md` 列舉
- [ ] 沒有新增未在 `package.json` 的依賴
- [ ] `npx tsc --noEmit` 通過，只修了自己的檔案
- [ ] Commit message 不含「claude」
