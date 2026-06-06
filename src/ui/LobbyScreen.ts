// Agent 9 負責 — src/ui/LobbyScreen.ts
import { RoomManager } from '@/network'
import { SaveManager, SyncProtocol } from '@/save'
import { t, setLocale, getLocale, SUPPORTED_LOCALES } from '@/core/i18n'
import { LOCALE_LABELS } from '@/locales'
import { EventBus } from '@/core/EventBus'

type Step = 'charCreate' | 'welcome' | 'charEdit' | 'main' | 'mapSelect' | 'joinCode'

const STEP_IDS: Record<Step, string> = {
  charCreate: 'step-char-create',
  welcome:    'step-welcome',
  charEdit:   'step-char-edit',
  main:       'step-main',
  mapSelect:  'step-map-select',
  joinCode:   'step-join-code',
}

export class LobbyScreen {
  private el: HTMLElement

  constructor() {
    this.el = this.buildHTML()
    document.body.appendChild(this.el)
    this.init()

    // 語言切換時重繪整個 Lobby 面板
    EventBus.on('i18n:changed', () => this._rebuildInPlace())
  }

  // ── 初始判斷顯示哪個步驟 ──────────────────────────────────

  private init(): void {
    const player = SyncProtocol.getLocalPlayer()
    if (player?.name) {
      this.showWelcome()
    } else {
      this.setStep('charCreate')
    }
  }

  // ── 語言切換後重建 HTML（保持可見狀態） ──────────────────

  private _rebuildInPlace(): void {
    const wasVisible = this.el.style.display !== 'none'
    const newEl = this.buildHTML()
    this.el.replaceWith(newEl)
    this.el = newEl
    if (!wasVisible) this.el.style.display = 'none'
    this.init()
  }

  // ── 建立 HTML ──────────────────────────────────────────────

