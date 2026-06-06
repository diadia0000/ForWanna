# Agent Team / Sub-agent / Skills 套件

## Codex CLI（比賽主力）

- [openai/codex](https://github.com/openai/codex) — OpenAI Codex CLI，支援 AGENTS.md 角色定義、平行 task、shell 執行

## Agent 協作框架

- [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) — 角色制 agent team，Process 支援 parallel/sequential，最接近我們 Agent 1–10 架構
- [microsoft/autogen](https://github.com/microsoft/autogen) — 微軟多 agent 對話框架，支援 code execution loop
- [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) — 狀態機式 agent 編排，適合有依賴順序的 task graph
- [BerriAI/litellm](https://github.com/BerriAI/litellm) — 統一 Claude / GPT / Gemini API 呼叫，混用模型時必備

## 預製 Skills / Tools

- [langchain-ai/langchain](https://github.com/langchain-ai/langchain) — 大量預製 tools（shell、file、web search）可直接掛到 agent
- [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) — skill/plugin 系統，TypeScript 支援

## 一鍵從 spec 生成 code（參考）

- [AntonOsika/gpt-engineer](https://github.com/AntonOsika/gpt-engineer) — 給 spec → 生整個 app
- [smol-ai/developer](https://github.com/smol-ai/developer) — 輕量版 spec-to-code，單一 agent

## Claude Code 專用

- [anthropics/anthropic-quickstarts](https://github.com/anthropics/anthropic-quickstarts) — Claude agent 範例（computer-use、customer-support）
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) — GitHub Actions 內跑 Claude Code，CI 自動修 PR
