---
name: save
description: 存檔模組總綱：Dexie(IndexedDB) 持久化、世界/玩家存讀、匯入/匯出同步協定、GameDB schema。重建存讀檔與序列化先看這份，再按需展開 reference 子檔。
---

# save 模組總綱

本檔是 `src/save/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`save/index`](./index/reference.md) — Public re-export barrel for the save module — look here to confirm what the module exposes and how to import it.
- [`save/GameDB`](./GameDB/reference.md) — Dexie/IndexedDB schema definition — look here when rebuilding the database tables, version, primary keys, and indexes.
- [`save/SaveManager`](./SaveManager/reference.md) — World and player persistence logic — look here for save/load flow, auto-save timer, event integration, and the save:request → save:complete contract.
- [`save/SyncProtocol`](./SyncProtocol/reference.md) — Player data serialization and new-player factory — look here for the JSON wire format, client-join handshake data, and the createNewPlayer defaults including researchLevel.
