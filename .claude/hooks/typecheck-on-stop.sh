#!/usr/bin/env bash
# Stop hook — 收工時跑一次 TypeScript 型別檢查（不產生輸出檔）。
# 避免在型別還有錯誤時就「收工」。由 .claude/settings.json 的 Stop hook 引用。
set -uo pipefail

# 解析專案根目錄：優先用 Claude Code 提供的 CLAUDE_PROJECT_DIR，
# 否則從腳本位置推導（.claude/hooks/ 往上兩層 = repo 根）。
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

# 先抓 tsc 真正的結束碼，再截斷輸出顯示——
# 原本 inline 寫法 `tsc | head && echo ✅ || echo ⚠️` 看的是 head 的結束碼，
# 幾乎永遠為 0，導致有錯也誤報 ✅。這裡用獨立變數保留 tsc 的退出狀態。
output="$(npx tsc --noEmit 2>&1)"
status=$?

printf '%s\n' "$output" | head -40

if [ "$status" -eq 0 ]; then
  echo '✅ 型別檢查通過，可以安全收工'
else
  echo '⚠️  有型別錯誤，請修復後再收工'
fi
