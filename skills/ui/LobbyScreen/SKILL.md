---
name: lobby-screen
description: Rebuild the lobby/start screen — character create, host/join room flow, map (save) list with rename/delete.
---

# ui/LobbyScreen.ts

> 模組：ui｜角色：遊戲入口畫面，管理角色建立、主選單、選地圖（存檔）、輸入房間代碼加入

## 公開 API

- `new LobbyScreen()` — 建構即 append 到 `document.body` 並 `init()`
- `LobbyScreen.show(): void` — `el.style.display = 'flex'`
- `LobbyScreen.hide(): void` — `el.style.display = 'none'`
- `LobbyScreen.setStatus(msg: string): void` — 寫入 `#lobby-status` 文字
- `LobbyScreen.updatePlayerCount(_count): void` — no-op（改用 HUD 顯示）

## 核心邏輯

### 步驟狀態機 (Step)

六個步驟用 `display` 切換，全部存在於 DOM 中，靠 `STEP_IDS` 對應 id：

```typescript
type Step = 'charCreate' | 'welcome' | 'charEdit' | 'main' | 'mapSelect' | 'joinCode'
const STEP_IDS: Record<Step, string> = {
  charCreate: 'step-char-create', welcome: 'step-welcome', charEdit: 'step-char-edit',
  main: 'step-main', mapSelect: 'step-map-select', joinCode: 'step-join-code',
}
private setStep(step: Step): void {
  for (const [s, id] of Object.entries(STEP_IDS)) {
    const el = this.el.querySelector<HTMLElement>(`#${id}`)
    if (el) el.style.display = s === step ? '' : 'none'
  }
  this.setStatus('')
}
```

`init()`：若 `SyncProtocol.getLocalPlayer()?.name` 存在 → `showWelcome()`；否則 → `setStep('charCreate')`。

### 建立角色（stableId 統一識別碼）

```typescript
private onCreateChar(): void {
  const name = this.el.querySelector<HTMLInputElement>('#char-name-input')!.value.trim()
  if (!name) { this.setStatus(t('lobby.no_name')); return }
  let stableId = localStorage.getItem('forager_stable_id')
  if (!stableId) { stableId = crypto.randomUUID(); localStorage.setItem('forager_stable_id', stableId) }
  const player = SyncProtocol.createNewPlayer(name)
  player.id = stableId   // id = stableId，統一識別碼
  SyncProtocol.saveLocalPlayer(player)
  this.showWelcome()
}
```

### Host 流程（選地圖 → 建房）與 Join 流程

Host：`showMapSelect()` → `renderMapList()` 列出 `SaveManager.listWorldsWithInfo()`，含「全新地圖」按鈕(傳 `null`)＋每個存檔列。選擇後：

```typescript
private async onSelectMap(saveName: string | null): Promise<void> {
  this.setStatus(t('lobby.creating_room'))
  const code = await RoomManager.createRoom()
  const player = SyncProtocol.getLocalPlayer()
  this.hide()
  window.dispatchEvent(new CustomEvent('game:start', {
    detail: { role: 'host', mapName: saveName, playerName: player?.name ?? t('ui.common.unknown'), roomCode: code },
  }))
}
private async onJoin(): Promise<void> {
  const code = this.el.querySelector<HTMLInputElement>('#room-code-input')!.value.toUpperCase()
  if (code.length !== 6) { this.setStatus(t('lobby.room_code_bad')); return }   // 房號固定 6 碼
  await RoomManager.joinRoom(code, player?.name ?? t('ui.common.unknown'))
  this.hide()
  window.dispatchEvent(new CustomEvent('game:start', { detail: { role: 'client' } }))
}
```

### 存檔列：play / rename(inline 編輯) / delete

`buildSaveRow(saveName, createdAt)` 產生三按鈕列（📁進入 / ✏️重命名 / 🗑️刪除）。`enterRenameMode` 把該 row 換成 input+✓+✗ inline，Enter 確認、Escape 取消，呼叫 `SaveManager.renameWorld` 後 `renderMapList()`。刪除走 `confirm()` → `SaveManager.deleteWorld`。

### i18n 重建

`_rebuildInPlace()`：記住可見狀態 → `buildHTML()` 新元素 → `replaceWith` → 還原 display → 重新 `init()`。

## EventBus 互動

- on `i18n:changed` — 觸發 `_rebuildInPlace()` 整片重繪
- 語言按鈕 `setLocale(lang)`（不直接重繪，靠 `i18n:changed` 回流）
- 非 EventBus：`window.dispatchEvent('game:start', { detail })` 通知 main.ts 開始遊戲

## 依賴

- `@/network` RoomManager — createRoom / joinRoom
- `@/save` SaveManager, SyncProtocol — 存檔列表/重命名/刪除、本地玩家讀寫
- `@/core/i18n` t/setLocale/getLocale/SUPPORTED_LOCALES、`@/locales` LOCALE_LABELS
- `@/core/EventBus`

## 重建提示

- 此類允許直接 import `@/network`/`@/save`（非典型 UI 邊界，照舊）。
- 房間代碼 input 用 CSS `text-transform:uppercase` 顯示，但 `onJoin` 仍手動 `.toUpperCase()`，且強制長度 6。
- 全部步驟 div 都在 DOM，`buildHTML` 一次性綁定所有按鈕事件；`_rebuildInPlace` 後事件會重新綁定（因重建整個 el）。
- 容器 id `lobby`，`.lobby-box` 為內框；顯示時用 `flex`（非 block）。
