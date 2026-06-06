---
name: locales
description: 多語系字串總綱：zh-TW 與 en 翻譯字串（22 namespace）。新增或對齊翻譯鍵、語言切換字串先看這份，再按需展開 reference 子檔。
---

# locales 模組總綱

本檔是 `src/locales/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`locales/index`](./index/reference.md) — locales 的組裝結構——根 barrel（src/locales/index.ts，定義支援語系/loader/標籤）與各語系 index.ts（把 22 個 namespace 組成單一 default export）。重建語系載入入口、新增語系、調整 namespace 匯入清單與順序時參考這份。
- [`locales/en`](./en/reference.md) — en（English）語系的完整翻譯字串資料，逐檔涵蓋全部 22 個 namespace 的實際 key/value。重建 i18n 英文字串、新增或對照翻譯、確保中英 key 對齊時，直接照這份還原 src/locales/en/ 整個目錄。
- [`locales/zh-TW`](./zh-TW/reference.md) — zh-TW（繁體中文）語系的完整翻譯字串資料，逐檔涵蓋全部 22 個 namespace 的實際 key/value。重建 i18n 繁中字串、新增或對照翻譯、確保中英 key 對齊時，直接照這份還原 src/locales/zh-TW/ 整個目錄。
