---
name: vite-config
description: Vite 建置設定（vite.config.ts）的重建規格。涵蓋 @ → src 路徑別名、dev server port 5175 與 no-cache header、es2022 build target。重建專案建置設定、設定路徑別名、調整 dev server、或排查「@/ import 找不到模組 / build target 過舊」時參考這份。也附上 tsconfig.json 必須對齊的 paths 別名與 .env 鍵值。
---

# vite.config.ts

> 模組：build｜角色：Vite 建置 + dev server 設定。專案唯一的建置進入點設定，定義 `@` 路徑別名（全專案 import 都靠它）、dev server port、build target。

## 完整內容（照抄即可還原）

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5175,
    host: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  build: {
    target: 'es2022',
  },
})
```

## 重建提示

- **`@` 別名**：`@` → `<root>/src`。全專案的 import 幾乎都是 `@/core/...`、`@/types`、`@/render` 這種寫法 → 沒有這個別名，dev / build 全部找不到模組。
- **port 5175 + `host: true`**：固定 port 方便 demo；`host: true` 讓區網其他裝置可連（多人 demo 用）。
- **no-cache header**：dev 時強制不快取，避免改了沒更新。正式 build 不影響。
- **`build.target: 'es2022'`**：程式碼用到較新語法（如頂層 `??`、`?.`、`Array.at` 等），target 太舊 build 會出錯。

## ⚠️ 必須同步對齊的兩個外部設定

`vite.config.ts` 本身不夠，以下兩處的值必須一致，否則 `npm run build`（= `tsc && vite build`）或多人連線會掛：

### 1. `tsconfig.json` 的 paths 別名（給 tsc 型別檢查用）

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }   // ← 必須和 vite alias 一致
    // ...（target ES2022 / module ESNext / moduleResolution bundler / strict / noEmit）
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

> 只設 vite alias、漏設 tsconfig paths → `vite dev` 跑得動，但 `tsc`（build / typecheck）會在每個 `@/` import 報錯。

### 2. `.env`（多人連線用，PeerJS 信令伺服器位址）

```
VITE_PEER_HOST=<peer-server host>
VITE_PEER_PORT=<port>
VITE_PEER_SECURE=<true|false>
```

- 連共用 Railway：`forager-peer-production.up.railway.app` / `443` / `true`（此網址無法被推斷，要直接帶）。
- 本地自架（帶了 `peer-server/` 時）：`localhost` / `9000` / `false`，另跑 `npm run peer`。
