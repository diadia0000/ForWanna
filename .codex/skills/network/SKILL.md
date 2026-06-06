---
name: network
description: 網路層總綱：PeerJS Host/Client 同步、房間管理、訊息型別、state_full/state_delta。重建多人連線、房間建立/加入、主從權威同步先看這份，再按需展開 reference 子檔。
---

# network 模組總綱

本檔是 `src/network/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`network/index`](./index/reference.md) — network 模組的公開入口，重建時先建這個檔案確認三大類別都正確 re-export，任何模組想用 RoomManager / NetworkHost / NetworkClient 都從這裡引。
- [`network/MessageTypes`](./MessageTypes/reference.md) — 網路訊息型別的轉接層，重建時用來確認 network 模組內部引用型別的正確來源——所有 NetMessage / PlayerInput / StateDelta / PlayerId 都從這裡取，不要讓 network/*.ts 直接 import @/types。
- [`network/NetworkClient`](./NetworkClient/reference.md) — Client 端 PeerJS 連線實作，重建時參考它處理「加入房間後收 state_full、持續收 state_delta、心跳保活、斷線清理」的完整流程——每個細節都有時序與邊界條件。
- [`network/NetworkHost`](./NetworkHost/reference.md) — Host 端 PeerJS 連線管理，重建時參考它處理「多客戶端接入、stableId 重連去重、心跳掃描踢人、玩家 sprite 輪派、廣播/單播/排除廣播」等 Host 權威模型的核心邏輯。
- [`network/RoomManager`](./RoomManager/reference.md) — PeerJS 房間的建立與加入入口，重建時參考它設定 Peer 物件、連接信令伺服器、產生6字元房號、處理信令斷線自動重連與 window CustomEvent 通知——這是整個網路層的啟動點。
