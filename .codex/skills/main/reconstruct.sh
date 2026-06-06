#!/usr/bin/env bash
# ============================================================
# main.ts 重建驗證腳本（可執行文件）
# ------------------------------------------------------------
# 用途：在「現場重建」src/main.ts 後，用這支腳本檢查整合層
#       是否完整、能否編譯、所有模組 import 是否對得上。
#
# 用法：
#   bash .claude/skills/main/reconstruct.sh          # 印出重建檢查清單
#   bash .claude/skills/main/reconstruct.sh --verify # 跑 tsc / build / test 驗證
# ============================================================
set -uo pipefail

# 定位專案根（本腳本位於 <root>/.claude/skills/main/）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MAIN="$ROOT/src/main.ts"

cyan(){ printf "\033[36m%s\033[0m\n" "$1"; }
green(){ printf "\033[32m%s\033[0m\n" "$1"; }
red(){ printf "\033[31m%s\033[0m\n" "$1"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$1"; }

cyan "================ main.ts 重建檢查清單 ================"
cat <<'EOF'
重建順序（由底層往上）：
  1. types/index.ts           ← 型別契約，最先且要完整
  2. 各模組（core/network/world/player/resources/treasure/inventory/
     building/save/ui/render/combat/dungeon/quest）
  3. style.css
  4. locales/(zh-TW|en)
  5. main.ts                  ← 最後收口（本檔）

main.ts 內部重建順序（對照 reference_01～05）：
  [reference_01] initI18n → createApp → loadGameAssets → GameLoop.start
                 → 相機/圖層堆疊 → 視窗同步/鎖縮放/斷線層 → 系統實例化
                 → 全域狀態與常數 → 地圖/小地圖 → 遺跡 → 手榴彈/士兵/特效
  [reference_02] 全部 UI 實例化與接線 → 拆除面板/Toast → 背包暫存
                 → 放置模式 → 掉落物 → 碰撞 → 玩家升級/重生/死亡
  [reference_03] 互動偵測/瞄準/提示 → 採集/攻擊判定 → 滑鼠 pointer
                 → 市場/研究/基地/兵營回呼 → 鍵盤輸入 → Host 端動作
  [reference_04] EventBus 串連 → 主迴圈每幀子系統
  [reference_05] 難度 Modal → startGame → 存檔還原 → 網路事件 → bootstrap()

務必檢查：
  □ 圖層共用：resource/building/playerLayer 都是同一個 objectsLayer
  □ objectsLayer.sortableChildren = true（2.5D 遮擋）
  □ CAMERA_ZOOM = 1.5，camera 容器負責跟隨
  □ DayNight 掛 app.stage（螢幕座標），不進 camera
  □ 按鍵用 e.code（KeyW/KeyE…），分 keydown/keyup
  □ Host-only 子系統未在 Client 端重複結算
  □ 所有全域 let/const 狀態在 helper 之前宣告
  □ 檔案最後一行是 bootstrap()
  □ 不要 import GameController.ts（dead code，不在整合圖內）
EOF

echo
if [[ "${1:-}" != "--verify" ]]; then
  yellow "（加上 --verify 可實際跑 tsc / build / test 驗證）"
  exit 0
fi

cyan "================ 驗證 main.ts 是否存在 ================"
if [[ ! -f "$MAIN" ]]; then
  red "✗ 找不到 $MAIN —— 尚未重建。"
  exit 1
fi
LINES=$(wc -l < "$MAIN")
green "✓ src/main.ts 存在（$LINES 行）"

cyan "================ 關鍵錨點檢查（grep） ================"
fail=0
check(){ # $1=pattern $2=說明
  if grep -qE "$1" "$MAIN"; then green "  ✓ $2"; else red "  ✗ 缺少：$2（pattern: $1）"; fail=1; fi
}
check "async function bootstrap"                  "bootstrap() 進入點"
check "^bootstrap\(\)"                            "檔尾呼叫 bootstrap()"
check "await initI18n"                            "initI18n 初始化"
check "await createApp"                           "createApp 建立 PixiJS app"
check "loadGameAssets"                            "loadGameAssets 載素材"
check "GameLoop.start"                            "GameLoop.start 啟動 ticker"
check "CAMERA_ZOOM"                               "相機縮放常數"
check "sortableChildren = true"                   "objectsLayer Y 排序"
check "RoomManager.role"                          "Host/Client 權威判定"
check "e\.code === 'KeyE'"                        "E 主互動鍵"
check "addEventListener\('keydown'"               "鍵盤輸入"
check "app.canvas.addEventListener\('pointerdown" "滑鼠 pointerdown"
check "EventBus.on\("                             "EventBus 串連"
check "function startGame"                        "startGame 主流程"

cyan "================ 編譯 / 測試驗證 ================"
cd "$ROOT" || exit 1
if command -v npx >/dev/null 2>&1; then
  echo "→ tsc --noEmit"
  npx tsc --noEmit && green "  ✓ TypeScript 型別檢查通過" || { red "  ✗ tsc 失敗"; fail=1; }
  echo "→ npm run build"
  npm run build && green "  ✓ build 成功" || { red "  ✗ build 失敗"; fail=1; }
  echo "→ npm test"
  npm test && green "  ✓ 測試通過" || yellow "  ⚠ 測試未全通過（檢查是否與 main 無關）"
else
  yellow "  ⚠ 找不到 npx，略過編譯驗證"
fi

echo
if [[ "$fail" == "0" ]]; then green "🎉 main.ts 重建驗證通過"; else red "⚠ 仍有缺漏，請對照 reference_01～05 補齊"; fi
exit "$fail"
