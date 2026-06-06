---
name: network-index
description: network 模組的公開入口，重建時先建這個檔案確認三大類別都正確 re-export，任何模組想用 RoomManager / NetworkHost / NetworkClient 都從這裡引。
---

# network/index.ts

> 模組：network｜角色：barrel file，集中 re-export 網路層三個主要 singleton，讓外部只需 `import { ... } from '@/network'`

## 公開 API

- `RoomManager` — re-export 自 `./RoomManager`，房間建立/加入的入口
- `NetworkHost` — re-export 自 `./NetworkHost`，Host 端廣播/點對點發送
- `NetworkClient` — re-export 自 `./NetworkClient`，Client 端送訊息給 Host

## 核心邏輯

純 barrel。三行 named re-export，無任何執行期邏輯、無副作用。

```typescript
export { RoomManager } from './RoomManager'
export { NetworkHost } from './NetworkHost'
export { NetworkClient } from './NetworkClient'
```

注意：`RoomRole` type 不在此 re-export，使用方若需要直接從 `'@/network/RoomManager'` 取 type。

## EventBus 互動

無

## 訊息協定（若適用）

無

## 依賴

- `./RoomManager`
- `./NetworkHost`
- `./NetworkClient`

## 重建提示

- 最後建，等其他三個主要類別都實作完再寫這個。
- 只 re-export，不要把 `RoomRole` type 也加進來（type 直接在 RoomManager.ts 裡 export，由使用方按需引入）。
- 若新增第四個網路類別，在此補一行 re-export 即可。
