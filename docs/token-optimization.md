# Token 優化 & 平行運作工具

## Prompt 壓縮（送進去前先壓）

- [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) — 最高 20x 壓縮率，保留語義，適合壓 CLAUDE.md / spec 文件再餵給 agent
- [microsoft/LLMLingua-2](https://github.com/microsoft/LLMLingua-2) — 更快的版本，適合 latency 敏感場景

## Semantic Cache（相同查詢不重送）

- [zilliztech/GPTCache](https://github.com/zilliztech/GPTCache) — LLM 語義快取，相似 prompt 直接回快取，省掉重複 agent call
- [BerriAI/litellm](https://github.com/BerriAI/litellm) — 內建 Redis / local cache，統一 API 層順便攔截重複請求

## Smart Memory（每個 agent 只拿自己需要的 context）

- [mem0ai/mem0](https://github.com/mem0ai/mem0) — 向量化記憶體，agent 查詢時只取相關片段，不用傳整份 state
- [lancedb/lancedb](https://github.com/lancedb/lancedb) — 嵌入式向量 DB，zero-server，適合本地比賽環境

## 平行調度（讓多 agent 不互等）

- [ray-project/ray](https://github.com/ray-project/ray) — 分散式 task 調度，Python agent 平行化首選
- [PrefectHQ/prefect](https://github.com/PrefectHQ/prefect) — task flow 編排，支援 concurrent map，適合 agent pipeline

## Anthropic 原生功能（不需套件）

- [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — system prompt / 長文件加 `cache_control`，重複呼叫省 90% token
- [Batch API](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — 非同步批次送出，比即時 API 省 50% 費用
