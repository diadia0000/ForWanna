---
name: resources
description: 資源模組總綱：可採集資源節點（樹/石/礦）、生成器、資源 HP/工具效率/重生設定。重建資源採集、節點調校、生成先看這份，再按需展開 reference 子檔。
---

# resources 模組總綱

本檔是 `src/resources/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`resources/index`](./index/reference.md) — resources 模組的公開出口檔，重建時第一個建立它來確認模組對外暴露的 API 邊界是否正確。
- [`resources/ResourceNode`](./ResourceNode/reference.md) — 資源節點的 PixiJS 視覺實體類別，實作精靈建構、受擊特效、HP 條、respawn 動畫，重建時參考它來還原所有節點的渲染與互動行為。
- [`resources/Spawner`](./Spawner/reference.md) — 資源節點的生命週期管理器，處理批量生成、耗盡後 respawn 排程、Client 端 delta 同步，重建時參考它來還原 Host/Client 非對稱架構下資源的完整流轉。
- [`resources/resourceConfig`](./resourceConfig/reference.md) — 所有資源類型的平衡數值表（HP、掉落物、respawn 秒數），重建時必須先填這張表才能讓採集系統正確計算傷害與產出。
- [`resources/spawnConfig`](./spawnConfig/reference.md) — 資源生成規則表與加權隨機選取工具，重建時參考它來正確復現「哪個環形、哪種地塊可生成哪類資源」的生態分布邏輯。
