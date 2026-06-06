---
name: building
description: 建築模組總綱：放置合法性驗證、世界狀態寫入、建築 HP/傷害/修復/升級生命週期、陷阱與塔、建造計時。重建任何「建築放置、碰撞、血量、升級、拆除」邏輯先看這份，再按需展開同目錄 reference 子檔。
---

# building 模組總綱

本檔是 `src/building/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`building/index`](./index/reference.md) — building/index.ts 是模組的對外入口，宣告哪些符號可被外部 import；重建時確認模組邊界、決定要不要把新 export 加進來時參考這裡。
- [`building/BuildingPlacer`](./BuildingPlacer/reference.md) — BuildingPlacer 實作滑鼠跟隨的幽靈預覽（ghost）與點擊放置建築的互動邏輯；重建時凡涉及「建築放置前端互動、顏色回饋、游標切換」都參考這裡。
- [`building/BuildingSystem`](./BuildingSystem/reference.md) — BuildingSystem 是建築模組的核心引擎，負責放置合法性驗證、世界狀態寫入、PixiJS 渲染、傷害/修復/升級生命週期；重建時所有「建築放置、碰撞、血量、升級、拆除」邏輯都參考這裡。
- [`building/data/buildings`](./data/buildings/reference.md) — buildings.ts 定義所有建築的靜態設定（材料成本、尺寸、效果文字）、陷阱維修成本與升級配置表；重建時凡需要「知道有哪些建築、建築成本、升級材料、陷阱修復費用」都參考這裡。