  private buildHTML(): HTMLElement {
    const div = document.createElement('div')
    div.id = 'lobby'
    div.innerHTML = `
      <div class="lobby-box">
        <h1>${t('lobby.title')}</h1>

        <!-- 語言切換器 -->
        <div class="lobby-lang-row" id="lobby-lang-row">
          <span class="lobby-lang-label">${t('lobby.lang_label')}:</span>
          ${SUPPORTED_LOCALES.map(lang => `
            <button class="lobby-lang-btn${getLocale() === lang ? ' lobby-lang-btn--active' : ''}"
                    data-lang="${lang}">${LOCALE_LABELS[lang]}</button>
          `).join('')}
        </div>

        <!-- 第一次：建立角色 -->
        <div id="step-char-create" style="display:none">
          <p class="lobby-hint">${t('lobby.create_char')}</p>
          <div class="section">
            <input id="char-name-input" type="text" placeholder="${t('lobby.char_name_ph')}" maxlength="12" />
          </div>
          <div class="section">
            <button id="btn-create-char">${t('lobby.create_btn')}</button>
          </div>
        </div>

        <!-- 之後：歡迎回來 -->
        <div id="step-welcome" style="display:none">
          <div id="welcome-msg" class="welcome-msg"></div>
          <div class="section lobby-row">
            <button id="btn-enter-game">${t('lobby.enter_game')}</button>
            <button id="btn-edit-char" class="btn-secondary btn-icon">✏️</button>
          </div>
        </div>

        <!-- 編輯角色 -->
        <div id="step-char-edit" style="display:none">
          <h2>${t('lobby.edit_char_title')}</h2>
          <div class="section">
            <input id="char-edit-input" type="text" placeholder="${t('lobby.new_name_ph')}" maxlength="12" />
          </div>
          <div class="section">
            <button id="btn-save-char">${t('lobby.save_btn')}</button>
            <button id="btn-back-welcome" class="btn-secondary">${t('lobby.back_btn')}</button>
          </div>
        </div>

        <!-- 主選單 -->
        <div id="step-main" style="display:none">
          <div class="section lobby-row">
            <button id="btn-host-step">${t('lobby.host_btn')}</button>
            <button id="btn-join-step">${t('lobby.join_btn')}</button>
          </div>
          <button id="btn-back-main" class="btn-secondary" style="margin-top:4px">${t('lobby.back_btn')}</button>
        </div>

        <!-- 選地圖 -->
        <div id="step-map-select" style="display:none">
          <h2>${t('lobby.map_title')}</h2>
          <div id="map-list"></div>
          <button id="btn-back-map" class="btn-secondary">${t('lobby.back_btn')}</button>
        </div>

        <!-- 加入代碼 -->
        <div id="step-join-code" style="display:none">
          <h2>${t('lobby.join_title')}</h2>
          <input id="room-code-input" type="text" placeholder="${t('lobby.room_code_ph')}" maxlength="6"
            style="text-transform:uppercase; letter-spacing:4px" />
          <button id="btn-join">${t('lobby.join_confirm')}</button>
          <button id="btn-back-join" class="btn-secondary">${t('lobby.back_btn')}</button>
        </div>

        <div id="lobby-status"></div>
      </div>
    `

    // 語言切換器事件
    div.querySelectorAll<HTMLButtonElement>('.lobby-lang-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lang = btn.dataset.lang as (typeof SUPPORTED_LOCALES)[number]
        if (lang) await setLocale(lang)
        // i18n:changed 會觸發 _rebuildInPlace
      })
    })

    // charCreate
    div.querySelector('#btn-create-char')!.addEventListener('click', () => this.onCreateChar())
    div.querySelector('#char-name-input')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.onCreateChar()
    })
    // welcome
    div.querySelector('#btn-enter-game')!.addEventListener('click', () => this.setStep('main'))
    div.querySelector('#btn-edit-char')!.addEventListener('click', () => this.showCharEdit())
    // charEdit
    div.querySelector('#btn-save-char')!.addEventListener('click', () => this.onSaveChar())
    div.querySelector('#btn-back-welcome')!.addEventListener('click', () => this.showWelcome())
    // main
    div.querySelector('#btn-host-step')!.addEventListener('click', () => this.showMapSelect())
    div.querySelector('#btn-join-step')!.addEventListener('click', () => this.setStep('joinCode'))
    div.querySelector('#btn-back-main')!.addEventListener('click', () => this.showWelcome())
    // mapSelect
    div.querySelector('#btn-back-map')!.addEventListener('click', () => this.setStep('main'))
    // joinCode
    div.querySelector('#btn-join')!.addEventListener('click', () => this.onJoin())
    div.querySelector('#btn-back-join')!.addEventListener('click', () => this.setStep('main'))

    return div
  }

  // ── 步驟切換 ───────────────────────────────────────────────

  private setStep(step: Step): void {
    for (const [s, id] of Object.entries(STEP_IDS)) {
      const el = this.el.querySelector<HTMLElement>(`#${id}`)
      if (el) el.style.display = s === step ? '' : 'none'
    }
    this.setStatus('')
  }

  private showWelcome(): void {
    const player = SyncProtocol.getLocalPlayer()
    this.el.querySelector('#welcome-msg')!.textContent =
      t('lobby.welcome_back', { name: player?.name ?? t('ui.common.unknown') })
    this.setStep('welcome')
  }

  private showCharEdit(): void {
    const player = SyncProtocol.getLocalPlayer()
    const input = this.el.querySelector<HTMLInputElement>('#char-edit-input')!
    input.value = player?.name ?? ''
    this.setStep('charEdit')
  }

  private async showMapSelect(): Promise<void> {
    this.setStep('mapSelect')
    await this.renderMapList()
  }

  private async renderMapList(): Promise<void> {
    const mapList = this.el.querySelector('#map-list')!
    mapList.innerHTML = `<div style="opacity:.6;padding:8px 0">${t('lobby.loading_maps')}</div>`
    try {
      const saves = await SaveManager.listWorldsWithInfo()
      mapList.innerHTML = ''

      // 全新地圖按鈕
      const newBtn = document.createElement('button')
      newBtn.className = 'map-item map-new'
      newBtn.textContent = t('lobby.new_map_btn')
      newBtn.addEventListener('click', () => this.onSelectMap(null))
      mapList.appendChild(newBtn)

      // 每個存檔列
      for (const s of saves) {
        mapList.appendChild(this.buildSaveRow(s.saveName, s.createdAt))
      }
    } catch (e) {
      mapList.innerHTML = `<div style="color:#ef9a9a">${t('lobby.load_fail', { err: String(e) })}</div>`
    }
  }

  private buildSaveRow(saveName: string, createdAt: number): HTMLElement {
    const d = new Date(createdAt)
    const dateStr = createdAt
      ? `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
      : t('lobby.unknown_date')

    const row = document.createElement('div')
    row.className = 'map-row'

    // ── 進入遊戲按鈕 ──
    const playBtn = document.createElement('button')
    playBtn.className = 'map-item'
    playBtn.innerHTML = `📁 ${saveName}<small style="margin-left:8px;opacity:.65">${dateStr}</small>`
    playBtn.addEventListener('click', () => this.onSelectMap(saveName))

    // ── 重新命名按鈕 ──
    const renameBtn = document.createElement('button')
    renameBtn.className = 'map-action-btn'
    renameBtn.title = t('lobby.rename_title')
    renameBtn.textContent = '✏️'
    renameBtn.addEventListener('click', () => this.enterRenameMode(row, saveName, createdAt))

    // ── 刪除按鈕 ──
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'map-action-btn map-delete-btn'
    deleteBtn.title = t('lobby.delete_title')
    deleteBtn.textContent = '🗑️'
    deleteBtn.addEventListener('click', () => this.onDeleteSave(saveName))

    row.appendChild(playBtn)
    row.appendChild(renameBtn)
    row.appendChild(deleteBtn)
    return row
  }

  private enterRenameMode(row: HTMLElement, oldName: string, createdAt: number): void {
    row.innerHTML = ''

    const input = document.createElement('input')
    input.className = 'map-rename-input'
    input.value = oldName
    input.maxLength = 32
    input.placeholder = t('lobby.rename_ph')

    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'map-action-btn map-confirm-btn'
    confirmBtn.title = t('lobby.rename_confirm_tip')
    confirmBtn.textContent = '✓'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'map-action-btn'
    cancelBtn.title = t('lobby.rename_cancel_tip')
    cancelBtn.textContent = '✗'

    const doRename = async () => {
      const newName = input.value.trim()
      if (!newName) { input.focus(); return }
      if (newName === oldName) { this.replaceRowWithNormal(row, oldName, createdAt); return }
      try {
        await SaveManager.renameWorld(oldName, newName)
        await this.renderMapList()
      } catch (e) {
        this.setStatus(t('lobby.rename_fail', { err: String(e) }))
        this.replaceRowWithNormal(row, oldName, createdAt)
      }
    }

    confirmBtn.addEventListener('click', doRename)
    cancelBtn.addEventListener('click', () => this.replaceRowWithNormal(row, oldName, createdAt))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRename()
      if (e.key === 'Escape') this.replaceRowWithNormal(row, oldName, createdAt)
    })

    row.appendChild(input)
    row.appendChild(confirmBtn)
    row.appendChild(cancelBtn)
    input.focus()
    input.select()
  }

  private replaceRowWithNormal(row: HTMLElement, saveName: string, createdAt: number): void {
    const newRow = this.buildSaveRow(saveName, createdAt)
    row.replaceWith(newRow)
  }

  private async onDeleteSave(saveName: string): Promise<void> {
    if (!confirm(t('lobby.delete_confirm', { name: saveName }))) return
    try {
      await SaveManager.deleteWorld(saveName)
      await this.renderMapList()
    } catch (e) {
      this.setStatus(t('lobby.delete_fail', { err: String(e) }))
    }
  }

  // ── 動作 ──────────────────────────────────────────────────

  private onCreateChar(): void {
    const name = this.el.querySelector<HTMLInputElement>('#char-name-input')!.value.trim()
    if (!name) { this.setStatus(t('lobby.no_name')); return }

    // 確保 stableId 存在並與 player.id 一致
    let stableId = localStorage.getItem('forager_stable_id')
    if (!stableId) {
      stableId = crypto.randomUUID()
      localStorage.setItem('forager_stable_id', stableId)
    }
    const player = SyncProtocol.createNewPlayer(name)
    player.id = stableId   // id = stableId，統一識別碼
    SyncProtocol.saveLocalPlayer(player)
    this.showWelcome()
  }

  private onSaveChar(): void {
    const name = this.el.querySelector<HTMLInputElement>('#char-edit-input')!.value.trim()
    if (!name) { this.setStatus(t('lobby.no_name')); return }
    const player = SyncProtocol.getLocalPlayer()
    if (player) SyncProtocol.saveLocalPlayer({ ...player, name })
    this.showWelcome()
  }

  private async onSelectMap(saveName: string | null): Promise<void> {
    this.setStatus(t('lobby.creating_room'))
    try {
      const code = await RoomManager.createRoom()
      const player = SyncProtocol.getLocalPlayer()
      this.hide()
      window.dispatchEvent(new CustomEvent('game:start', {
        detail: { role: 'host', mapName: saveName, playerName: player?.name ?? t('ui.common.unknown'), roomCode: code },
      }))
    } catch (e) {
      this.setStatus(t('lobby.create_fail', { err: String(e) }))
    }
  }

  private async onJoin(): Promise<void> {
    const code = this.el.querySelector<HTMLInputElement>('#room-code-input')!.value.toUpperCase()
    if (code.length !== 6) { this.setStatus(t('lobby.room_code_bad')); return }
    this.setStatus(t('lobby.connecting'))
    try {
      const player = SyncProtocol.getLocalPlayer()
      await RoomManager.joinRoom(code, player?.name ?? t('ui.common.unknown'))
      this.hide()
      window.dispatchEvent(new CustomEvent('game:start', { detail: { role: 'client' } }))
    } catch (e) {
      this.setStatus(t('lobby.connect_fail', { err: String(e) }))
    }
  }

  // ── 公開介面 ───────────────────────────────────────────────

  show(): void  { this.el.style.display = 'flex' }
  hide(): void  { this.el.style.display = 'none' }
  setStatus(msg: string): void {
    this.el.querySelector('#lobby-status')!.textContent = msg
  }
  updatePlayerCount(_count: number): void { /* 改用 HUD 顯示 */ }
}
