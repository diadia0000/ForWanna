#!/usr/bin/env bash
# Stop hook — 收工時跑型別檢查 + 測試（對齊 CI 的 tsc --noEmit && npm test）。
# 避免在型別或測試還有問題時就「收工」。由 .codex/hooks.json 的 Stop hook 引用。
set -uo pipefail

# 解析專案根目錄：從腳本位置推導（.codex/hooks/ 往上兩層 = repo 根）。
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR" || exit 0

# 先抓 tsc 真正的結束碼，再截斷輸出顯示——
# 原本 inline 寫法 `tsc | head && echo ✅ || echo ⚠️` 看的是 head 的結束碼，
# 幾乎永遠為 0，導致有錯也誤報 ✅。這裡用獨立變數保留 tsc 的退出狀態。
output="$(npx tsc --noEmit 2>&1)"
status=$?

printf '%s\n' "$output" | head -40

if [ "$status" -eq 0 ]; then
  echo '✅ 型別檢查通過'
else
  echo '⚠️  有型別錯誤，請修復後再收工'
fi

# 第二關：跑一次測試（vitest run，對齊 CI）。同樣只回報、不阻擋。
echo '— 執行測試 (npm test) —'
test_output="$(npm test --silent 2>&1)"
test_status=$?

printf '%s\n' "$test_output" | tail -25

if [ "$test_status" -eq 0 ]; then
  echo '✅ 測試通過，可以安全收工'
else
  echo '⚠️  測試未通過，請檢查後再收工'
fi
