# Forager MP — 入口點

**Forager Multiplayer** — PixiJS 2D 多人沙盒遊戲  
📌 Repository：https://github.com/diadia0000/ForWanna · Branch：`dev`

---

## 📖 文檔導航

| 用途 | 位置 |
|------|------|
| **完成功能清單、待辦優先度** | [`.claude/claudemd/project-status.md`](../..%2F.claude/claudemd/project-status.md) |
| **遊戲設計與玩法機制** | [`.claude/claudemd/game-design.md`](../..%2F.claude/claudemd/game-design.md) |
| **系統架構與模組概述** | [`.claude/claudemd/architecture.md`](../..%2F.claude/claudemd/architecture.md) |
| **事件名稱與通訊定義** | [`.claude/claudemd/events.md`](../..%2F.claude/claudemd/events.md) |
| **故障排查與 Bug 解決** | [`.claude/claudemd/troubleshooting.md`](../..%2F.claude/claudemd/troubleshooting.md) |
| **Agent 角色與職責** | [`.claude/claudemd/agents.md`](../..%2F.claude/claudemd/agents.md) |

---

## ⚙️ 開發規則

- **[CodeGraph 使用指南](../..%2F.claude/rules/codegraph-rules.md)** — 搜尋符號、追蹤程式流程
- **[開發與禁止事項](../..%2F.claude/rules/development-rules.md)** — 模組邊界、EventBus 原則、代碼審查清單

---

## 🚀 首次設定（Onboarding，clone 後跑一次）

```bash
npm ci                              # 裝依賴
# 裝 codegraph CLI（用官方 install.sh，需讓 `codegraph` 在 PATH 上；驗證：codegraph -V）
codegraph init -i                   # 建本機程式碼索引（.codegraph/ 已 gitignore）
bash scripts/setup-hooks.sh         # 啟用共用 git pre-push hook（push 前跑 tsc）
```

- **CodeGraph MCP** 已寫進 `.mcp.json`，Claude Code 會自動載入（`.claude/settings.json` 開了 `enableAllProjectMcpServers`）。索引是 per-machine，需先裝好 `codegraph` CLI 再各自 `codegraph init`。
- **權限白名單 / Stop 型別檢查 hook** 已在 `.claude/settings.json`（共用），個人額外規則放各自的 `.claude/settings.local.json`。
- **CI**：PR 進 `dev`/`main` 會自動跑 `tsc --noEmit && npm test`（`.github/workflows/ci.yml`）。

---

## 🔧 模組對應

| 模組 | 檔案 | 職責 |
|------|------|------|
| Core Engine | [`.claude/agents/core-engine.md`](../..%2F.claude/agents/core-engine.md) | GameLoop、事件系統、主程式入口 |
| Network | [`.claude/agents/network-layer.md`](../..%2F.claude/agents/network-layer.md) | PeerJS、Host/Client 同步 |
| Inventory+Crafting | [`.claude/agents/inventory-crafting.md`](../..%2F.claude/agents/inventory-crafting.md) | 背包、合成系統 |
| Building | [`.claude/agents/building.md`](../..%2F.claude/agents/building.md) | 建築放置、血量、升級 |
| Combat | [`.claude/agents/combat.md`](../..%2F.claude/agents/combat.md) | 怪物、武器、傷害系統 |
| Render | [`.claude/agents/render.md`](../..%2F.claude/agents/render.md) | PixiJS 繪製 |
| 其他 | [`.claude/agents/`](../..%2F.claude/agents/) | Player / Quest / Integrator / Event Architect |

---

## 🎯 快速查看

### 開工檢查清單
- [ ] `git status` — 確認分支為 `dev`
- [ ] 讀 [project-status.md](../..%2F.claude/claudemd/project-status.md) — 瞭解目前進度
- [ ] 讀對應的 Agent 檔案 — 掌握自己負責的模組

### 🔴 高優先度（今日焦點）
見 [project-status.md](../..%2F.claude/claudemd/project-status.md) 的「尚未實作」section
