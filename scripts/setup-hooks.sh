#!/usr/bin/env bash
# 一次性設定：把 git hooks 指到版本控管的 .githooks/ 目錄。
# 新人 clone 完跑一次即可（git hooks 不會跟著 repo 自動安裝）：
#   bash scripts/setup-hooks.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "✅ 已啟用共用 git hooks（core.hooksPath = .githooks）"
echo "   現有：pre-push → push 前跑 tsc --noEmit"
