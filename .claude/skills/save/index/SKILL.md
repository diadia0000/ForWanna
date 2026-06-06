---
name: save-index
description: Public re-export barrel for the save module — look here to confirm what the module exposes and how to import it.
---

# save/index.ts

> 模組：save｜角色：模組出口定義，統一 re-export 供外部使用的公開符號

## 公開 API

```typescript
export { SaveManager } from './SaveManager'
export { SyncProtocol } from './SyncProtocol'
export { db } from './GameDB'
```

三個導出：

- `SaveManager` — 存檔管理單例（class instance）
- `SyncProtocol` — 玩家資料序列化 static class
- `db` — Dexie GameDB 全域單例（供有需要直接存取 DB 的場景使用，一般優先用 SaveManager）

## 核心邏輯

此檔案僅為 barrel export，無業務邏輯。完整代碼如上。

## EventBus 互動

（無）

## 依賴

- `./SaveManager`
- `./SyncProtocol`
- `./GameDB`

## 重建提示

- 外部模組應從 `@/save`（或相對路徑 `../save`）import，而非直接 import 子檔案，確保模組邊界清晰。
- `db` 直接暴露主要是為了測試（`persistence.regression.test.ts` 直接存取 db）；業務代碼應優先透過 `SaveManager` 而非直接操作 `db`。
- 此 barrel 不導出 `GameDB` class 本身（僅導出實例 `db`），外部無法繼承或重新實例化。
