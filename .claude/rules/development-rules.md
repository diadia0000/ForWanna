# 開發規則和禁止事項

## 絕對禁止事項（所有 Agent 遵守）

- 🚫 **禁止修改自己負責目錄以外的任何檔案**
- 🚫 **禁止修改 `src/types/index.ts`**（只有架構師可以，需共識）
- 🚫 **禁止在模組間直接 import 並呼叫方法**，一律透過 EventBus
- 🚫 **禁止自行 `npm install` 任何未在 `package.json` 裡的套件**
- 🚫 **禁止刪除任何其他 Agent 的檔案或資料夾**
- 🚫 **禁止在 git commit message 中寫「claude」**（隱私考量，改為英文或中文描述）
- 🚫 **禁止在根目錄推送測試圖片**（test/*.png 應在 .gitignore）
- 🚫 **完成後只能在自己的【完成狀態】欄位打勾**，不可改動他人欄位

---

## ✅ CodeGraph 強制原則

**詳見 `.claude/rules/codegraph-rules.md`** — 每次寫代碼前必須先用 CodeGraph 查詢，流程：查詢 → 讀檔 → 編輯。

---

## 模組通訊原則

### ✅ 正確做法：EventBus 事件驅動

所有跨模組通訊一律透過 `EventBus`：

```typescript
import { EventBus } from '@/core/EventBus'

// 發送事件
EventBus.emit('resource:collected', { 
  playerId, 
  type: 'wood', 
  amount: 3 
})

// 監聽事件
EventBus.on('player:moved', ({ playerId, x, y }) => {
  console.log(`Player ${playerId} moved to (${x}, ${y})`)
})

// 取消監聽
EventBus.off('player:moved', handler)
```

### ❌ 錯誤做法：直接 import + 呼叫

```typescript
// 禁止！
import { Inventory } from '@/inventory'
Inventory.add(playerId, 'wood', 1)  // ❌

// 應該改成：
EventBus.emit('inventory:add', { playerId, itemId: 'wood', amount: 1 })
```

---

## 事件命名約定

| 格式 | 範例 | 用途 |
|------|------|------|
| `module:action` | `resource:collected` | 基本事件 |
| `module:action:state` | `network:connected` | 狀態變化 |
| `ui:action` | `ui:open_inventory` | UI 操作 |

所有事件名稱必須在 `claudemd/events.md` 中定義，新增前需 review。

---

## 檔案修改邊界

### Core 層（允許直接 import）

各 Agent 可以 import `src/core/` 的內容（EventBus、App、GameLoop、GameState），無需透過事件。

### 其他層（禁止直接 import）

- Inventory 層的 Inventory 不能直接被 Building 層 import
- 應改為：`EventBus.emit('inventory:changed', { ... })`

---

## 代碼審查檢查清單

提交 PR 時，務必檢查：

- [ ] **遵循 CodeGraph 強制原則**（見 `codegraph-rules.md`）
- [ ] 只修改了自己負責目錄內的檔案
- [ ] 沒有直接 import 其他模組（除了 `src/core/`）
- [ ] 所有跨模組通訊都用 EventBus
- [ ] 沒有新增未在 package.json 的依賴
- [ ] 新增的事件已在 `events.md` 列舉
- [ ] Commit message 不含「claude」
- [ ] 只修改了自己的【完成狀態】

---

## 多人協作建議

### 同步檔案修改衝突

如果兩個 Agent 在同一檔案上有改動（例如 `main.ts`）：
1. Agent 10（整合者）統一處理 `src/main.ts`
2. 其他 Agent 提供「初始化代碼片段」給 Agent 10，由 Agent 10 整合

### 大型功能的協調

如果新功能涉及多個模組（例如「熔爐真正扣背包」）：
1. 開一個 GitHub Discussion 說明需求
2. 各相關 Agent 討論事件設計
3. 統一 EventBus 事件，然後各自實作

### 版本管理

- 主分支：`main`（穩定版本）
- 開發分支：`dev`（日常開發）
- 功能分支：`feature/xxx`（大型功能）
