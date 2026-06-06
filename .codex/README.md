# .codex — Codex 設定（從 .claude 轉換而來）

這個資料夾是把專案原本的 **Claude Code 設定（`.claude/` + `CLAUDE.md`）轉成
Codex 格式**的結果。採「並存」策略：`.claude/` 原封不動保留，兩套工具鏈都能用。

## 內容

| 檔案 | 來源 | 說明 |
|------|------|------|
| `config.toml` | 新增 | 專案級設定 — 啟用 hooks 功能 |
| `config.toml.example` | 範例 | 全域設定模板，複製到 `~/.codex/config.toml` 使用 |
| `hooks.json` | 新增 | 宣告 SessionStop hook（typecheck） |
| `hooks/typecheck-on-stop.sh` | 新增 | 收工時跑 `npx tsc --noEmit` |
| `agents/*.toml` | `.claude/agents/*.md` | 22 個 agent（含 orchestrator + code-reviewer）。Markdown+YAML frontmatter → 純 TOML |
| `agents/orchestrator.toml` | 新增 | 比賽總指揮 agent：任務分派、時間管理、subagent 路由 |
| `CONTRACTS.md` | 新增 | 480 行架構合約：TypeScript types、EventBus schema、模組邊界、22 個 gotcha、init 順序 |
| `../AGENTS.md` | `CLAUDE.md` + 開發規則 | Codex 入口檔。關鍵規則內嵌（Codex 不爬連結） |

## 轉換對照（Claude → Codex）

| Claude | Codex |
|--------|-------|
| `CLAUDE.md` | 根目錄 `AGENTS.md` |
| `.claude/agents/*.md`（frontmatter + Markdown） | `.codex/agents/*.toml`（純 TOML） |
| frontmatter `name` / `description` | TOML `name` / `description` |
| 內文（Markdown body） | `developer_instructions = '''...'''` |
| `tools: Read, Edit, ...` | ❌ 無逐工具白名單 → 用 `sandbox_mode`（唯讀的 `code-reviewer` = `read-only`） |
| `model: opus / sonnet` | `model_reasoning_effort = "high" / "medium"`（模型省略則繼承父層） |
| `.claude/settings.json` | `~/.codex/config.toml`（TOML） |
| `.mcp.json` / `mcpServers` | `config.toml` 的 `[mcp_servers.*]` |
| hooks 在 `settings.json` | `hooks.json` + `config.toml [features] hooks = true` |

## Hooks

`.codex/hooks.json` 宣告了以下 hook：

| Event | 腳本 | 用途 |
|---|---|---|
| `SessionStop` | `hooks/typecheck-on-stop.sh` | 收工時跑 `npx tsc --noEmit`，有型別錯誤則警告 |

## 使用方式

```bash
# 1. 全域設定 + MCP：把範例填好後放到 home
mkdir -p ~/.codex && cp .codex/config.toml.example ~/.codex/config.toml
#   ↑ 編輯 ~/.codex/config.toml，填入 codegraph MCP 的實際啟動指令

# 2. subagents：repo 內的 .codex/agents/*.toml 會被 Codex 讀取
#    互動時用 codex CLI 依 agent 名稱（如 combat、code-reviewer）分派

# 3. AGENTS.md 在根目錄會被 Codex 自動當作專案指示讀取

# 4. hooks：.codex/config.toml 已啟用 [features] hooks = true，
#    .codex/hooks.json 已宣告 SessionStop hook，不需額外設定
```

## 注意

- 詳細文檔（architecture / events / game-design / project-status / troubleshooting）
  仍在 `.claude/claudemd/`，Codex 不會自動讀，需要時手動開或在 prompt 指路徑。
- 架構合約已內嵌在 `.codex/CONTRACTS.md`（480 行），Codex 可讀。
- `.claude/AGENTS.md` 是「專案進度記憶檔」（用途與根目錄 `AGENTS.md` 不同），
  維持原樣作為收工記錄。
