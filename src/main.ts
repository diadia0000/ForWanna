// Agent 10 負責 — src/main.ts
// 整合所有系統的入口，只有整合者可以修改此檔案

import './style.css'

// Core
import { createApp } from './core/App'
import { EventBus } from './core/EventBus'
import { GameLoop } from './core/GameLoop'
import { GameStateManager_, PlayerStats } from './core/GameState'
import { initI18n, t } from './core/i18n'

// Network
import { NetworkClient, NetworkHost, RoomManager } from './network'

// World
import { ISLAND_UNLOCK_COST, TileMap, WORLD_CONFIG, WorldGen } from './world'

// Player
import { ClientPrediction, Player } from './player'

// Resources
import { Spawner } from './resources'

// Treasure
import { TreasureSpawner } from './treasure'

// Inventory
import { CraftingSystem, ITEMS, Inventory, RECIPES } from './inventory'
import { RESEARCH_UPGRADE_COSTS } from './inventory/data/researchUpgradeCosts'

// Building
import { BUILDING_DEFS, BuildingSystem } from './building'

// Save
import { SaveManager, SyncProtocol } from './save'

// UI
import { RESOURCE_CONFIG } from './resources/resourceConfig'
import { pickResourceForSpawn } from './resources/spawnConfig'
import type { BagType } from './ui'
import {
  BagUI,
  BarracksUI,
  BaseCoreUI,
  BuildingUI,
  CraftingUI,
  EquipUI,
  FurnaceUI,
  HUD,
  HotbarUI,
  InventoryUI,
  LobbyScreen,
  MarketUI, ResearchUI,
  createSelectorGfx,
  marketPricing,
  paintSelectorGfx,
} from './ui'

// Render
import { DayNight, FxLayer } from './render'
import { loadGameAssets } from './render/AssetLoader'
import { getItemIconMarkup } from './render/ItemSpriteRegistry'

// Combat
import { MONSTER_STATS, MonsterSpawner, getArmorDef, getArmorName, getWeaponDef } from './combat'

// Dungeon
import { DungeonScene, generateDungeon } from './dungeon'

// Quest
import { QuestSystem, QuestUI } from './quest'

import * as PIXI from 'pixi.js'
import type { Difficulty, MonsterSpawnCategory } from './combat/MonsterSpawner'
import type { MonsterType } from './combat/Monster'
import type { PlayerData, PlayerId, PlayerInput, ResourceNode, ResourceType } from './types'

// ── 初始化 ──────────────────────────────────────────────────

async function bootstrap() {
  await initI18n()

  const app = await createApp()

  // 載入 Farm RPG sprites（失敗時靜默降級）
  await loadGameAssets()

  GameLoop.start(app)

  // 建立 PixiJS 圖層（全部放進 camera 容器，移動 camera 就能跟隨玩家）
  const { Container } = await import('pixi.js')
  const CAMERA_ZOOM   = 1.5   // 縮放倍率：1.0 = 原尺寸，>1 放大（格子更大、視野更近）
  const camera        = app.stage.addChild(new Container())
  camera.scale.set(CAMERA_ZOOM)
  const worldLayer    = camera.addChild(new Container())   // 底層：TileMap
  const islandRingGfx  = camera.addChild(new PIXI.Graphics()) // 鎖定島嶼圓圈（tile 上、物件下）
  // objectsLayer 啟用 Y 排序：資源、建築、玩家統一在此做深度排列（2.5D 遮擋）
  const objectsLayer   = camera.addChild(new Container())
  objectsLayer.sortableChildren = true
  // 相容舊引用：resourceLayer / buildingLayer / playerLayer 全部指向 objectsLayer
  const resourceLayer = objectsLayer
  const buildingLayer = objectsLayer
  const playerLayer   = objectsLayer
  const dropLayer     = camera.addChild(new Container())   // 掉落物層（物件上方）

  // ── 渲染層系統 ─────────────────────────────────────────────
  const fxLayer = new FxLayer(camera)   // 世界座標，跟著相機

  // selectorLayer 最後加入，確保游標永遠在所有世界物件最上層
  const selectorLayer  = camera.addChild(new Container())   // 採集游標（最上層）
  const dayNight = new DayNight(        // 螢幕座標，在 stage 最上層
    app.stage, app.screen.width, app.screen.height
  )
  // 追蹤上次遮罩尺寸：Chrome 的瀏覽器縮放不一定觸發 resize 事件，
  // 在主迴圈每幀比對，尺寸一變就重新撐滿夜晚遮罩（避免只蓋半邊畫面）。
  let lastDnW = app.screen.width
  let lastDnH = app.screen.height
  function syncViewportSize(): void {
    // 同步 devicePixelRatio：瀏覽器縮放（Ctrl +/-）或視窗移到不同 DPI 螢幕會改變 DPR。
    // resolution 只在 App.init 讀一次，若不在此跟著更新，canvas backing store 會與
    // CSS 尺寸不符（例如在 25% 縮放載入後拉回 100%）→ 整個畫面糊掉、圈圈也跟著模糊。
    const dpr = window.devicePixelRatio || 1
    app.renderer.resize(window.innerWidth, window.innerHeight, dpr)
    dayNight.resize(app.screen.width, app.screen.height)
  }
  const scheduleViewportSync = () => {
    syncViewportSize()
    requestAnimationFrame(syncViewportSize)
  }
  window.addEventListener('resize', scheduleViewportSync)
  new ResizeObserver(scheduleViewportSync).observe(document.documentElement)

  // ── 鎖定瀏覽器縮放 ────────────────────────────────────────────
  // 縮放會讓 window.innerWidth 與 PIXI 內部尺寸不一致，導致夜晚遮罩只蓋半邊、
  // 解鎖圈位置錯亂等問題。攔截 Ctrl/⌘ + 加減 與 Ctrl + 滾輪縮放，強制維持 100%。
  // 保留 Ctrl+0（重設為 100%）當逃生門，萬一已被縮放可手動歸位。
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_'].includes(e.key)) {
      e.preventDefault()
    }
  }, { passive: false })
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault()
  }, { passive: false })
  // 觸控板雙指縮放（Safari/Chrome 的手勢事件）
  window.addEventListener('gesturestart', (e) => e.preventDefault())

  const notifyLeaveOnPageExit = () => {
    if (RoomManager.role === 'client') NetworkClient.disconnect()
  }
  window.addEventListener('pagehide', notifyLeaveOnPageExit)
  window.addEventListener('beforeunload', notifyLeaveOnPageExit)

  // ── 信令斷線覆蓋層 ─────────────────────────────────────────
  const reconnectOverlay = document.createElement('div')
  reconnectOverlay.id = 'reconnect-overlay'
  function _renderReconnectOverlay(): void {
    reconnectOverlay.innerHTML = `
      <div class="reconnect-box">
        <div class="reconnect-spinner"></div>
        <p>${t('game.reconnect_title')}</p>
        <p class="reconnect-sub">${t('game.reconnect_sub')}</p>
      </div>
    `
  }
  _renderReconnectOverlay()
  reconnectOverlay.style.display = 'none'
  document.body.appendChild(reconnectOverlay)
  window.addEventListener('peer:signaling-lost',     () => { reconnectOverlay.style.display = 'flex' })
  window.addEventListener('peer:signaling-restored', () => { reconnectOverlay.style.display = 'none' })

  const tileMap         = new TileMap()
  const spawner         = new Spawner(resourceLayer)
  const treasureSpawner = new TreasureSpawner(objectsLayer)
  const openedChests    = new Set<string>()  // 追蹤已打開的寶箱 ID（用於廣播）
  const buildingSystem  = new BuildingSystem(buildingLayer)
  const craftingSystem = new CraftingSystem()
  const players        = new Map<PlayerId, Player>()
  const prediction     = new ClientPrediction()
  const PLAYER_SPRITE_IDS = ['player', 'player.monk2', 'player.boy', 'player.eskimo'] as const

  // ── 戰鬥 + 任務系統 ───────────────────────────────────────────
  const monsterSpawner = new MonsterSpawner(objectsLayer)
  const questSystem    = new QuestSystem()
  const questUI        = new QuestUI(questSystem)

  questSystem.setCompleteCallback(id => questUI.notifyComplete(id))

  // 攻擊冷卻
  let lastAttackMs   = 0
  let lastNightState = false    // 偵測夜晚切換（計 nights）
  // 魔法泡泡
  let laserLastHitMs = 0
  let laserOrbGfx: PIXI.Graphics | null = null
  // 手電筒光束（世界座標，掛在 objectsLayer 上方）
  let flashlightGfx: PIXI.Graphics | null = null
  let flashlightOn = false   // 手電筒開關狀態（手持手電筒時按 R 切換；切到其他格子仍維持）
  let flashlightMask: PIXI.Graphics | null = null   // 手電筒形狀遮罩（讓光均勻、重疊不疊加）
  // 女神像祈禱冷卻（buildingId → 最後祈禱時間 ms）
  const goddessCooldowns = new Map<string, number>()

  // ── 難度 / 夜晚 / 飢餓系統 ─────────────────────────────────
  let currentDifficulty: Difficulty = 'normal'
  let nightCount = 0
  let lastHungerDecay = 0   // ms timestamp
  let lastHungerRegen = 0   // ms timestamp

  // ── 食物定義（itemId → { bites, hungerRestore, icon }） ─────────
  const FOOD_DEFS: Record<string, { bites: number; hungerRestore: number; icon: string }> = {
    berry: { bites: 3, hungerRestore: 30, icon: '🍓' },
    tomato: { bites: 3, hungerRestore: 30, icon: '🍅' },
    purple_grape: { bites: 3, hungerRestore: 30, icon: '🍇' },
    onion: { bites: 3, hungerRestore: 30, icon: '🧅' },
    carrot: { bites: 3, hungerRestore: 30, icon: '🥕' },
    pumpkin: { bites: 3, hungerRestore: 30, icon: '🎃' },
    watermelon: { bites: 3, hungerRestore: 30, icon: '🍉' },
  }

  // 食物咬食進度飄字
  let foodBiteCount  = 0    // 目前連按 R 的次數
  let lastFoodItemId = ''   // 切換食物時重置計數

  // 飢餓顯示由 HUD.update() 統一處理（#hud-hunger-segs）

  // 地圖覆蓋層
  const mapOverlay = document.createElement('div')
  mapOverlay.id = 'map-overlay'
  mapOverlay.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.78)',
    'display:none', 'align-items:center', 'justify-content:center',
    'z-index:500', 'flex-direction:column', 'gap:8px',
  ].join(';')
  const mapCanvas = document.createElement('canvas')
  mapCanvas.width = 560; mapCanvas.height = 560
  mapCanvas.style.cssText = 'border-radius:12px;border:2px solid #4a9;box-shadow:0 0 24px #0006'
  const mapLegend = document.createElement('div')
  mapLegend.style.cssText = 'color:#7a9a7a;font-size:12px;font-family:monospace;text-align:center;line-height:1.8'
  function _renderMapLegend(): void {
    mapLegend.innerHTML = `${t('game.map_legend_self')}&nbsp;&nbsp;${t('game.map_legend_ally')}&nbsp;&nbsp;${t('game.map_legend_wild')}&nbsp;&nbsp;${t('game.map_legend_siege')}&nbsp;&nbsp;${t('game.map_legend_build')}<br><span style="color:#aaa">${t('game.map_legend_close')}</span>`
  }
  _renderMapLegend()
  mapOverlay.appendChild(mapCanvas)
  mapOverlay.appendChild(mapLegend)
  document.body.appendChild(mapOverlay)
  mapOverlay.addEventListener('click', () => { mapOverlay.style.display = 'none' })

  function renderMap(): void {
    const ctx = mapCanvas.getContext('2d')
    if (!ctx) return
    const W = mapCanvas.width, H = mapCanvas.height
    ctx.clearRect(0, 0, W, H)

    const world = GameStateManager_.getWorld()
    const unlocked: string[] = (world as any).unlockedIslands ?? ['0,0']
    const unlockedSet = new Set(unlocked)

    // 背景：深海色
    ctx.fillStyle = '#091a2e'
    ctx.fillRect(0, 0, W, H)

    const CTR_X = W / 2, CTR_Y = H / 2
    // 每個 island stride = 70px
    const MAP_SCALE = 70

    const BIOME_FILL: Record<string, string> = {
      lush: '#2d7a2d', stone: '#556655', desert: '#b8922a', snow: '#99bbdd',
    }
    const BIOME_RING: Record<string, string> = {
      lush: '#4fc04f', stone: '#8aaa8a', desert: '#e8c040', snow: '#cce8ff',
    }

    // 繪製所有小島格（-4..+4 都顯示）
    for (let iy = -4; iy <= 4; iy++) {
      for (let ix = -4; ix <= 4; ix++) {
        const key = `${ix},${iy}`
        const px = CTR_X + ix * MAP_SCALE
        const py = CTR_Y + iy * MAP_SCALE
        if (unlockedSet.has(key)) {
          // 解鎖島：依生態系配色
          // 簡略計算生態系（lush=中心，其餘隨機但固定）
          const bh = ((ix * 374761 + iy * 1103515) ^ 0xabcdef12) >>> 0
          const biomes = ['lush', 'lush', 'stone', 'desert', 'snow']
          const biome = (ix === 0 && iy === 0) ? 'lush' : biomes[bh % biomes.length]
          ctx.fillStyle = BIOME_FILL[biome] ?? '#2d7a2d'
          ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = BIOME_RING[biome] ?? '#4fc04f'
          ctx.lineWidth = 2; ctx.stroke()
        } else {
          // 未解鎖：顯示解鎖費用提示
          const ring = Math.max(Math.abs(ix), Math.abs(iy))
          if (ring > 4) continue
          const cost = ISLAND_UNLOCK_COST[ring] ?? 9999
          ctx.fillStyle = '#1a2a1a'
          ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#334433'
          ctx.lineWidth = 1; ctx.stroke()
          ctx.fillStyle = '#556655'; ctx.font = '9px monospace'; ctx.textAlign = 'center'
          ctx.fillText(`${cost}🪙`, px, py - 14)
        }
      }
    }

    // 繪製建築（金色小方塊）
    for (const b of buildingSystem.getAll()) {
      const wx = b.x + TILE_SIZE / 2
      const wy = b.y + TILE_SIZE / 2
      const stride_px = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE
      const mx = CTR_X + (wx - WORLD_CONFIG.CENTER_X) / stride_px * MAP_SCALE
      const my = CTR_Y + (wy - WORLD_CONFIG.CENTER_Y) / stride_px * MAP_SCALE
      ctx.fillStyle = '#d4a017'
      ctx.fillRect(mx - 3, my - 3, 6, 6)
    }

    // 繪製怪物（野怪橙、守城怪紅）
    for (const m of monsterSpawner.getAllMonsters()) {
      const stride_px = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE
      const mx = CTR_X + (m.x - WORLD_CONFIG.CENTER_X) / stride_px * MAP_SCALE
      const my = CTR_Y + (m.y - WORLD_CONFIG.CENTER_Y) / stride_px * MAP_SCALE
      ctx.fillStyle = m.kind === 'wild' ? '#ff8844' : '#ff2233'
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill()
    }

    // 繪製玩家（自己綠，他人藍）
    for (const [pid, p] of players) {
      const stride_px = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE
      const mx = CTR_X + (p.x - WORLD_CONFIG.CENTER_X) / stride_px * MAP_SCALE
      const my = CTR_Y + (p.y - WORLD_CONFIG.CENTER_Y) / stride_px * MAP_SCALE
      ctx.fillStyle = pid === myPlayerId ? '#00ff88' : '#44aaff'
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke()
    }

    // 標題
    ctx.fillStyle = '#e0f0d0'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'
    ctx.fillText(t('game.map_title'), CTR_X, 22)
  }

  // ── 遺跡系統 ──────────────────────────────────────────────────
  const dungeonScene = new DungeonScene(objectsLayer)
  dungeonScene.container.visible = false
  let inDungeon = false
  let dungeonReturnX = 0, dungeonReturnY = 0
  let currentDungeonKey = ''   // `${ix},${iy}`

  function _enterDungeon(instanceSeed: number, retX: number, retY: number): void {
    const world = GameStateManager_.getWorld()
    const layout = generateDungeon(instanceSeed ^ world.seed, 0, 0)
    dungeonScene.setup(layout, instanceSeed)
    dungeonReturnX = retX; dungeonReturnY = retY
    currentDungeonKey = `dungeon_${instanceSeed}`
    inDungeon = true
    dungeonScene.container.visible = true
    const spawn = dungeonScene.getSpawnPoint()
    const me = players.get(myPlayerId)
    if (me) { me.sprite.x = spawn.x; me.sprite.y = spawn.y }
    const pd = GameStateManager_.getPlayer(myPlayerId)
    if (pd) { pd.x = spawn.x; pd.y = spawn.y; GameStateManager_.setPlayer(myPlayerId, pd) }
  }

  function _exitDungeon(): void {
    inDungeon = false
    currentDungeonKey = ''
    dungeonScene.container.visible = false
    const me = players.get(myPlayerId)
    if (me) { me.sprite.x = dungeonReturnX; me.sprite.y = dungeonReturnY }
    const pd = GameStateManager_.getPlayer(myPlayerId)
    if (pd) { pd.x = dungeonReturnX; pd.y = dungeonReturnY; GameStateManager_.setPlayer(myPlayerId, pd) }
  }

  let myPlayerId  = ''
  ;(globalThis as any).__giveItem = (itemId: string, amount = 1) => {
    if (!ITEMS[itemId]) return { ok: false, reason: 'unknown-item', itemId }
    const n = Math.max(1, Math.floor(Number(amount) || 1))
    if (!myPlayerId) return { ok: false, reason: 'player-not-ready' }
    const ok = Inventory.add(myPlayerId, itemId, n)
    const inventory = Inventory.get(myPlayerId)
    hotbarUI.show(inventory)
    return { ok, playerId: myPlayerId, itemId, name: ITEMS[itemId].name, amount: n, inventory }
  }
  ;(globalThis as any).__giveDungeonMap = (amount = 1) => (globalThis as any).__giveItem('dungeon_map', amount)

  function getCombatLevel(pd: Pick<PlayerData, 'level'> | undefined): number {
    return Math.max(1, Math.min(20, Math.floor(pd?.level ?? 1)))
  }

  function getCombatXpForNextLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5))
  }

  function applyCombatStats(pd: PlayerData, healLevelGain = false): void {
    const level = getCombatLevel(pd)
    const prevMaxHp = pd.maxHp ?? 100
    const nextMaxHp = PlayerStats.getMaxHpByCombatLevel(level)
    const gainedHp = Math.max(0, nextMaxHp - prevMaxHp)
    pd.maxHp = nextMaxHp
    pd.hp = Math.min(nextMaxHp, Math.max(0, (pd.hp ?? nextMaxHp) + (healLevelGain ? gainedHp : 0)))
    ;(pd as any).atk = PlayerStats.getAtkByCombatLevel(level)
    ;(pd as any).defPct = PlayerStats.getDefByCombatLevel(level)
  }

  function settleCombatLevel(
    playerId: string,
    pd: PlayerData,
    fxX?: number,
    fxY?: number,
  ): boolean {
    pd.level = getCombatLevel(pd)
    pd.xp = Math.max(0, Math.floor(pd.xp ?? 0))
    let didLevelUp = false
    while (pd.level < 20) {
      const threshold = getCombatXpForNextLevel(pd.level)
      if (pd.xp < threshold) break
      pd.xp -= threshold
      pd.level += 1
      didLevelUp = true
      if (Number.isFinite(fxX) && Number.isFinite(fxY)) {
        fxLayer.spawnFloatingText(Number(fxX), Number(fxY) - 30, t('game.level_up', { level: pd.level }), 0xFFFF44)
      }
      EventBus.emit('player:levelup', { playerId, level: pd.level })
    }
    applyCombatStats(pd, didLevelUp)
    return didLevelUp
  }

  function getPlayerAttackDamage(playerId: string, weaponDamage: number): number {
    const pd = GameStateManager_.getPlayer(playerId)
    const atk = PlayerStats.getAtkByCombatLevel(getCombatLevel(pd))
    return Math.max(1, Math.round(weaponDamage * (atk / 10) * 10) / 10)
  }

  function getPlayerDamageTaken(
    playerId: string,
    rawDamage: number,
  ): { actualDamage: number; totalDefPct: number } {
    const pd = GameStateManager_.getPlayer(playerId)
    const equippedArmor = (pd as any)?.equipped?.armor as string | undefined
    const armorDef = getArmorDef(equippedArmor)
    const combatDefPct = PlayerStats.getDefByCombatLevel(getCombatLevel(pd))
    const armorDefPct = armorDef?.defPct ?? 0
    const totalDefPct = Math.min(0.85, 1 - (1 - combatDefPct) * (1 - armorDefPct))
    return {
      actualDamage: Math.round(rawDamage * (1 - totalDefPct) * 10) / 10,
      totalDefPct,
    }
  }

  function grantCombatXp(
    playerId: string,
    xpAmount: number,
    fxX: number,
    fxY: number,
  ): PlayerData | null {
    const pd = GameStateManager_.getPlayer(playerId)
    if (!pd) return null
    pd.xp = (pd.xp ?? 0) + Math.max(0, Math.floor(xpAmount))
    settleCombatLevel(playerId, pd, fxX, fxY)
    GameStateManager_.setPlayer(playerId, pd)
    if (playerId === myPlayerId) {
      hud.update({ hp: pd.hp, maxHp: pd.maxHp, xp: pd.xp, level: pd.level } as any)
    }
    return pd
  }

  function syncCheatClock(): void {
    const derivedNightCount = Math.max(
      0,
      dayNight.currentDayCount - 1 + (dayNight.phase === 'night' ? 1 : 0),
    )
    nightCount = derivedNightCount
    lastNightState = dayNight.phase === 'night'
    monsterSpawner.setNightCount(nightCount)
    refreshWorldClockSnapshot()
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_full',
        tick: GameStateManager_.get().tick,
        state: GameStateManager_.get(),
      } as any)
    }
  }

  function normalizeCheatSpawnCategory(raw: unknown): MonsterSpawnCategory {
    const value = String(raw ?? 'wild').trim().toLowerCase()
    const map: Record<string, MonsterSpawnCategory> = {
      wild: 'wild',
      normal: 'wild',
      passive: 'wild',
      field: 'wild',
      '野怪': 'wild',
      siege: 'siege',
      raid: 'siege',
      base: 'siege',
      defense: 'siege',
      chasing: 'siege',
      '守城怪': 'siege',
      elite: 'elite',
      '菁英怪': 'elite',
      '精英怪': 'elite',
      boss: 'boss',
      world_boss: 'boss',
      worldboss: 'boss',
      'world boss': 'boss',
      '世界boss': 'boss',
      '世界 boss': 'boss',
    }
    return map[value] ?? 'wild'
  }

  function isRepairableBuilding(defId: string): boolean {
    return ['spike_trap', 'fire_trap', 'ice_trap', 'tower'].includes(defId)
  }

  function isTrapBuilding(defId: string): boolean {
    return ['spike_trap', 'fire_trap', 'ice_trap'].includes(defId)
  }

  function getCheatSpawnPivots(playerId = myPlayerId): Array<{ x: number; y: number; id: string }> {
    const p = playerId ? players.get(playerId) : null
    if (p) return [{ x: p.x, y: p.y, id: playerId }]

    const pd = playerId ? GameStateManager_.getPlayer(playerId) : null
    if (pd) return [{ x: pd.x, y: pd.y, id: playerId }]

    const all: Array<{ x: number; y: number; id: string }> = []
    players.forEach((player, id) => all.push({ x: player.x, y: player.y, id }))
    return all
  }

  function runCheatSpawnEntity(entityId: string, categoryRaw: unknown, playerId = myPlayerId) {
    const type = String(entityId) as MonsterType
    if (!MONSTER_STATS[type]) return { ok: false, reason: 'unknown-entity', entityId }
    const category = normalizeCheatSpawnCategory(categoryRaw)
    const pivots = getCheatSpawnPivots(playerId)
    if (pivots.length === 0) return { ok: false, reason: 'player-not-ready', playerId }
    const monster = monsterSpawner.spawnEntity(type, category, pivots)
    if (!monster) return { ok: false, reason: 'spawn-position-not-found', entityId: type, category, playerId }
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta',
        tick: GameStateManager_.get().tick,
        delta: {
          monsters: [{
            id: monster.id,
            type: monster.type,
            hp: monster.hp,
            maxHp: monster.maxHp,
            x: monster.x,
            y: monster.y,
            kind: monster.kind,
            isElite: monster.isElite,
            isBoss: monster.isBoss,
            attacking: monster.isAttacking,
          }],
        } as any,
      } as any)
    }
    return { ok: true, id: monster.id, entityId: type, category, x: monster.x, y: monster.y }
  }

  function runCheatSetGold(amount: number, playerId = myPlayerId) {
    const pd = GameStateManager_.getPlayer(playerId)
    if (!pd) return { ok: false, reason: 'player-not-ready', playerId }
    pd.gold = Math.max(0, Math.floor(Number(amount) || 0))
    GameStateManager_.setPlayer(playerId, pd)
    if (playerId === myPlayerId) hud.update({ gold: pd.gold } as any)
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta',
        tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: { gold: pd.gold } } },
      })
    }
    return { ok: true, playerId, gold: pd.gold }
  }

  function parseCheatTimeTarget(target: string | number, dayOrTime?: number): { day: number; timeS: number } {
    if (typeof target === 'string') {
      const phase = target.toLowerCase()
      const phaseTime: Record<string, number> = {
        day: 0,
        morning: 0,
        dusk: dayNight.cycleSeconds * 0.27,
        night: dayNight.cycleSeconds * 0.45,
        dawn: dayNight.cycleSeconds * 0.68,
        '白天': 0,
        '早上': 0,
        '黃昏': dayNight.cycleSeconds * 0.27,
        '晚上': dayNight.cycleSeconds * 0.45,
        '夜晚': dayNight.cycleSeconds * 0.45,
        '黎明': dayNight.cycleSeconds * 0.68,
      }
      return {
        day: Math.max(1, Math.floor(dayOrTime ?? dayNight.currentDayCount)),
        timeS: phaseTime[phase] ?? dayNight.currentTimeS,
      }
    }
    if (dayOrTime === undefined) {
      return { day: dayNight.currentDayCount, timeS: Number(target) || 0 }
    }
    return { day: Number(target) || 1, timeS: Number(dayOrTime) || 0 }
  }

  function runCheatSetGameTime(target: string | number, dayOrTime?: number) {
    const parsed = parseCheatTimeTarget(target, dayOrTime)
    dayNight.setTime(parsed.day, parsed.timeS)
    syncCheatClock()
    return { ok: true, day: dayNight.currentDayCount, timeS: dayNight.currentTimeS, phase: dayNight.phase, nightCount }
  }

  function runCheatFastForwardTime(seconds: number) {
    const value = Math.max(0, Number(seconds) || 0)
    dayNight.fastForward(value)
    syncCheatClock()
    return { ok: true, forwardedSeconds: value, day: dayNight.currentDayCount, timeS: dayNight.currentTimeS, phase: dayNight.phase, nightCount }
  }

  function sendCheatInput(input: Record<string, unknown>) {
    if (!myPlayerId) return { ok: false, reason: 'player-not-ready' }
    NetworkClient.send({
      type: 'input',
      playerId: myPlayerId,
      tick: GameStateManager_.get().tick,
      input: input as any,
    })
    return { ok: true, sentToHost: true, input }
  }

  ;(globalThis as any).spawnEntity = (entityId = 'slime', type = 'wild') => {
    if (RoomManager.role === 'client') {
      return sendCheatInput({ type: 'cheat_spawn_entity', entityId, category: type })
    }
    return runCheatSpawnEntity(entityId, type, myPlayerId)
  }
  ;(globalThis as any).__spawnEntity = (globalThis as any).spawnEntity
  ;(globalThis as any).__spawnMonster = (globalThis as any).spawnEntity
  ;(globalThis as any).setGold = (amount: number) => {
    if (RoomManager.role === 'client') return sendCheatInput({ type: 'cheat_set_gold', amount })
    return runCheatSetGold(amount)
  }
  ;(globalThis as any).__setGold = (globalThis as any).setGold
  ;(globalThis as any).setGameTime = (target: string | number, dayOrTime?: number) => {
    if (RoomManager.role === 'client') return sendCheatInput({ type: 'cheat_set_time', target, dayOrTime })
    return runCheatSetGameTime(target, dayOrTime)
  }
  ;(globalThis as any).__setGameTime = (globalThis as any).setGameTime
  ;(globalThis as any).fastForwardTime = (seconds: number) => {
    if (RoomManager.role === 'client') return sendCheatInput({ type: 'cheat_fast_forward_time', seconds })
    return runCheatFastForwardTime(seconds)
  }
  ;(globalThis as any).__fastForwardTime = (globalThis as any).fastForwardTime

  let currentMapName: string | null = null
  let inputState = { up: false, down: false, left: false, right: false }
  let selectedDir = { dx: 1, dy: 0 }
  const selectedPoint = { x: 0, y: 0, clientX: 0, clientY: 0, hasPointer: false }
  let selectorFlashUntil = 0
  let clientPlayerHydrationChecked = false

  type DropItem = {
    id: string; resourceType: ResourceType
    itemId: string; amount: number
    worldX: number; worldY: number
    sprite: PIXI.Container; bobTick: () => void
  }
  type DropSnapshot = {
    id: string
    resourceType: ResourceType
    itemId: string
    amount: number
    worldX: number
    worldY: number
  }
  const drops = new Map<string, DropItem>()

  // 掉落設定統一由 RESOURCE_CONFIG 管理（hp / drops / respawnTime）

  // ── 玩家攻擊範圍（格數）── 空手 = 1，武器可擴展 ──────────────
  let playerReach = 1

  // ── 手榴彈系統 ─────────────────────────────────────────────
  interface GrenadeProjectile {
    id: string
    sprite: PIXI.Graphics
    startX: number; startY: number
    targetX: number; targetY: number
    spawnMs: number
    fuseMs: number      // 引爆時間 ms
    exploded: boolean
  }
  const grenades: GrenadeProjectile[] = []
  const GRENADE_FUSE_MS = 1500
  const GRENADE_RADIUS  = 48 * 3   // 爆炸半徑（像素）= TILE_SIZE * 3

  function throwGrenade(wx: number, wy: number): void {
    if (!myPlayerId) return
    const me = players.get(myPlayerId)
    if (!me) return
    if (!Inventory.remove(myPlayerId, 'grenade', 1)) {
      fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.no_grenade'), 0xFF6666)
      return
    }
    hotbarUI.show(Inventory.get(myPlayerId))
    const id = `gren_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const gfx = new PIXI.Graphics()
    gfx.circle(0, 0, 7).fill(0x445533)
    gfx.circle(0, 0, 7).stroke({ color: 0x222211, width: 1.5 })
    gfx.circle(0, -8, 3).fill(0x888866)   // 安全拉環
    gfx.x = me.x; gfx.y = me.y
    dropLayer.addChild(gfx)
    grenades.push({ id, sprite: gfx, startX: me.x, startY: me.y,
      targetX: wx, targetY: wy, spawnMs: performance.now(),
      fuseMs: GRENADE_FUSE_MS, exploded: false })
  }

  // ── 兵營士兵系統 ──────────────────────────────────────────────
  interface SoldierEntry {
    id: string
    barracksId: string
    sprite: PIXI.Container
    gfx: PIXI.Graphics
    x: number; y: number
    hp: number; maxHp: number
    lastAttackMs: number
    dead: boolean
    respawnAt: number
  }
  const soldiers: SoldierEntry[] = []
  // barracksId → 下次生成士兵的時間 ms
  const barracksSpawnTimer = new Map<string, number>()
  const SOLDIER_SPAWN_INTERVAL = 30_000   // 30 秒生成 1 名
  // 農場產出計時（farmId → 下次產出時間 ms）
  const farmProduceTimer = new Map<string, number>()
  const FARM_PRODUCE_INTERVAL = 30_000   // 每 30 秒掉落 2 顆漿果
  const SOLDIER_MAX_PER_BARRACKS = 3
  const SOLDIER_HP = 50
  const SOLDIER_ATK = 8
  const SOLDIER_SPEED = 80   // px/s
  const SOLDIER_ATTACK_RANGE = 48 * 1.4   // = TILE_SIZE * 1.4
  const SOLDIER_ATTACK_CD_MS = 1200
  const SOLDIER_RESPAWN_MS = 60_000

  function spawnSoldier(barracksId: string, bx: number, by: number): void {
    const id = `soldier_${barracksId}_${Date.now()}`
    const sprite = new PIXI.Container()
    const gfx = new PIXI.Graphics()
    // 士兵外觀：綠色小人
    gfx.rect(-6, -16, 12, 10).fill(0x4a7a2a)           // 身體（軍裝）
    gfx.rect(-4, -6, 8, 12).fill(0x3a5a1a)              // 腿
    gfx.circle(0, -22, 7).fill(0xcc9966)                 // 頭
    gfx.rect(-8, -18, 16, 4).fill(0x2a4a0a)              // 頭盔
    gfx.rect(6, -16, 3, 8).fill(0x888888)                // 武器（長矛）
    gfx.ellipse(0, 6, 10, 3).fill({ color: 0x000000, alpha: 0.2 })  // 陰影
    sprite.addChild(gfx)
    sprite.x = bx + TILE_SIZE; sprite.y = by + TILE_SIZE
    sprite.zIndex = by + TILE_SIZE + 21
    objectsLayer.addChild(sprite)
    soldiers.push({
      id, barracksId, sprite, gfx,
      x: bx + TILE_SIZE, y: by + TILE_SIZE,
      hp: SOLDIER_HP, maxHp: SOLDIER_HP,
      lastAttackMs: 0, dead: false, respawnAt: 0,
    })
  }

  // 跨 session 的穩定玩家 ID（用於存檔，不隨 PeerJS peer ID 改變）
  const stableId = (() => {
    let id = localStorage.getItem('forager_stable_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('forager_stable_id', id) }
    return id
  })()

  worldLayer.addChild(tileMap.displayObject)

  // ── 資源耗盡爆炸特效 + 掉落物 ─────────────────────────────
  spawner.setDepletedVisualCallback((data) => {
    fxLayer.spawnDepletionBurst(data.x, data.y, data.type)
    // Host 本地玩家採集：生成掉落物（Client 端耗盡由 network:input harvest 直接給予）
    if (RoomManager.role === 'host') {
      const spawnedDrops = spawnDrop(data.x, data.y, data.type)
      if (spawnedDrops.length > 0) {
        NetworkHost.broadcast({
          type: 'state_delta',
          tick: GameStateManager_.get().tick,
          delta: { drops: spawnedDrops } as any,
        })
      }
    }
  })

  // ── Quest 追蹤（採集事件，resource:collected 在本專案未實際 emit，改直接追蹤） ──
  EventBus.on('craft:success', ({ recipeId }) => { questSystem.add(recipeId, 1) })
  EventBus.on('build:placed',  ()             => { questSystem.add('buildings', 1) })

  // ── 寶箱系統（打開寶箱時添加掉落物到背包） ──────────────────
  EventBus.on('treasure:opened', ({ chestId, loot }) => {
    if (RoomManager.role !== 'host') return  // 只有 Host 處理背包更新
    const playerId = myPlayerId
    if (!playerId) return

    for (const { itemId, amount } of loot) {
      Inventory.add(playerId, itemId, amount)
    }

    // 廣播背包變更到所有 Client（Inventory.add 會自動發出 inventory:changed 事件）
    const updated = Inventory.get(playerId)
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { players: { [playerId]: { inventory: updated } } },
    })
  })

  // ── 採集 XP 輔助函數（Host 端，在節點耗盡時呼叫） ──────────
  const HARVEST_XP: Record<string, [number, number]> = {
    berry: [1, 3], tomato: [1, 3], purple_grape: [1, 3], onion: [1, 3],
    carrot: [1, 3], pumpkin: [1, 3], watermelon: [1, 3],
    tree: [2, 5], rock: [2, 5],
    iron:  [4, 8], gold: [6, 12], crystal: [10, 20],
  }
  function _grantHarvestXP(pid: string, type: string, nodeX: number, nodeY: number): void {
    if (RoomManager.role !== 'host') return
    // 雙等級系統：採集不再給 Combat XP（XP 只能從打怪獲得）
    // Research Lvl 由花費時間+材料升級研究所獲得（不從採集取得）
    void HARVEST_XP // 保留表以備日後改為 Research XP 使用
    void nodeX; void nodeY; void pid
    // 只追蹤 Quest 進度
    questSystem.add(type, 1)
  }
  // ── 採集浮動文字 + 粒子（Host 端直接觸發；Client 端透過 state_delta 採集時也觸發） ──
  EventBus.on('resource:collected', ({ playerId: _pid, type, amount }) => {
    // 取得採集者位置（用自己的 sprite 位置偏移一點）
    const collector = myPlayerId ? players.get(myPlayerId) : undefined
    if (collector) {
      fxLayer.spawnHarvest(collector.x, collector.y - 20, type, amount ?? 1)
    }
  })

  // 採集改由滑鼠左鍵集中處理（見 canvas pointerdown → tryHarvestAtPointer），停用節點自身的 click
  spawner.setClickHandler(() => {})

  spawner.setRespawnCallback((data) => {
    if (RoomManager.role !== 'host') return
    const world = GameStateManager_.getWorld()
    world.resources = (world.resources ?? []).filter(r => r.id !== data.id)
    world.resources.push(data)
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { resources: { [data.id]: data } },
    })
  })

  // ── UI ─────────────────────────────────────────────────────
  const lobby = new LobbyScreen()
  const hud = new HUD()

  const inventoryUI = new InventoryUI()
  const craftingUI  = new CraftingUI()
  const buildingUI  = new BuildingUI()
  const hotbarUI    = new HotbarUI()
  const furnaceUI   = new FurnaceUI()
  const marketUI    = new MarketUI()
  const researchUI  = new ResearchUI()
  const bagUI       = new BagUI()
  const baseCoreUI  = new BaseCoreUI()
  const barracksUI  = new BarracksUI()
  const equipUI     = new EquipUI()
  hud.hide()

  function setLocalInventoryUiPlayer(playerId: string): void {
    inventoryUI.setPlayerId(playerId)
    craftingUI.setPlayerId(playerId)
    hotbarUI.setPlayerId(playerId)
  }

  const INTERACTION_PROMPT_FONT = 'ForWannaInteractionPrompt'
  const interactionPrompt = new PIXI.Container()
  interactionPrompt.visible = false
  interactionPrompt.zIndex = 10_000
  const interactionPromptBg = new PIXI.Sprite(PIXI.Texture.EMPTY)
  interactionPromptBg.anchor.set(0.5)
  interactionPromptBg.scale.set(1.05)
  const interactionPromptText = new PIXI.Text({
    text: '',
    style: {
      fontFamily: INTERACTION_PROMPT_FONT,
      fontSize: 10,
      fill: 0xffffff,
      align: 'center',
      dropShadow: { color: 0x000000, blur: 0, distance: 1, alpha: 0.9 },
    },
  })
  interactionPromptText.anchor.set(0.5)
  interactionPrompt.addChild(interactionPromptBg, interactionPromptText)
  selectorLayer.addChild(interactionPrompt)

  void (async () => {
    try {
      const font = new FontFace(
        INTERACTION_PROMPT_FONT,
        'url("/assets/main_resources/ui/NormalFont.ttf")',
      )
      document.fonts.add(await font.load())
      interactionPromptText.style.fontFamily = INTERACTION_PROMPT_FONT
      interactionPromptText.text = interactionPromptText.text
    } catch (err) {
      console.warn('[InteractionPrompt] font load failed:', err)
    }
    try {
      const tex = await PIXI.Assets.load('/assets/main_resources/ui/nine_path_panel.png') as PIXI.Texture
      tex.source.scaleMode = 'nearest'
      interactionPromptBg.texture = tex
    } catch (err) {
      console.warn('[InteractionPrompt] background load failed:', err)
    }
  })()

  ;(EventBus as any).on('interaction:prompt', (prompt: InteractionPrompt | null) => {
    if (!prompt || (prompt.key !== 'E' && prompt.key !== 'R')) {
      interactionPrompt.visible = false
      return
    }
    interactionPrompt.visible = true
    interactionPrompt.x = prompt.worldX + TILE_SIZE * 0.65
    interactionPrompt.y = prompt.worldY - TILE_SIZE * 0.2
    interactionPromptText.text = prompt.key.toUpperCase()
  })

  // ── 拆除確認面板（Backspace 鍵觸發） ─────────────────────────
  const demolishPanel = document.createElement('div')
  demolishPanel.id = 'demolish-panel'
  demolishPanel.style.display = 'none'
  function _renderDemolishPanel(): void {
    // 只更新靜態文字（按鈕事件在 document.body.appendChild 後統一綁定）
    const titleEl = demolishPanel.querySelector('.demolish-title')
    const okBtn   = demolishPanel.querySelector<HTMLButtonElement>('#demolish-ok')
    const cancelBtn = demolishPanel.querySelector<HTMLButtonElement>('#demolish-cancel')
    if (titleEl)    titleEl.textContent = t('game.demolish_title')
    if (okBtn)      okBtn.textContent   = t('game.demolish_ok')
    if (cancelBtn)  cancelBtn.textContent = t('game.demolish_cancel')
  }
  demolishPanel.innerHTML = `
    <div class="demolish-title">${t('game.demolish_title')}</div>
    <div id="demolish-bname" class="demolish-bname"></div>
    <div id="demolish-refund" class="demolish-refund"></div>
    <div class="demolish-btns">
      <button id="demolish-ok">${t('game.demolish_ok')}</button>
      <button id="demolish-cancel">${t('game.demolish_cancel')}</button>
    </div>
  `
  document.body.appendChild(demolishPanel)
  let demolishTargetId: string | null = null

  demolishPanel.querySelector('#demolish-cancel')!.addEventListener('click', () => {
    demolishPanel.style.display = 'none'
    demolishTargetId = null
  })

  // ── UI Toast（面板開啟時的操作回饋，顯示在所有 HTML 面板之上） ──
  function showUIToast(msg: string, colorHex = 0xffffff): void {
    const div = document.createElement('div')
    div.className = 'ui-toast'
    // 0xRRGGBB → CSS #rrggbb
    const hex = '#' + colorHex.toString(16).padStart(6, '0')
    div.style.color = hex
    div.style.borderColor = hex + '55'
    div.textContent = msg
    document.body.appendChild(div)
    // 動畫結束後自動移除（2.2s 與 CSS animation 一致）
    setTimeout(() => div.remove(), 2200)
  }

  // ── 背包狀態（本機只讀，不跨網路同步） ────────────────────────
  const smallBagContents: Record<string, number> = {}   // bag_small 內容
  const largeBagContents: Record<string, number> = {}   // bag_large 內容
  const BAG_SMALL_MAX = 999

  function _bagContents(type: BagType): Record<string, number> {
    return type === 'bag_small' ? smallBagContents : largeBagContents
  }

  function _bagUsed(type: BagType): number {
    return Object.values(_bagContents(type)).reduce((a, b) => a + b, 0)
  }

  function _bagRemain(type: BagType): number {
    if (type === 'bag_large') return Infinity
    return BAG_SMALL_MAX - _bagUsed('bag_small')
  }

  function _bagPutIn(type: BagType, itemId: string, amount: number, playerId: string): boolean {
    const remain = _bagRemain(type)
    const actual = remain === Infinity ? amount : Math.min(amount, remain)
    if (actual <= 0) return false
    // 從物品欄移除
    if (!Inventory.remove(playerId, itemId, actual)) return false
    // 加入背包
    const bag = _bagContents(type)
    bag[itemId] = (bag[itemId] ?? 0) + actual
    bagUI.update(_bagContents(type), Inventory.get(playerId))
    return true
  }

  function _bagTakeOut(type: BagType, itemId: string, amount: number, playerId: string): boolean {
    const bag = _bagContents(type)
    const have = bag[itemId] ?? 0
    const actual = Math.min(have, amount)
    if (actual <= 0) return false
    // 確認物品欄有空格
    const inv = Inventory.get(playerId)
    const hasExisting = inv.some(i => i.itemId === itemId)
    if (!hasExisting && inv.length >= 18) {
      const mePos = myPlayerId ? players.get(myPlayerId) : null
      if (mePos) fxLayer.spawnFloatingText(mePos.x, mePos.y - 40, t('game.bag_no_space'), 0xff8800)
      return false
    }
    // 加回物品欄
    Inventory.add(playerId, itemId, actual)
    // 從背包移除
    bag[itemId] = have - actual
    if (bag[itemId] <= 0) delete bag[itemId]
    bagUI.update(_bagContents(type), Inventory.get(playerId))
    return true
  }

  // 裝備欄卸下回調
  equipUI.setOnUnequip(() => {
    if (!myPlayerId) return
    const pd = GameStateManager_.getPlayer(myPlayerId)
    if (!pd) return
    const armor = (pd as any).equipped?.armor as string | undefined
    if (!armor) return
    Inventory.add(myPlayerId, armor, 1)
    ;(pd as any).equipped = { armor: null }
    GameStateManager_.setPlayer(myPlayerId, pd)
    hotbarUI.show(Inventory.get(myPlayerId))
    equipUI.clearArmor()
  })

  // 注入 InventoryUI 參考（供 HotbarUI 拖曳放入背包使用）
  hotbarUI.setInventoryUI(inventoryUI)

  // 快捷欄背包右鍵 → 開啟 BagUI
  hotbarUI.setOnBagRightClick((bagType) => {
    bagUI.toggle(bagType, _bagContents(bagType), Inventory.get(myPlayerId ?? ''))
  })

  // BagUI 放入按鈕
  bagUI.setOnPutIn((itemId, amount) => {
    if (!myPlayerId) return
    const activeBagType = bagUI.isVisible ? _getActiveBagType() : null
    if (!activeBagType) return
    _bagPutIn(activeBagType, itemId, amount, myPlayerId)
  })

  // BagUI 取出按鈕
  bagUI.setOnTakeOut((itemId, amount) => {
    if (!myPlayerId) return
    const activeBagType = _getActiveBagType()
    if (!activeBagType) return
    _bagTakeOut(activeBagType, itemId, amount, myPlayerId)
  })

  // 拖曳放入背包（HotbarUI 發出事件）
  ;(EventBus as any).on('bag:drag_drop', ({ bagType, itemId, amount }: { bagType: BagType; itemId: string; amount: number }) => {
    if (!myPlayerId) return
    const bag = _bagContents(bagType)
    const remain = _bagRemain(bagType)
    const actual = remain === Infinity ? amount : Math.min(amount, remain)
    if (actual <= 0) return
    bag[itemId] = (bag[itemId] ?? 0) + actual
    // 注意：InventoryUI.acceptBagDrop 已移除物品欄物品，此處只更新背包
    bagUI.update(_bagContents(bagType), Inventory.get(myPlayerId))
    const mePosDrag = myPlayerId ? players.get(myPlayerId) : null
    if (mePosDrag) fxLayer.spawnFloatingText(mePosDrag.x, mePosDrag.y - 40, t('game.bag_put_in', { name: t('item.' + itemId + '.name', undefined, ITEMS[itemId]?.name ?? itemId), amount: actual }), 0x88ddff)
  })

  /** 目前開著的背包類型（根據快捷欄哪格是背包且選中） */
  function _getActiveBagType(): BagType | null {
    const inv = Inventory.get(myPlayerId ?? '')
    for (const item of inv) {
      if (item.itemId === 'bag_small' || item.itemId === 'bag_large') {
        return item.itemId as BagType
      }
    }
    return null
  }

  // ── 建築放置模式 ───────────────────────────────────────────
  const TILE_SIZE = 48
  const PLAYER_COLLISION_CENTER_Y = 8
  const PLAYER_COLLISION_RADIUS = 10
  const ringAtWorld = (x: number, y: number): number => {
    const ix = Math.round((x - WORLD_CONFIG.CENTER_X) / (WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE))
    const iy = Math.round((y - WORLD_CONFIG.CENTER_Y) / (WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE))
    return Math.max(Math.abs(ix), Math.abs(iy))
  }
  let placingDefId: string | null = null

  // ── 選格高亮圖形 ────────────────────────────────────────────
  const selectorGfx = createSelectorGfx(selectorLayer)

  // ── 島嶼費用標籤池（DOM screen-space，貼在地圖各島嶼上） ──
  const ISLAND_LABEL_POOL_SIZE = 12
  const islandLabelPool: HTMLElement[] = []
  for (let _li = 0; _li < ISLAND_LABEL_POOL_SIZE; _li++) {
    const lbl = document.createElement('div')
    lbl.className = 'island-label'
    lbl.style.display = 'none'
    document.body.appendChild(lbl)
    islandLabelPool.push(lbl)
  }

  // ── 掉落物生成 ─────────────────────────────────────────────
  const DROP_COLORS: Record<string, number> = {
    wood: 0x7A3E0E, stone: 0x8090A2, iron: 0x4A5CA8, gold: 0xD89020, crystal: 0x8020C0,
    berry: 0xD01840, tomato: 0xE5462E, purple_grape: 0x7B3FC7, onion: 0xD8D0B0,
    carrot: 0xE57C22, pumpkin: 0xD8731E, watermelon: 0x5CB85C,
    bone: 0xDDCCBB, feather: 0x66CCFF, meat: 0xB03030, leather: 0xA07040,
    fire_essence: 0xFF4400, ice_essence: 0x44AAFF, ancient_crystal: 0xFFAA00,
  }

  /** 依資源類型生成掉落物（如 tree → wood） */
  function spawnDrop(worldX: number, worldY: number, resourceType: ResourceType): DropSnapshot[] {
    const dropDefs = RESOURCE_CONFIG[resourceType]?.drops
    if (!dropDefs) return []
    const spawned: DropSnapshot[] = []
    for (const def of dropDefs) {
      spawned.push(_spawnDropSprite(worldX, worldY, resourceType, def.itemId, def.amount))
    }
    return spawned
  }

  /** 依 itemId 直接生成掉落物（怪物骨頭/農場產出等） */
  function spawnDropByItemId(worldX: number, worldY: number, itemId: string, amount: number): void {
    const drop = _spawnDropSprite(worldX, worldY, 'wood' as ResourceType, itemId, amount)
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta',
        tick: GameStateManager_.get().tick,
        delta: { drops: [drop] } as any,
      })
    }
  }

  /** 共用渲染邏輯 */
  function _spawnDropSprite(
    worldX: number, worldY: number,
    resourceType: ResourceType,
    itemId: string, amount: number,
    snapshot?: DropSnapshot
  ): DropSnapshot {
    const id  = snapshot?.id ?? `drop_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const ox  = snapshot ? 0 : (Math.random() - 0.5) * 28
    const oy  = snapshot ? 0 : (Math.random() - 0.5) * 20
    const wx  = snapshot?.worldX ?? worldX + ox
    const baseY = snapshot?.worldY ?? worldY + oy

    if (drops.has(id)) return snapshot ?? { id, resourceType, itemId, amount, worldX: wx, worldY: baseY }

    const c = new PIXI.Container()
    c.x = wx; c.y = baseY

    const col = DROP_COLORS[itemId] ?? 0xBBBBBB

    // 光暈（兩層半透明圓）
    const glow = new PIXI.Graphics()
    glow.circle(0, 0, 22).fill({ color: col, alpha: 0.25 })
    glow.circle(0, 0, 15).fill({ color: col, alpha: 0.30 })

    // 主圓（比原來更大：12 vs 8）
    const dg = new PIXI.Graphics()
    dg.circle(0, 0, 12).fill(col)
    dg.circle(0, 0, 12).stroke({ color: 0x000000, width: 1.5 })
    dg.circle(-3, -4, 4).fill({ color: 0xffffff, alpha: 0.42 })

    const lbl = new PIXI.Text({
      text: `×${amount}`,
      style: { fontSize: 11, fill: 0xffffff,
        dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 1 } },
    })
    lbl.anchor.set(0.5, 1); lbl.y = -14
    c.addChild(glow, dg, lbl)
    dropLayer.addChild(c)

    const phase = Math.random() * Math.PI * 2
    const bobTick = () => {
      const t = performance.now() / 600 + phase
      c.y = baseY + Math.sin(t) * 3
      // 光暈呼吸脈衝
      glow.alpha = 0.55 + Math.sin(t * 1.6) * 0.45
    }
    PIXI.Ticker.shared.add(bobTick)

    drops.set(id, { id, resourceType, itemId, amount,
      worldX: wx, worldY: baseY, sprite: c, bobTick })
    return { id, resourceType, itemId, amount, worldX: wx, worldY: baseY }
  }

  // ── 水面碰撞檢查（工具函數） ─────────────────────────────────
  function isWater(wx: number, wy: number): boolean {
    const world = GameStateManager_.getWorld()
    if (!world?.chunks?.length) return false
    const isTileWater = tileMap.getTileAt(wx, wy, world) === 'water'

    // 如果是水，檢查是否有已完成的木橋在此位置
    if (isTileWater) {
      const TILE_SIZE = 48
      const hasCompletedBridge = (world.buildings ?? []).some(b => {
        if (b.defId !== 'wooden_bridge') return false
        // 只檢查已完成的橋樑（不在建造進度中）
        if (buildingSystem.isBuilding(b.id)) return false
        // 檢查玩家位置是否在橋的範圍內（1x1，b.x/b.y 是左上角）
        return wx >= b.x && wx < b.x + TILE_SIZE &&
               wy >= b.y && wy < b.y + TILE_SIZE
      })
      return !hasCompletedBridge  // 有已完成的橋則返回 false（不是水）
    }
    return isTileWater
  }

  // 怪物只生成在陸地上，且不生在木橋上（守城怪可追人過橋，但不在橋上出生）
  monsterSpawner.setLandPosChecker((wx, wy) => {
    const world = GameStateManager_.getWorld()
    if (!world?.chunks?.length) return false
    const tile = tileMap.getTileAt(wx, wy, world)
    if (tile === null || tile === 'water') return false
    const isOnBridge = (world?.buildings ?? []).some(b => {
      if (b.defId !== 'wooden_bridge') return false
      if (buildingSystem.isBuilding(b.id)) return false  // 建造中的橋不算
      return wx >= b.x && wx < b.x + TILE_SIZE && wy >= b.y && wy < b.y + TILE_SIZE
    })
    return !isOnBridge
  })

  // 供寶箱系統判斷哪些島已解鎖（中心格是陸地 = 已解鎖）
  treasureSpawner.setLandChecker((wx, wy) => {
    const world = GameStateManager_.getWorld()
    if (!world?.chunks?.length) return false
    return tileMap.getTileAt(wx, wy, world) !== 'water'
  })

  // 注入水域檢查到 BuildingSystem（木橋必須水上、其他建築必須陸地）
  // 對於 isWater：使用原始 tile 判斷（傳入位置在橋上時會回傳 false，但這對放置邏輯影響不大）
  buildingSystem.setWaterChecker((wx, wy) => {
    const world = GameStateManager_.getWorld()
    if (!world?.chunks?.length) return false
    return tileMap.getTileAt(wx, wy, world) === 'water'
  })

  // 注入玩家位置（放置建築時不可覆蓋任何玩家）
  buildingSystem.setPlayersGetter(() => {
    return [...players.values()].map(p => ({ x: p.x, y: p.y }))
  })

  // 注入重生點（建築不可蓋在重生點保護區，避免重生後卡死）
  buildingSystem.setSpawnPointGetter(() => {
    const w = GameStateManager_.getWorld() as any
    return { x: w?.spawnX ?? WORLD_CONFIG.CENTER_X, y: w?.spawnY ?? WORLD_CONFIG.CENTER_Y }
  })

  // ── 資源節點碰撞（樹/石頭/礦物阻擋玩家通過） ─────────────────
  const NODE_COLLIDE_R: Record<string, number> = {
    tree: 14, rock: 18, iron: 18, gold: 18, crystal: 12,
  }
  function isBlockedByNode(wx: number, wy: number): boolean {
    const PLAYER_R = 10   // 玩家碰撞半徑
    for (const node of spawner.getAllNodes()) {
      const data = node.getData()
      if (data.hp <= 0) continue   // 已耗盡（隱形）的節點不阻擋
      const r  = (NODE_COLLIDE_R[data.type] ?? 16) + PLAYER_COLLISION_RADIUS
      const dx = wx - node.x
      const dy = wy - node.y
      if (dx * dx + dy * dy < r * r) return true
    }
    return false
  }

  // 建築碰撞檢查（玩家/怪物不能穿過建築）
  function isBlockedByBuilding(wx: number, wy: number): boolean {
    const world = GameStateManager_.getWorld()
    for (const b of (world.buildings ?? [])) {
      const bDef = BUILDING_DEFS[b.defId]
      if (!bDef) continue
      // 木橋與寶箱不阻擋
      if (b.defId === 'wooden_bridge' || b.defId === 'chest') continue
      // AABB 與圓的碰撞檢測
      const halfW = bDef.size.x * TILE_SIZE / 2
      const halfH = bDef.size.y * TILE_SIZE / 2
      const cx = b.x + halfW
      const cy = b.y + halfH
      const dx = Math.max(0, Math.abs(wx - cx) - halfW)
      const dy = Math.max(0, Math.abs(wy - cy) - halfH)
      if (dx * dx + dy * dy < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) return true
    }
    return false
  }
  // monsterSpawner 的 darkness getter 指向 dayNight
  monsterSpawner.setDarknessGetter(() => dayNight.darkness)
  monsterSpawner.setDeathVisualCallback((x, y) => {
    fxLayer.spawnMonsterBloodBurst(x, y)
  })

  // 怪物擊殺 → 金幣 + XP + 骨頭 + Quest
  monsterSpawner.setKillCallback((drop, killerId) => {
    const kp = GameStateManager_.getPlayer(killerId)
    if (!kp) return
    kp.gold = Math.floor(kp.gold ?? 0) + drop.goldReward
    GameStateManager_.setPlayer(killerId, kp)
    const updated = grantCombatXp(killerId, drop.xpReward, drop.x, drop.y) ?? kp
    fxLayer.spawnFloatingText(drop.x, drop.y - 20, `+${drop.goldReward}🪙`, 0xFFD700)
    // 有配方用途的素材直接入背包；只能賣錢的掉落在地上讓玩家自行決定
    if (drop.meatDrop)    Inventory.add(killerId, 'meat',    1)
    if (drop.leatherDrop) Inventory.add(killerId, 'leather', 1)
    if (drop.boneDrop)    spawnDropByItemId(drop.x, drop.y, 'bone',    1)
    if (drop.featherDrop) spawnDropByItemId(drop.x, drop.y, 'feather', 1)
    if (drop.dungeonMapDrop) spawnDropByItemId(drop.x, drop.y, 'dungeon_map', 2)
    // Quest 追蹤
    questSystem.add('kills', 1)
    questSystem.add('gold_earned', drop.goldReward)
    // 廣播玩家金幣 + XP + 等級更新
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [killerId]: {
          gold: updated.gold,
          xp: updated.xp,
          level: updated.level,
          hp: updated.hp,
          maxHp: updated.maxHp,
        } } },
      })
    }
  })

  dungeonScene.setBossKillCallback(() => {
    if (!myPlayerId) return
    const meBoss = players.get(myPlayerId)
    if (!meBoss) return
    fxLayer.spawnFloatingText(meBoss.x, meBoss.y - 50, t('game.boss_killed'), 0xffcc44)
    // 擊殺 Boss 額外獎勵 3 顆晶體
    Inventory.add(myPlayerId, 'crystal', 3)
    hotbarUI.show(Inventory.get(myPlayerId))
    fxLayer.spawnFloatingText(meBoss.x, meBoss.y - 28, t('game.crystal_bonus'), 0x66ddff)
  })

  // 怪物攻擊建築（陷阱觸發 / 守城怪撞牆）
  monsterSpawner.setHitBuildingCallback((buildingId, damage) => {
    const destroyed = buildingSystem.takeDamage(buildingId, damage)
    if (destroyed) {
      const b = buildingSystem.getAll().find(b => b.id === buildingId)
      if (b) {
        const bx = b.x + TILE_SIZE / 2, by = b.y + TILE_SIZE / 2
        fxLayer.spawnFloatingText(bx, by - 20, t('game.building_damaged'), 0xFF6600)
      }
    }
    if (RoomManager.role === 'host') {
      const b = buildingSystem.getAll().find(b => b.id === buildingId)
      if (b) NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { buildings: { [buildingId]: { hp: b.hp } } } as any,
      })
    }
  })

  // 注入建築列表給怪物 AI（Host 端每幀更新）
  monsterSpawner.setGetBuildings(() =>
    buildingSystem.getAll()
      .filter(b => BUILDING_DEFS[b.defId])
      .map(b => {
        const def = BUILDING_DEFS[b.defId]
        return { id: b.id, defId: b.defId, x: b.x, y: b.y, sizeX: def.size.x, sizeY: def.size.y, hp: b.hp }
      })
  )

  // 追蹤重生冷卻中的玩家（避免重複觸發死亡）
  const deadPlayers = new Set<string>()

  // Host 端：client 的持續移動輸入（edge-triggered，按下/放開才送一次）
  const heldMoves = new Map<string, { dx: number; dy: number }>()
  // Host 端：本 tick 內有移動的玩家，每 4 tick 合併成一則 state_delta 廣播
  const dirtyMovedPlayers = new Set<string>()

  // 公用重生函式（host 呼叫後廣播；本地端也呼叫）
  function _respawnPlayer(playerId: string): void {
    // 若在遺跡內死亡，先離開遺跡，否則重生點是世界座標、人卻仍被當成在遺跡內，
    // 移動碰撞會用 dungeonScene.isFloor() 判定 → 整個卡住無法移動
    if (playerId === myPlayerId && inDungeon) _exitDungeon()
    const worldD = GameStateManager_.getWorld()
    // 重生點可能被建築等碰撞體蓋住 → 找最近的安全點，避免重生後卡死
    const { x: spawnX, y: spawnY } = findSafeSpawn(
      (worldD as any).spawnX ?? WORLD_CONFIG.CENTER_X,
      (worldD as any).spawnY ?? WORLD_CONFIG.CENTER_Y,
    )
    const pdR = GameStateManager_.getPlayer(playerId)
    let xpLost = 0
    if (pdR) {
      // 死亡懲罰：損失 50% 當前等級進度 XP
      xpLost    = Math.floor((pdR.xp ?? 0) * 0.5)
      pdR.xp    = (pdR.xp ?? 0) - xpLost
      applyCombatStats(pdR)
      pdR.hp    = pdR.maxHp ?? 100
      pdR.x     = spawnX
      pdR.y     = spawnY
      GameStateManager_.setPlayer(playerId, pdR)
    }
    const pR = players.get(playerId)
    if (pR) { pR.sprite.x = spawnX; pR.sprite.y = spawnY }
    deadPlayers.delete(playerId)
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: {
          hp: pdR?.maxHp ?? 100, maxHp: pdR?.maxHp ?? 100, x: spawnX, y: spawnY,
          xp: pdR?.xp, level: pdR?.level,
        } } },
      })
    }
    if (playerId === myPlayerId) {
      if (pdR) hud.update({ hp: pdR.hp, maxHp: pdR.maxHp ?? 100, xp: pdR.xp, level: pdR.level } as any)
      if (xpLost > 0) fxLayer.spawnFloatingText(spawnX, spawnY - 60, `-${xpLost} XP 💀`, 0xFF8866)
      fxLayer.spawnFloatingText(spawnX, spawnY - 40, t('game.respawn'), 0xAAFFAA)
    }
  }

  // 怪物攻擊玩家（含防具減傷）
  monsterSpawner.setHitPlayerCallback((playerId, damage) => {
    if (deadPlayers.has(playerId)) return         // 重生冷卻期間免疫傷害
    const pd = GameStateManager_.getPlayer(playerId)
    if (!pd) return
    applyCombatStats(pd)
    const { actualDamage, totalDefPct } = getPlayerDamageTaken(playerId, damage)
    pd.hp = Math.round(Math.max(0, pd.hp - actualDamage) * 10) / 10
    GameStateManager_.setPlayer(playerId, pd)
    const p = players.get(playerId)
    const dmgText = totalDefPct > 0
      ? `-${actualDamage}❤️ (${Math.round(totalDefPct * 100)}% ${t('game.defense_pct')})`
      : `-${actualDamage}❤️`
    if (p) fxLayer.spawnFloatingText(p.x, p.y - 30, dmgText, 0xFF4444)
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: { hp: pd.hp, maxHp: pd.maxHp } } },
      })
    }
    // ── 死亡判定 ──────────────────────────────────────────────────
    if (pd.hp <= 0) {
      deadPlayers.add(playerId)
      if (p) fxLayer.spawnFloatingText(p.x, p.y - 55, t('game.killed'), 0xFF4444)
      setTimeout(() => _respawnPlayer(playerId), 2000)
    }
  })

  const ghost = new PIXI.Container()
  ghost.visible = false
  ghost.alpha   = 0.65
  ghost.zIndex  = 999999          // 永遠在最上層（放置預覽）
  buildingLayer.addChild(ghost)   // ghost 在 camera 內，跟著世界座標走

  function startPlacement(defId: string): void {
    placingDefId = defId
    const def = BUILDING_DEFS[defId]
    ghost.removeChildren()
    const g = new PIXI.Graphics()
    const w = def.size.x * TILE_SIZE
    const h = def.size.y * TILE_SIZE
    g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.55 })
    g.rect(0, 0, w, h).stroke({ color: 0xffffff, width: 2 })
    const label = new PIXI.Text({ text: def.name, style: { fontSize: 9, fill: 0xffffff } })
    label.x = 3; label.y = 2
    ghost.addChild(g, label)
    ghost.visible = true
    document.body.style.cursor = 'crosshair'
  }

  function cancelPlacement(): void {
    placingDefId = null
    ghost.visible = false
    document.body.style.cursor = ''
  }


  /** 畫面座標 → 世界座標（含 camera offset 和縮放） */
  function screenToWorld(clientX: number, clientY: number) {
    const rect  = app.canvas.getBoundingClientRect()
    const sx    = (clientX - rect.left) / rect.width  * app.screen.width
    const sy    = (clientY - rect.top)  / rect.height * app.screen.height
    return { x: (sx - camera.x) / CAMERA_ZOOM, y: (sy - camera.y) / CAMERA_ZOOM }
  }

  function flashSelectorInvalid(): void {
    selectorFlashUntil = performance.now() + 140
  }

  function getInteractionRadius(): number {
    const activeWeaponRange = getWeaponDef(hotbarUI.activeItem?.itemId).range
    return TILE_SIZE * Math.max(1, playerReach, activeWeaponRange)
  }

  function getPlayerCollisionCenter(x: number, y: number): { x: number; y: number } {
    return { x, y: y + PLAYER_COLLISION_CENTER_Y }
  }

  function isBlockedByWaterAt(x: number, y: number): boolean {
    const center = getPlayerCollisionCenter(x, y)
    const samples: Array<[number, number]> = [
      [0, 0],
      [0, -PLAYER_COLLISION_RADIUS],
      [0, PLAYER_COLLISION_RADIUS],
      [-PLAYER_COLLISION_RADIUS, 0],
      [PLAYER_COLLISION_RADIUS, 0],
    ]
    return samples.some(([ox, oy]) => isWater(center.x + ox, center.y + oy))
  }

  function isMovementBlockedAt(x: number, y: number): boolean {
    if (isBlockedByWaterAt(x, y)) return true
    const center = getPlayerCollisionCenter(x, y)
    if (isBlockedByNode(center.x, center.y)) return true
    if (isBlockedByBuilding(center.x, center.y)) return true
    if (treasureSpawner.isBlockedByChest(center.x, center.y, PLAYER_COLLISION_RADIUS)) return true
    return false
  }

  // 重生/讀檔/加入時的安全落點：若指定點被建築等碰撞體佔據，
  // 以 TILE_SIZE 為步長向外環狀搜尋最近的可站立位置
  function findSafeSpawn(x: number, y: number): { x: number; y: number } {
    if (!isMovementBlockedAt(x, y)) return { x, y }
    for (let ring = 1; ring <= 8; ring++) {
      for (let oy = -ring; oy <= ring; oy++) {
        for (let ox = -ring; ox <= ring; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue   // 只掃外圈
          const nx = x + ox * TILE_SIZE
          const ny = y + oy * TILE_SIZE
          if (!isMovementBlockedAt(nx, ny)) return { x: nx, y: ny }
        }
      }
    }
    return { x, y }   // 8 圈內找不到（幾乎不可能）→ 維持原點
  }

  function getInteractionOrigin(me: Player): { x: number; y: number } {
    return getPlayerCollisionCenter(me.x, me.y)
  }

  function getAimDir(me: Player): { dx: number; dy: number } {
    const origin = getInteractionOrigin(me)
    const dx = selectedPoint.hasPointer ? selectedPoint.x - origin.x : selectedDir.dx
    const dy = selectedPoint.hasPointer ? selectedPoint.y - origin.y : selectedDir.dy
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { dx: dx >= 0 ? 1 : -1, dy: 0 }
    }
    return { dx: 0, dy: dy >= 0 ? 1 : -1 }
  }

  function updateSelectedPointFromPointer(clientX: number, clientY: number): void {
    const me = players.get(myPlayerId)
    if (!me) return

    const mouse = screenToWorld(clientX, clientY)
    const origin = getInteractionOrigin(me)
    const radius = getInteractionRadius()
    const dx = mouse.x - origin.x
    const dy = mouse.y - origin.y
    const len = Math.hypot(dx, dy)
    const scale = len > radius && len > 0 ? radius / len : 1

    selectedPoint.clientX = clientX
    selectedPoint.clientY = clientY
    selectedPoint.x = origin.x + dx * scale
    selectedPoint.y = origin.y + dy * scale
    selectedPoint.hasPointer = true

    selectedDir = getAimDir(me)
  }

  function clearSelectedPoint(): void {
    selectedPoint.hasPointer = false
  }

  function assignPlayerSprites(state = GameStateManager_.get()): void {
    const ids = Object.keys(state.players ?? {})
    if (state.hostId) {
      ids.sort((a, b) => {
        if (a === state.hostId) return -1
        if (b === state.hostId) return 1
        return a.localeCompare(b)
      })
    } else {
      ids.sort()
    }
    ids.forEach((id, index) => {
      const data = state.players[id] as any
      if (data) data.spriteId = PLAYER_SPRITE_IDS[index % PLAYER_SPRITE_IDS.length]
    })
  }

  function upsertPlayerSprite(pData: import('./types').PlayerData): void {
    const existing = players.get(pData.id)
    if (existing) {
      if ((existing as any).spriteManifestId !== ((pData as any).spriteId ?? 'player')) {
        existing.destroy()
        players.delete(pData.id)
        const p = new Player(pData)
        players.set(pData.id, p)
        playerLayer.addChild(p.sprite)
        return
      }
      existing.syncFromServer(pData)
      return
    }
    const p = new Player(pData)
    players.set(pData.id, p)
    playerLayer.addChild(p.sprite)
  }

  function restoreWorldBuildings(world: import('./types').WorldData): void {
    for (const b of world.buildings ?? []) {
      buildingSystem.restoreBuilding(b)
    }
  }

  function syncClientFullState(state: import('./types').GameState): void {
    if (!myPlayerId && RoomManager.myId) {
      myPlayerId = RoomManager.myId
      setLocalInventoryUiPlayer(myPlayerId)
    }
    assignPlayerSprites(state)
    const world = state.world
    if ((world as any).nightCount != null) nightCount = (world as any).nightCount
    if ((world as any).dayCount != null || (world as any).dayTimeS != null) {
      dayNight.restore((world as any).dayCount ?? 1, (world as any).dayTimeS ?? 0)
    }
    if (world?.chunks?.length) {
      tileMap.render(world)
      waterPositions = tileMap.getWaterPositions()
      spawner.spawnAll(world)
      restoreWorldBuildings(world)
      if ((world as any).treasureChests?.length > 0) {
        treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
      }
    }
    for (const pData of Object.values(state.players ?? {})) {
      applyCombatStats(pData)
      GameStateManager_.setPlayer(pData.id, pData)
      upsertPlayerSprite(pData)
    }
    if (myPlayerId) {
      const myPData = state.players[myPlayerId]
      Inventory.init(myPlayerId)
      const myInventory = myPData?.inventory ?? []
      Inventory.setInventory(myPlayerId, myInventory)
      EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: myInventory })
      hotbarUI.show(myInventory)
    }
  }

  function refreshWorldClockSnapshot(): void {
    if (RoomManager.role !== 'host') return
    const world = GameStateManager_.getWorld() as any
    world.nightCount = nightCount
    world.dayCount = dayNight.currentDayCount
    world.dayTimeS = dayNight.currentTimeS
  }

  function normalizeMove(dx: number, dy: number): { dx: number; dy: number } {
    if (dx === 0 && dy === 0) return { dx: 0, dy: 0 }
    const len = Math.hypot(dx, dy)
    return { dx: dx / len, dy: dy / len }
  }

  function findNodeAtWorldPoint(worldX: number, worldY: number): import('./resources').ResourceNodeEntity | undefined {
    return spawner.getAllNodes().find((node) => {
      const data = node.getData()
      if (data.hp <= 0) return false
      return Math.hypot(node.x - worldX, node.y - worldY) <= TILE_SIZE * 0.75
    })
  }

  function findMonsterAtWorldPoint(worldX: number, worldY: number): import('./combat').MonsterEntity | undefined {
    return monsterSpawner.getAllMonsters().find((monster) =>
      monster.isAlive && Math.hypot(monster.x - worldX, monster.y - worldY) <= TILE_SIZE * 0.75
    )
  }

  type InteractionPrompt = {
    key: string
    code: string
    action: string
    targetType: 'building' | 'chest' | 'resource' | 'dungeon'
    targetId: string
    worldX: number
    worldY: number
  }

  function getInteractionRayPoints(): Array<{ x: number; y: number }> {
    const me = players.get(myPlayerId)
    if (!me) return []
    const origin = getInteractionOrigin(me)
    const target = selectedPoint.hasPointer
      ? { x: selectedPoint.x, y: selectedPoint.y }
      : {
          x: origin.x + selectedDir.dx * getInteractionRadius(),
          y: origin.y + selectedDir.dy * getInteractionRadius(),
        }
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const len = Math.hypot(dx, dy)
    if (len <= 0) return [origin]
    const steps = Math.max(1, Math.ceil(len / (TILE_SIZE / 4)))
    const points: Array<{ x: number; y: number }> = []
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      points.push({ x: origin.x + dx * t, y: origin.y + dy * t })
    }
    return points
  }

  function isPointInBuilding(point: { x: number; y: number }, building: import('./types').Building): boolean {
    const def = BUILDING_DEFS[building.defId]
    if (!def) return false
    const pad = 6
    return point.x >= building.x - pad &&
      point.x <= building.x + def.size.x * TILE_SIZE + pad &&
      point.y >= building.y - pad &&
      point.y <= building.y + def.size.y * TILE_SIZE + pad
  }

  function findPointedBuilding(
    predicate: (building: import('./types').Building) => boolean,
  ): import('./types').Building | undefined {
    for (const point of getInteractionRayPoints()) {
      const hit = buildingSystem.getAll().find((building) =>
        predicate(building) && isPointInBuilding(point, building)
      )
      if (hit) return hit
    }
    return undefined
  }

  function findPointedChest(): ReturnType<typeof treasureSpawner.findNearbyChest> {
    for (const point of getInteractionRayPoints()) {
      const chest = treasureSpawner.findNearbyChest(point.x, point.y, TILE_SIZE * 0.8)
      if (chest) return chest
    }
    return null
  }

  function makeBuildingPrompt(
    building: import('./types').Building,
    key: string,
    code: string,
    action: string,
  ): InteractionPrompt {
    const def = BUILDING_DEFS[building.defId]
    return {
      key, code, action,
      targetType: 'building',
      targetId: building.id,
      worldX: building.x + (def?.size.x ?? 1) * TILE_SIZE / 2,
      worldY: building.y + (def?.size.y ?? 1) * TILE_SIZE / 2,
    }
  }

  function getCurrentInteractionPrompt(): InteractionPrompt | null {
    if (!myPlayerId || placingDefId) return null
    const me = players.get(myPlayerId)
    if (!me) return null

    if (inDungeon) {
      if (dungeonScene.isNearExit(me.x, me.y)) {
        return { key: 'E', code: 'KeyE', action: t('game.prompt.leave_dungeon'), targetType: 'dungeon', targetId: 'exit', worldX: me.x, worldY: me.y }
      }
      const dc = dungeonScene.findNearbyChest(me.x, me.y, TILE_SIZE * 2)
      if (dc) {
        return { key: 'E', code: 'KeyE', action: t('game.prompt.open_dungeon_chest'), targetType: 'dungeon', targetId: dc.id, worldX: dc.x, worldY: dc.y }
      }
    }

    const chest = findPointedChest()
    if (chest && !openedChests.has(chest.id)) {
      return { key: 'R', code: 'KeyR', action: t('game.prompt.open_chest'), targetType: 'chest', targetId: chest.id, worldX: chest.sprite.x, worldY: chest.sprite.y }
    }

    const eActions: Record<string, string> = {
      furnace: t('game.prompt.use_furnace'),
      market: t('game.prompt.open_market'),
      research_lab: t('game.prompt.workstation'),
      base_core: t('game.prompt.view_base_core'),
      barracks: t('game.prompt.view_barracks'),
      goddess_statue: t('game.prompt.pray'),
    }
    const eBuilding = findPointedBuilding((building) => !!eActions[building.defId])
    if (eBuilding) return makeBuildingPrompt(eBuilding, 'E', 'KeyE', eActions[eBuilding.defId])

    const repairable = findPointedBuilding((building) =>
      isRepairableBuilding(building.defId) && building.hp <= 0
    )
    if (repairable) {
      const promptKey = isTrapBuilding(repairable.defId)
        ? 'game.prompt.repair_trap'
        : 'game.prompt.repair_building'
      return makeBuildingPrompt(repairable, 'R', 'KeyR', t(promptKey))
    }

    // 採集已改用滑鼠左鍵，資源節點不再顯示 R 提示
    return null
  }

  function tryHarvestNode(node: import('./resources').ResourceNodeEntity, playerId: string): boolean {
    const weapon = getWeaponDef(hotbarUI.activeItem?.itemId)
    const snap = node.getData()
    const afterHp = snap.hp - weapon.resDmg

    if (RoomManager.role === 'host') {
      node.hit(weapon.resDmg, playerId)
      if (afterHp <= 0) {
        _grantHarvestXP(playerId, snap.type as string, node.x, node.y)
      } else {
        NetworkHost.broadcast({
          type: 'state_delta',
          tick: GameStateManager_.get().tick,
          delta: { resources: { [node.id]: { hp: Math.max(0, afterHp) } } },
        })
      }
    } else {
      NetworkClient.send({
        type: 'input',
        playerId,
        input: { type: 'harvest', targetId: node.id, damage: weapon.resDmg, range: weapon.range } as any,
        tick: GameStateManager_.get().tick,
      })
    }
    return true
  }

  function tryAttackAtPointer(): boolean {
    if (!myPlayerId || placingDefId) return false
    const me = players.get(myPlayerId)
    if (!me) return false

    // 遺跡內：滑鼠攻擊也要能打遺跡怪（與 F/Space 同邏輯，遺跡怪不在世界怪清單裡）
    if (inDungeon) {
      const now2 = performance.now()
      const weapon2 = getWeaponDef(hotbarUI.activeItem?.itemId)
      if (now2 - lastAttackMs < weapon2.cooldown) return false
      const de = dungeonScene.findNearbyEnemy(me.x, me.y, TILE_SIZE * 3)
      if (!de) return false
      lastAttackMs = now2
      const actualDamage = getPlayerAttackDamage(myPlayerId, weapon2.damage)
      const killed = dungeonScene.hitEnemy(de.id, actualDamage)
      fxLayer.spawnFloatingText(de.x, de.y - 20, `-${actualDamage}`, killed ? 0xffff00 : 0xff8888)
      if (killed) {
        grantCombatXp(myPlayerId, 20, de.x, de.y)
      }
      return true
    }

    if (!findMonsterAtWorldPoint(selectedPoint.x, selectedPoint.y)) return false

    const now = performance.now()
    const weapon = getWeaponDef(hotbarUI.activeItem?.itemId)
    if (now - lastAttackMs < weapon.cooldown) return false

    const aim = getAimDir(me)
    lastAttackMs = now

    if (RoomManager.role === 'host') {
      const origin = getInteractionOrigin(me)
      _doAttack(myPlayerId, origin.x, origin.y, aim.dx, aim.dy, weapon.damage, weapon.range, weapon.arc)
    } else {
      NetworkClient.send({
        type: 'input',
        playerId: myPlayerId,
        tick: GameStateManager_.get().tick,
        input: {
          type: 'attack',
          dirX: aim.dx, dirY: aim.dy,
          damage: weapon.damage, range: weapon.range, arc: weapon.arc,
        } as any,
      })
    }

    fxLayer.spawnFloatingText(me.x, me.y - 20, weapon.itemId === 'fist' ? t('game.attack_fist') : t('game.attack_weapon'), 0xFFFFCC)
    return true
  }

  function tryHarvestAtPointer(): boolean {
    if (!myPlayerId || placingDefId) return false
    const node = findNodeAtWorldPoint(selectedPoint.x, selectedPoint.y)
    if (!node) {
      flashSelectorInvalid()
      return false
    }
    return tryHarvestNode(node, myPlayerId)
  }

  app.canvas.addEventListener('pointermove', (e) => {
    updateSelectedPointFromPointer(e.clientX, e.clientY)
    if (!placingDefId) return
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    const sx = Math.floor(x / TILE_SIZE) * TILE_SIZE
    const sy = Math.floor(y / TILE_SIZE) * TILE_SIZE
    ghost.x = sx; ghost.y = sy
    const ok = myPlayerId
      ? buildingSystem.canPlace(placingDefId, sx, sy, myPlayerId)
      : false
    ghost.tint = ok ? 0x88ff88 : 0xff6666
  })

  // 右鍵：投擲手榴彈（若快捷欄選中 grenade）
  app.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    if (!myPlayerId) return
    const activeItem = hotbarUI.activeItem?.itemId
    if (activeItem !== 'grenade') return
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    throwGrenade(x, y)
  })

  app.canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    updateSelectedPointFromPointer(e.clientX, e.clientY)
    players.get(myPlayerId)?.swingHeldTool()

    if (!placingDefId && myPlayerId) {
      if (tryAttackAtPointer()) return
      tryHarvestAtPointer()
      return
    }

    if (!placingDefId || !myPlayerId) return
    // 遺跡是臨時副本，禁止放置建築（避免建築殘留到下一座遺跡）
    if (inDungeon) {
      const meDp = players.get(myPlayerId)
      if (meDp) fxLayer.spawnFloatingText(meDp.x, meDp.y - 30, t('game.cant_build_dungeon'), 0xff8888)
      cancelPlacement()
      return
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    const sx = Math.floor(x / TILE_SIZE) * TILE_SIZE
    const sy = Math.floor(y / TILE_SIZE) * TILE_SIZE

    if (!buildingSystem.canPlace(placingDefId, sx, sy, myPlayerId)) return

    if (RoomManager.role === 'host') {
      const building = buildingSystem.place(myPlayerId, placingDefId, sx, sy)
      if (building) {
        NetworkHost.broadcast({
          type: 'state_delta',
          tick: GameStateManager_.get().tick,
          delta: { buildings: [building] },
        })
      }
    } else {
      NetworkClient.send({
        type: 'input',
        playerId: myPlayerId,
        input: { type: 'build', buildingDefId: placingDefId, x: sx, y: sy },
        tick: GameStateManager_.get().tick,
      })
    }
    cancelPlacement()
  })

  app.canvas.addEventListener('pointerleave', () => {
    clearSelectedPoint()
  })

  buildingUI.setOnStartPlacement(startPlacement)

  craftingUI.setOnCraft((recipeId, qty) => {
    if (!myPlayerId) return
    for (let i = 0; i < qty; i++) {
      if (!craftingSystem.canCraft(myPlayerId, recipeId)) break
      craftingSystem.craft(myPlayerId, recipeId)
    }
    // 製作後立即重新整理 UI（用 researchLevel 決定配方解鎖）
    const pd = GameStateManager_.getPlayer(myPlayerId)
    craftingUI.show(RECIPES, Inventory.get(myPlayerId), pd?.researchLevel ?? 1)
  })

  inventoryUI.setOnReorder((newInv) => {
    if (!myPlayerId) return
    Inventory.setInventory(myPlayerId, newInv)
    // 觸發 UI 更新（HotbarUI 監聽此事件）
    EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: newInv })
    // 多人同步：廣播新背包順序
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [myPlayerId]: { inventory: newInv } } },
      })
    }
  })

  furnaceUI.setOnSmelt((recipe, amount) => {
    if (!myPlayerId) return
    const me  = players.get(myPlayerId)
    const inv = Inventory.get(myPlayerId)
    const SMELT = {
      iron:      { oreId: 'iron' as const, ingotId: 'ingot' as const,      ratio: 3, oreName: '鐵礦', ingotName: '鐵錠', color: 0xCCCCCC, isCurrency: false },
      gold:      { oreId: 'gold' as const, ingotId: 'gold_ingot' as const,  ratio: 3, oreName: '金礦', ingotName: '金錠', color: 0xFFD700, isCurrency: false },
      gold_coin: { oreId: 'gold' as const, ingotId: 'gold_coin' as const,   ratio: 1, oreName: '金礦', ingotName: '金幣', color: 0xFFCC00, isCurrency: true  },
    }
    const def = SMELT[recipe as keyof typeof SMELT]
    if (!def) return
    const oreAvail = inv.find(i => i.itemId === def.oreId)?.amount ?? 0
    const maxIngots = Math.floor(oreAvail / def.ratio)
    const actual = Math.min(amount, maxIngots)
    if (actual <= 0) {
      if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.smelt_need_ore', { ore: t('item.' + def.oreId + '.name', undefined, def.oreName) }), 0xFF9966)
      return
    }
    const oreConsumed = actual * def.ratio
    Inventory.remove(myPlayerId, def.oreId, oreConsumed)
    if (def.isCurrency) {
      // 金礦換金幣：加到 pd.gold
      const pd2 = GameStateManager_.getPlayer(myPlayerId)
      if (pd2) { pd2.gold = (pd2.gold ?? 0) + actual; GameStateManager_.setPlayer(myPlayerId, pd2) }
    } else {
      Inventory.add(myPlayerId, def.ingotId, actual)
    }
    if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, `🔥 ${t('item.' + def.oreId + '.name', undefined, def.oreName)}×${oreConsumed} → ${t('item.' + def.ingotId + '.name', undefined, def.ingotName)}×${actual}`, def.color)
    hotbarUI.show(Inventory.get(myPlayerId))
    if (RoomManager.role === 'host') {
      const pd2 = GameStateManager_.getPlayer(myPlayerId)
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [myPlayerId]: { inventory: Inventory.get(myPlayerId), gold: pd2?.gold } } },
      })
    } else {
      NetworkClient.send({
        type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
        input: { type: 'furnace_smelt', recipe, amount: actual } as any,
      })
    }
  })

  // ── 市場系統 ───────────────────────────────────────────────
  marketUI.setOnSell((itemId, amount) => {
    if (!myPlayerId) return
    const me = players.get(myPlayerId)
    const inv = Inventory.get(myPlayerId)
    const item = inv.find(i => i.itemId === itemId)
    const actual = Math.min(amount, item?.amount ?? 0)
    if (actual <= 0) {
      if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.market_not_enough'), 0xFF6666)
      return
    }
    const goldEarned = marketPricing.calculateGold(itemId, actual, dayNight.currentDayCount)
    Inventory.remove(myPlayerId, itemId, actual)
    const pd = GameStateManager_.getPlayer(myPlayerId)
    if (pd) {
      pd.gold = Math.floor(pd.gold ?? 0) + goldEarned
      GameStateManager_.setPlayer(myPlayerId, pd)
      const itemDef = ITEMS[itemId]
      if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, `💰 ${t('item.' + itemId + '.name', undefined, itemDef?.name ?? itemId)} ×${actual} → +${goldEarned.toLocaleString()} 🪙`, 0xFFD700)
      hotbarUI.show(Inventory.get(myPlayerId))
      // 更新市場 UI 顯示（讓使用者繼續看到剩餘庫存）
      const pdAfterSell = GameStateManager_.getPlayer(myPlayerId)
      marketUI.refresh(Inventory.get(myPlayerId), pdAfterSell?.gold ?? 0)
      if (RoomManager.role === 'host') {
        NetworkHost.broadcast({
          type: 'state_delta', tick: GameStateManager_.get().tick,
          delta: { players: { [myPlayerId]: { gold: pd.gold, inventory: Inventory.get(myPlayerId) } } },
        })
      } else {
        NetworkClient.send({
          type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
          input: { type: 'market_sell', itemId, amount: actual } as any,
        })
      }
    }
  })

  // ── 市場購買（每日設計圖特賣）──────────────────────────────
  const MARKET_BUY_PRICE = 100_000
  marketUI.setOnBuy((itemId) => {
    if (!myPlayerId) return
    const pd = GameStateManager_.getPlayer(myPlayerId)
    if (!pd) return
    const me = players.get(myPlayerId)
    if ((pd.gold ?? 0) < MARKET_BUY_PRICE) {
      showUIToast(t('toast.gold_insufficient'), 0xFF6060)
      return
    }
    pd.gold = (pd.gold ?? 0) - MARKET_BUY_PRICE
    GameStateManager_.setPlayer(myPlayerId, pd)
    Inventory.add(myPlayerId, itemId, 1)
    hotbarUI.show(Inventory.get(myPlayerId))
    marketUI.refresh(Inventory.get(myPlayerId), pd.gold)
    const def = ITEMS[itemId]
    if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.market_get_item', { name: t('item.' + itemId + '.name', undefined, def?.name ?? itemId) }), 0xFFD700)
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [myPlayerId]: { gold: pd.gold, inventory: Inventory.get(myPlayerId) } } },
      })
    } else {
      NetworkClient.send({
        type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
        input: { type: 'market_buy', itemId, price: MARKET_BUY_PRICE } as any,
      })
    }
  })

  // ── 研究所升級 ─────────────────────────────────────────────
  researchUI.setOnUpgrade((toLevel) => {
    if (!myPlayerId) return
    const pd = GameStateManager_.getPlayer(myPlayerId)
    if (!pd) return

    // 檢查升級成本
    const upgradeCost = RESEARCH_UPGRADE_COSTS.find(c => c.level === toLevel)
    if (!upgradeCost) return

    // 檢查背包和金幣
    const inv = Inventory.get(myPlayerId)
    for (const mat of upgradeCost.materials) {
      const hasEnough = inv.some(i => i.itemId === mat.itemId && i.amount >= mat.amount)
      if (!hasEnough) {
        showUIToast(t('toast.material_insufficient'), 0xFF6666)
        return
      }
    }
    if ((pd.gold ?? 0) < upgradeCost.gold) {
      showUIToast(t('toast.gold_and_material_insuf'), 0xFF6666)
      return
    }

    // 扣除材料和金幣
    for (const mat of upgradeCost.materials) {
      Inventory.remove(myPlayerId, mat.itemId, mat.amount)
    }
    pd.gold = (pd.gold ?? 0) - upgradeCost.gold
    pd.researchLevel = (pd.researchLevel ?? 1) + 1   // 不管選哪條路線，一律 +1
    GameStateManager_.setPlayer(myPlayerId, pd)

    // 顯示升級進度
    researchUI.setUpgradeProgress(upgradeCost.durationSecs)
    showUIToast(t('toast.research_upgrading', { duration: upgradeCost.durationSecs }), 0x88DDFF)

    // 多人同步
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [myPlayerId]: { researchLevel: pd.researchLevel, gold: pd.gold, inventory: Inventory.get(myPlayerId) } } },
      })
    } else {
      NetworkClient.send({
        type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
        input: { type: 'research_upgrade', toLevel } as any,
      })
    }
  })

  // ── 基地核心升級回呼 ─────────────────────────────────────────
  baseCoreUI.setOnUpgrade((buildingId) => {
    if (!myPlayerId) return
    if (RoomManager.role === 'host') {
      const ok = buildingSystem.upgrade(myPlayerId, buildingId)
      if (ok) {
        const b  = buildingSystem.getAll().find(b2 => b2.id === buildingId)
        const me = players.get(myPlayerId)
        if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.core_upgrade', { level: b?.level ?? '?' }), 0xFFD700)
        hotbarUI.show(Inventory.get(myPlayerId))
        NetworkHost.broadcast({
          type: 'state_delta', tick: GameStateManager_.get().tick,
          delta: { buildings: { [buildingId]: { level: b?.level, hp: b?.hp, maxHp: b?.maxHp } } } as any,
        })
      } else {
        showUIToast(t('toast.upgrade_max_or_no_mat'), 0xFF6666)
      }
    } else {
      NetworkClient.send({
        type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
        input: { type: 'build_upgrade', buildingId } as any,
      })
    }
  })

  // ── 兵營升級回呼 ─────────────────────────────────────────────
  barracksUI.setOnUpgrade((buildingId) => {
    if (!myPlayerId) return
    if (RoomManager.role === 'host') {
      const ok = buildingSystem.upgrade(myPlayerId, buildingId)
      if (ok) {
        const b  = buildingSystem.getAll().find(b2 => b2.id === buildingId)
        const me = players.get(myPlayerId)
        if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.barracks_upgrade', { level: b?.level ?? '?' }), 0xFFCC44)
        hotbarUI.show(Inventory.get(myPlayerId))
        NetworkHost.broadcast({
          type: 'state_delta', tick: GameStateManager_.get().tick,
          delta: { buildings: { [buildingId]: { level: b?.level, hp: b?.hp, maxHp: b?.maxHp } } } as any,
        })
      } else {
        showUIToast(t('toast.upgrade_max_or_no_mat'), 0xFF6666)
      }
    } else {
      NetworkClient.send({
        type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
        input: { type: 'build_upgrade', buildingId } as any,
      })
    }
  })

  // ── 拆除確認按鈕 ────────────────────────────────────────────
  demolishPanel.querySelector('#demolish-ok')!.addEventListener('click', () => {
    if (!demolishTargetId || !myPlayerId) { demolishPanel.style.display = 'none'; return }
    const tid = demolishTargetId
    demolishPanel.style.display = 'none'
    demolishTargetId = null

    if (RoomManager.role === 'host') {
      const building = buildingSystem.demolish(tid)
      if (building) {
        const def = BUILDING_DEFS[building.defId]
        def.cost.forEach(c => {
          const refund = Math.ceil(c.amount * 0.75)
          Inventory.add(myPlayerId!, c.itemId, refund)
        })
        hotbarUI.show(Inventory.get(myPlayerId!))
        const me = players.get(myPlayerId!)
        if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.demolish_done'), 0xFFBB44)
        NetworkHost.broadcast({
          type: 'state_delta', tick: GameStateManager_.get().tick,
          delta: { demolishedBuildings: [tid] } as any,
        })
      }
    } else {
      NetworkClient.send({
        type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
        input: { type: 'demolish_building', buildingId: tid } as any,
      })
    }
  })

  // ── 鍵盤輸入 ───────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp'    || e.code === 'KeyW') { inputState.up    = true; selectedDir = { dx:  0, dy: -1 } }
    if (e.code === 'ArrowDown'  || e.code === 'KeyS') { inputState.down  = true; selectedDir = { dx:  0, dy:  1 } }
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { inputState.left  = true; selectedDir = { dx: -1, dy:  0 } }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { inputState.right = true; selectedDir = { dx:  1, dy:  0 } }
    if (e.code === 'Escape') {
      inventoryUI.hide(); craftingUI.hide(); buildingUI.hide(); furnaceUI.hide()
      baseCoreUI.hide(); barracksUI.hide()
      cancelPlacement()
      mapOverlay.style.display = 'none'
      demolishPanel.style.display = 'none'; demolishTargetId = null
    }
    if (e.code === 'KeyQ')  { questUI.toggle() }

    // Backspace / Delete：拆除靠近的建築
    if (e.code === 'Backspace' || e.code === 'Delete') {
      if (!myPlayerId || placingDefId) return
      if (demolishPanel.style.display !== 'none') return  // 已開啟
      const me = players.get(myPlayerId)
      if (!me) return
      const DEMOLISH_R = TILE_SIZE * 2.5
      const target = buildingSystem.getAll()
        .filter(b => b.defId !== 'chest' && b.defId !== 'wooden_bridge')
        .find(b => {
          const def = BUILDING_DEFS[b.defId]; if (!def) return false
          return Math.hypot(b.x + def.size.x * TILE_SIZE / 2 - me.x, b.y + def.size.y * TILE_SIZE / 2 - me.y) < DEMOLISH_R
        })
      if (!target) return
      const def = BUILDING_DEFS[target.defId]
      demolishTargetId = target.id
      const refundLines = def.cost.length === 0
        ? `<div>${t('game.demolish_no_cost')}</div>`
        : def.cost.map(c => {
            const refund = Math.ceil(c.amount * 0.75)
            const itemDef = ITEMS[c.itemId]
            return `<div>↩ ${getItemIconMarkup(c.itemId, itemDef?.icon ?? '?')} ${t('item.' + c.itemId + '.name', undefined, itemDef?.name ?? c.itemId)} ×${refund}</div>`
          }).join('')
      document.getElementById('demolish-bname')!.textContent = `「${t('building.' + target.defId + '.name', undefined, def.name)}」Lv.${target.level}`
      document.getElementById('demolish-refund')!.innerHTML = refundLines
      demolishPanel.style.display = 'flex'
      e.preventDefault()
    }

    // E 鍵：熔爐冶煉 / 靠近女神像時祈禱
    if (e.code === 'KeyE') {
      if (!myPlayerId || placingDefId) return
      const me = players.get(myPlayerId)
      if (!me) return

      // ── 遺跡：進入 / 離開 ──
      {
        const me2 = players.get(myPlayerId)
        if (me2) {
          // 在遺跡內：靠近出口離開
          if (inDungeon) {
            if (dungeonScene.isNearExit(me2.x, me2.y)) {
              _exitDungeon()
              fxLayer.spawnFloatingText(me2.x, me2.y - 30, t('game.leave_dungeon'), 0x00ffaa)
              return
            }
            // 靠近遺跡寶箱
            const dc = dungeonScene.findNearbyChest(me2.x, me2.y, TILE_SIZE * 2)
            if (dc) {
              const result = dungeonScene.openChest(dc.id)
              if (result) {
                const rarityColor = { common: 0xc9a468, rare: 0x6fa8ff, epic: 0xffec80 }[result.rarity]
                let fy = me2.y - 30
                // 金幣
                if (result.gold > 0) {
                  const pd2 = GameStateManager_.getPlayer(myPlayerId)
                  if (pd2) {
                    pd2.gold = (pd2.gold ?? 0) + result.gold
                    GameStateManager_.setPlayer(myPlayerId, pd2)
                    fxLayer.spawnFloatingText(me2.x, fy, `💰 +${result.gold} 🪙`, 0xffd700)
                    hud.update({ gold: pd2.gold } as any)
                    fy -= 22
                  }
                }
                // 品級掉落物進背包
                for (const drop of result.loot) {
                  Inventory.add(myPlayerId, drop.itemId, drop.amount)
                  const idef = ITEMS[drop.itemId]
                  fxLayer.spawnFloatingText(me2.x, fy, `${idef?.icon ?? '📦'} ${idef?.name ?? drop.itemId} ×${drop.amount}`, rarityColor)
                  fy -= 22
                }
                hotbarUI.show(Inventory.get(myPlayerId))
              }
              return
            }
          } else {
            // 在世界中：手持遺跡地圖時按 E 進入遺跡
            if (hotbarUI.activeItem?.itemId === 'dungeon_map') {
              const pd3 = GameStateManager_.getPlayer(myPlayerId)
              if (pd3) {
                Inventory.remove(myPlayerId, 'dungeon_map', 1)
                hotbarUI.show(Inventory.get(myPlayerId))
                const instanceSeed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
                fxLayer.spawnFloatingText(me2.x, me2.y - 30, t('game.enter_dungeon'), 0xff9900)
                _enterDungeon(instanceSeed, me2.x, me2.y)
                return
              }
            }
          }
        }
      }


      // ── 熔爐：鐵礦→鐵錠 / 金礦→金錠（3:1） ──────────────────
      const furnaceBuilding = findPointedBuilding(b => b.defId === 'furnace')
      if (furnaceBuilding) {
        const inv       = Inventory.get(myPlayerId)
        const ironCount = inv.find(i => i.itemId === 'iron')?.amount ?? 0
        const goldCount = inv.find(i => i.itemId === 'gold')?.amount ?? 0
        furnaceUI.show(ironCount, goldCount)
        return
      }

      // ── 市場：賣資源換金幣 ───────────────────────────────────
      const marketBuilding = findPointedBuilding(b => b.defId === 'market')
      if (marketBuilding) {
        const pdMkt = GameStateManager_.getPlayer(myPlayerId)
        marketUI.show(Inventory.get(myPlayerId), pdMkt?.gold ?? 0, dayNight.currentDayCount)
        return
      }

      // ── 工作站：升級研究等級 ────────────────────────────────
      const researchLabBuilding = findPointedBuilding(b => b.defId === 'research_lab')
      if (researchLabBuilding) {
        const pd = GameStateManager_.getPlayer(myPlayerId)
        const currentLevel = pd?.researchLevel ?? 1
        researchUI.show(currentLevel)
        return
      }

      // ── 基地核心：升級介面 ───────────────────────────────────
      const coreBuilding = findPointedBuilding(b => b.defId === 'base_core')
      if (coreBuilding) {
        baseCoreUI.show(coreBuilding.id, coreBuilding.level, Inventory.get(myPlayerId))
        return
      }

      // ── 兵營：查看士兵狀態 + 升級 ──────────────────────────────
      const barracksBuilding = findPointedBuilding(b => b.defId === 'barracks')
      if (barracksBuilding) {
        barracksUI.show(barracksBuilding.id, barracksBuilding.level, Inventory.get(myPlayerId))
        return
      }

      // ── 床：彈到外太空，你還想享受和平的夜晚嗎 ────────────────
      const activeItemForBed = hotbarUI.activeItem?.itemId
      if (activeItemForBed === 'bed') {
        if (dayNight.isNight) {
          const dropX = me.x, dropY = me.y
          // 噴掉背包所有東西（床本身不掉，直接消耗）
          const bedInv = Inventory.get(myPlayerId)
          for (const slot of bedInv) {
            if (slot.itemId === 'bed') continue
            spawnDropByItemId(
              dropX + (Math.random() - 0.5) * TILE_SIZE * 8,
              dropY + (Math.random() - 0.5) * TILE_SIZE * 8,
              slot.itemId, slot.amount
            )
          }
          Inventory.setInventory(myPlayerId, [])
          hotbarUI.show(Inventory.get(myPlayerId))
          // 彈到外太空
          const pdBed = GameStateManager_.getPlayer(myPlayerId)
          if (pdBed) {
            pdBed.x = dropX; pdBed.y = dropY - 5000
            GameStateManager_.setPlayer(myPlayerId, pdBed)
            me.sprite.x = dropX; me.sprite.y = dropY - 5000
          }
          fxLayer.spawnFloatingText(dropX, dropY - 60, t('game.bed_launched'), 0xCCBBFF)
          dayNight.skipToMorning()
          // 1.5 秒後墜回原地 → 死亡 → 傳回重生點
          setTimeout(() => {
            fxLayer.spawnFloatingText(dropX, dropY - 30, t('game.bed_crash'), 0xff4444)
            // 短暫回到原地顯示特效
            const meBack = players.get(myPlayerId)
            if (meBack) { meBack.sprite.x = dropX; meBack.sprite.y = dropY }
            // 再 500ms 後死亡傳回重生點
            setTimeout(() => {
              const world2 = GameStateManager_.getWorld()
              const spawnX = (world2 as any).spawnX ?? WORLD_CONFIG.CENTER_X
              const spawnY = (world2 as any).spawnY ?? WORLD_CONFIG.CENTER_Y
              const pdDead = GameStateManager_.getPlayer(myPlayerId)
              const meDead = players.get(myPlayerId)
              if (pdDead) {
                pdDead.x = spawnX; pdDead.y = spawnY
                pdDead.hp = pdDead.maxHp ?? 100   // 重生回滿血
                GameStateManager_.setPlayer(myPlayerId, pdDead)
                hud.update({ hp: pdDead.hp, maxHp: pdDead.maxHp ?? 100 } as any)
              }
              if (meDead) { meDead.sprite.x = spawnX; meDead.sprite.y = spawnY }
              fxLayer.spawnFloatingText(spawnX, spawnY - 40, t('game.bed_dead_respawn'), 0xffffff)
            }, 500)
          }, 1500)
          return
        } else {
          fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.daytime_now'), 0xFFDD88)
          return
        }
      }

      // ── 女神像祈禱 ────────────────────────────────────────────
      const statue = findPointedBuilding(b => b.defId === 'goddess_statue')
      if (!statue) return
      const COOLDOWN_MS = 3 * 60 * 1000
      const now = performance.now()
      const lastPray = goddessCooldowns.get(statue.id) ?? 0
      if (now - lastPray < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - (now - lastPray)) / 1000)
        fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.goddess_cooldown', { remaining }), 0xFFDD88)
        return
      }
      goddessCooldowns.set(statue.id, now)
      if (RoomManager.role === 'host') {
        _goddessPray(statue.x + TILE_SIZE / 2, statue.y + TILE_SIZE / 2)
      } else {
        NetworkClient.send({
          type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
          input: { type: 'pray', statueId: statue.id, cx: statue.x + TILE_SIZE / 2, cy: statue.y + TILE_SIZE / 2 } as any,
        })
        fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.praying'), 0xFFD700)
      }
    }

    // F / Space 攻擊（格子式判定：玩家格 + 面向方向 N 格）
    if (e.code === 'KeyF' || e.code === 'Space') {
      if (!myPlayerId || placingDefId) return
      const me = players.get(myPlayerId)
      if (!me) return
      const now = performance.now()
      const weapon = getWeaponDef(hotbarUI.activeItem?.itemId)
      if (now - lastAttackMs < weapon.cooldown) return
      lastAttackMs = now

      // 遺跡內攻擊敵人
      if (inDungeon) {
        const me3 = players.get(myPlayerId)
        if (me3) {
          const de = dungeonScene.findNearbyEnemy(me3.x, me3.y, TILE_SIZE * 3)
          if (de) {
            const weapon2 = getWeaponDef(hotbarUI.activeItem?.itemId)
            const actualDamage = getPlayerAttackDamage(myPlayerId, weapon2.damage)
            const killed = dungeonScene.hitEnemy(de.id, actualDamage)
            fxLayer.spawnFloatingText(de.x, de.y - 20, `-${actualDamage}`, killed ? 0xffff00 : 0xff8888)
            if (killed) {
              grantCombatXp(myPlayerId, 20, de.x, de.y)
            }
            return
          }
        }
      }

      const aim = getAimDir(me)
      if (RoomManager.role === 'host') {
        const origin = getInteractionOrigin(me)
        _doAttack(myPlayerId, origin.x, origin.y,
          aim.dx, aim.dy,
          weapon.damage, weapon.range, weapon.arc)
      } else {
        NetworkClient.send({
          type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
          input: {
            type: 'attack',
            dirX: aim.dx, dirY: aim.dy,
            damage: weapon.damage, range: weapon.range, arc: weapon.arc,
          } as any,
        })
      }
      // 本地攻擊特效
      fxLayer.spawnFloatingText(me.x, me.y - 20, weapon.itemId === 'fist' ? t('game.attack_fist') : t('game.attack_weapon'), 0xFFFFCC)
    }

    // R 鍵：寶箱 > 修復陷阱 > 食物（採集已改用滑鼠左鍵）
    if (e.code === 'KeyR') {
      if (!myPlayerId || placingDefId) return
      const me = players.get(myPlayerId)
      if (!me) return

      // ── 開啟附近的寶箱（優先級最高） ─────────────────────────
      // 4 格互動距離：玩家停在寶箱碰撞半徑外（32+10=42px），需比停止距離大
      const nearbyChest = findPointedChest()
      if (nearbyChest) {
        if (!openedChests.has(nearbyChest.id)) {
          const loot = treasureSpawner.openChest(nearbyChest.id)   // 發 treasure:opened 事件
          openedChests.add(nearbyChest.id)
          // 物品飛散特效（像採集一樣）
          for (const { itemId, amount } of loot) {
            const icon = (ITEMS as Record<string, { icon?: string }>)[itemId]?.icon ?? '📦'
            fxLayer.spawnHarvest(nearbyChest.sprite.x, nearbyChest.sprite.y - 30, itemId as any, amount)
            fxLayer.spawnFloatingText(nearbyChest.sprite.x, nearbyChest.sprite.y - 50, `${icon} ×${amount}`, 0xFFDD88)
          }
          // 廣播 + 刪除視覺
          treasureSpawner.removeChest(nearbyChest.id)
          // 更新 world 中的寶箱快照（讓 autosave 保存已開啟狀態）
          ;(GameStateManager_.getWorld() as any).treasureChests = treasureSpawner.getAllChestsData()
          if (RoomManager.role === 'host') {
            NetworkHost.broadcast({
              type: 'state_delta', tick: GameStateManager_.get().tick,
              delta: { openedChests: Array.from(openedChests) } as any,
            })
          }
        }
        return
      }

      // ── 修復損壞的陷阱（hp <= 0，透明狀態） ──────────────────
      const nearbyRepairable = findPointedBuilding(b =>
        isRepairableBuilding(b.defId) && b.hp <= 0
      )
      if (nearbyRepairable) {
        const ok = buildingSystem.repair(myPlayerId, nearbyRepairable.id)
        if (ok) {
          const messageKey = isTrapBuilding(nearbyRepairable.defId)
            ? 'game.trap_repair_done'
            : 'game.building_repair_done'
          fxLayer.spawnFloatingText(me.x, me.y - 30, t(messageKey), 0x88FF88)
          hotbarUI.show(Inventory.get(myPlayerId))
          if (RoomManager.role === 'host') {
            NetworkHost.broadcast({
              type: 'state_delta', tick: GameStateManager_.get().tick,
              delta: { buildings: { [nearbyRepairable.id]: { hp: nearbyRepairable.hp } } } as any,
            })
          }
        } else {
          fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.trap_repair_no_mat'), 0xFF6666)
        }
        return
      }

      // ── 手電筒開關（手持手電筒時按 R 切換；切到其他格子仍維持狀態） ──
      if (hotbarUI.activeItem?.itemId === 'flashlight') {
        flashlightOn = !flashlightOn
        fxLayer.spawnFloatingText(me.x, me.y - 30, flashlightOn ? t('game.flashlight_on') : t('game.flashlight_off'), 0xFFEE88)
        return
      }

      // ── 食物模式 ──────────────────────────────────────────────
      const activeItemId = hotbarUI.activeItem?.itemId ?? ''
      const foodDef = FOOD_DEFS[activeItemId]
      if (foodDef) {
        if (lastFoodItemId !== activeItemId) { foodBiteCount = 0; lastFoodItemId = activeItemId }
        foodBiteCount++
        if (foodBiteCount >= foodDef.bites) {
          // 吃掉一個食物
          const removed = Inventory.remove(myPlayerId, activeItemId, 1)
          if (removed) {
            const pd = GameStateManager_.getPlayer(myPlayerId)
            if (pd) {
              ;(pd as any).hunger = Math.min(100, ((pd as any).hunger ?? 0) + foodDef.hungerRestore)
              GameStateManager_.setPlayer(myPlayerId, pd)
            }
            fxLayer.spawnFloatingText(me.x, me.y - 30, `+${foodDef.hungerRestore} 🍖`, 0xFFAA66)
            hotbarUI.show(Inventory.get(myPlayerId))
          } else {
            fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.no_food'), 0xFF6666)
          }
          foodBiteCount = 0
        } else {
          fxLayer.spawnFloatingText(me.x, me.y - 25, `${foodDef.icon} ${foodBiteCount}/${foodDef.bites}`, 0xFFDD88)
        }
        return
      }
    }

    // U 鍵：解鎖附近的鎖定島嶼
    if (e.code === 'KeyU') {
      if (!myPlayerId || placingDefId) return
      const me = players.get(myPlayerId)
      if (!me) return
      const world = GameStateManager_.getWorld()
      const unlocked: string[] = (world as any).unlockedIslands ?? ['0,0']
      const nearby = WorldGen.findNearbyLockedIsland(me.x, me.y, new Set(unlocked))
      if (!nearby) {
        fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.no_nearby_island'), 0xFFDD88)
        return
      }
      const myData = GameStateManager_.getPlayer(myPlayerId)
      if ((myData?.gold ?? 0) < nearby.cost) {
        fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.island_need_gold', { cost: nearby.cost }), 0xFF6666)
        return
      }
      if (RoomManager.role === 'host') {
        _unlockIsland(myPlayerId, nearby.ix, nearby.iy)
      } else {
        NetworkClient.send({
          type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
          input: { type: 'unlock_island', ix: nearby.ix, iy: nearby.iy } as any,
        })
      }
    }

    // G 鍵：裝備/卸下防具（快捷欄選中的防具）
    if (e.code === 'KeyG' && !e.ctrlKey && myPlayerId) {
      const activeItem = hotbarUI.activeItem
      if (activeItem) {
        const armorDef = getArmorDef(activeItem.itemId)
        if (!armorDef) {
          const me = players.get(myPlayerId)
          if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.cant_equip'), 0xFF8888)
        } else {
          const pd = GameStateManager_.getPlayer(myPlayerId)
          if (pd) {
            const prevArmor = (pd as any).equipped?.armor as string | undefined
            if (prevArmor === activeItem.itemId) {
              // 已裝備同一件 → 卸下
              ;(pd as any).equipped = { armor: null }
              Inventory.add(myPlayerId, activeItem.itemId, 1)
              GameStateManager_.setPlayer(myPlayerId, pd)
              hotbarUI.show(Inventory.get(myPlayerId))
              equipUI.clearArmor()
              const me = players.get(myPlayerId)
              if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.unequip_armor', { name: getArmorName(activeItem.itemId) }), 0xAAAAAA)
            } else {
              // 先退回舊防具
              if (prevArmor) Inventory.add(myPlayerId, prevArmor, 1)
              // 從背包扣除新防具
              Inventory.remove(myPlayerId, activeItem.itemId, 1)
              ;(pd as any).equipped = { armor: activeItem.itemId }
              GameStateManager_.setPlayer(myPlayerId, pd)
              hotbarUI.show(Inventory.get(myPlayerId))
              const def = ITEMS[activeItem.itemId]
              equipUI.updateArmor(activeItem.itemId, def?.icon ?? '🛡️', armorDef.name, armorDef.defPct)
              const me = players.get(myPlayerId)
              if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.equip_armor', { name: getArmorName(activeItem.itemId) }), 0x4dcc4d)
            }
          }
        }
      }
    }

    // M 鍵：切換地圖覆蓋層
    if (e.code === 'KeyM') {
      if (mapOverlay.style.display === 'flex') {
        mapOverlay.style.display = 'none'
      } else {
        mapOverlay.style.display = 'flex'
        renderMap()
      }
    }
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp'    || e.code === 'KeyW') inputState.up    = false
    if (e.code === 'ArrowDown'  || e.code === 'KeyS') inputState.down  = false
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') inputState.left  = false
    if (e.code === 'ArrowRight' || e.code === 'KeyD') inputState.right = false
  })

  // ── 攻擊判定 helper（Host 端執行，格子式判定） ────────────────
  // dirX/dirY：面向方向（-1/0/+1）；range：格數；arc：武器弧度（度）
  function _doAttack(
    attackerId: string,
    ax: number, ay: number,
    dirX: number, dirY: number,
    damage: number,
    range: number,
    arc: number,
  ): void {
    const T = TILE_SIZE
    // 玩家中心所在格子座標
    const ptx = Math.floor(ax / T)
    const pty = Math.floor(ay / T)
    // 垂直方向（旋轉 90 度）
    const perpX = -dirY, perpY = dirX
    // 弧度決定側格數
    const arcSide = arc <= 90 ? 0 : arc <= 200 ? 1 : 2

    // 收集所有命中格
    const hitTiles = new Set<string>()
    const addTile = (tx: number, ty: number) => hitTiles.add(`${tx},${ty}`)

    // 玩家自己的格
    addTile(ptx, pty)
    // 玩家格的側格（寬弧武器）
    for (let s = 1; s <= arcSide; s++) {
      addTile(ptx + perpX * s, pty + perpY * s)
      addTile(ptx - perpX * s, pty - perpY * s)
    }
    // 面向方向的格（1..range），各深度也含側格
    for (let i = 1; i <= range; i++) {
      const fx = ptx + dirX * i, fy = pty + dirY * i
      addTile(fx, fy)
      for (let s = 1; s <= arcSide; s++) {
        addTile(fx + perpX * s, fy + perpY * s)
        addTile(fx - perpX * s, fy - perpY * s)
      }
    }

    const actualDamage = getPlayerAttackDamage(attackerId, damage)

    // 對命中格內的怪物造成傷害
    for (const m of monsterSpawner.getAllMonsters()) {
      const mtx = Math.floor(m.x / T)
      const mty = Math.floor(m.y / T)
      if (hitTiles.has(`${mtx},${mty}`)) {
        monsterSpawner.hitMonster(m.id, actualDamage, attackerId)
      }
    }
  }

  // ── 小島解鎖（Host 執行） ─────────────────────────────────────
  function _unlockIsland(playerId: string, ix: number, iy: number): void {
    const world = GameStateManager_.getWorld()
    const unlocked: string[] = (world as any).unlockedIslands ?? ['0,0']
    const key = `${ix},${iy}`
    if (unlocked.includes(key)) return

    const pd = GameStateManager_.getPlayer(playerId)
    if (!pd) return
    const ring = Math.max(Math.abs(ix), Math.abs(iy))
    const cost = ISLAND_UNLOCK_COST[ring] ?? 9999
    if ((pd.gold ?? 0) < cost) {
      const me = players.get(playerId)
      if (me) fxLayer.spawnFloatingText(me.x, me.y - 30, t('game.island_need_gold_unlock', { cost }), 0xFF6666)
      return
    }

    pd.gold = (pd.gold ?? 0) - cost
    GameStateManager_.setPlayer(playerId, pd)

    const newUnlocked = new Set([...unlocked, key])
    const diff: Difficulty = (world as any).difficulty ?? 'normal'

    // 重新生成世界（保留建築）
    const newWorld = WorldGen.generate(world.seed, newUnlocked, diff) as any
    newWorld.buildings = world.buildings ?? []

    // 記錄哪些資源節點已存在（用 ID 判斷，保留現存節點，只生成新島的新節點）
    const existingIds = new Set(spawner.getAllNodes().map(n => n.getData().id))

    // 重繪磁磚
    tileMap.render(newWorld)
    waterPositions = tileMap.getWaterPositions()

    // 只生成新島的資源（ID 不在現存集合中）
    for (const res of (newWorld.resources as ResourceNode[])) {
      if (!existingIds.has(res.id)) {
        const newNode = spawner.spawnOne(res)
        newNode.playRespawnAnim()
      }
    }

    // ── 繼承舊世界的寶箱 + 為新島追加寶箱 ──────────────────────
    ;(newWorld as any).treasureChests = treasureSpawner.getAllChestsData()
    treasureSpawner.spawnForIsland(newWorld, ix, iy)
    ;(newWorld as any).treasureChests = treasureSpawner.getAllChestsData()

    GameStateManager_.setWorld(newWorld)

    // 視覺回饋
    const islandCenter = WorldGen.islandWorldCenter(ix, iy)
    fxLayer.spawnFloatingText(islandCenter.x, islandCenter.y - 40, t('game.island_unlocked'), 0xFFFF44)
    fxLayer.spawnFloatingText(islandCenter.x, islandCenter.y - 60, `-${cost} 🪙`, 0xFFAAAA)

    // 更新金幣 + 廣播完整世界給 Clients
    if (RoomManager.role === 'host') {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: { gold: pd.gold } } },
      })
      NetworkHost.broadcast({
        type: 'state_full', tick: GameStateManager_.get().tick,
        state: GameStateManager_.get(),
      } as any)
    }
  }

  // ── 女神像祈禱：在附近召喚大量資源（Host 執行） ─────────────
  function _goddessPray(cx: number, cy: number): void {
    if (RoomManager.role !== 'host') return
    const world = GameStateManager_.getWorld()
    if (!world?.chunks?.length) return

    const PRAY_R = 5 * TILE_SIZE
    const target  = 10 + Math.floor(Math.random() * 6)   // 10–15 個節點
    let   spawned = 0
    const newResources: Record<string, import('./types').ResourceNode> = {}

    fxLayer.spawnFloatingText(cx, cy - 30, t('game.goddess_arrived'), 0xFFD700)

    for (let attempt = 0; attempt < target * 10 && spawned < target; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const dist  = TILE_SIZE * 1.5 + Math.random() * PRAY_R
      const nx    = cx + Math.cos(angle) * dist
      const ny    = cy + Math.sin(angle) * dist

      if (tileMap.getTileAt(nx, ny, world) !== 'grass') continue
      const tooClose = spawner.getAllNodes().some(n =>
        Math.hypot(n.x - nx, n.y - ny) < TILE_SIZE * 1.6
      )
      if (tooClose) continue

      // 祈禱補資源時也抽完整草地資源池，避免長期只補單一種類。
      const resType = pickResourceForSpawn(ringAtWorld(nx, ny), 'grass') ?? 'tree'
      const cfg     = RESOURCE_CONFIG[resType]
      const newId   = `goddess_${Date.now()}_${spawned}_${Math.random().toString(36).slice(2)}`
      const nodeData: import('./types').ResourceNode = {
        id: newId, type: resType as import('./types').ResourceType,
        x: nx, y: ny, hp: cfg.hp, maxHp: cfg.hp, respawnTime: cfg.respawnTime,
      }
      const newNode = spawner.spawnOne(nodeData)
      newNode.playRespawnAnim()
      world.resources = (world.resources ?? []).filter(r => r.id !== newId)
      world.resources.push(newNode.getData())
      newResources[newId] = newNode.getData()
      spawned++
    }

    if (Object.keys(newResources).length > 0) {
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { resources: newResources },
      })
    }
    fxLayer.spawnFloatingText(cx, cy - 52, t('game.goddess_spawned', { count: spawned }), 0xAAFF88)
  }

  // ── EventBus 串連 ──────────────────────────────────────────

  // 玩家連線進來（Host 端）
  EventBus.on('network:connected', ({ playerId }) => {
    const pData = GameStateManager_.getPlayer(playerId)
    if (!pData) return
    applyCombatStats(pData)
    // 加入位置（上次記錄或預設出生點）可能被建築蓋住 → 修正到最近安全點
    // 在下方 sendTo state_full 之前修正，新玩家收到的就是正確座標
    const joinSafe = findSafeSpawn(pData.x, pData.y)
    pData.x = joinSafe.x
    pData.y = joinSafe.y
    GameStateManager_.setPlayer(playerId, pData)
    const p = new Player(pData)
    players.set(playerId, p)
    playerLayer.addChild(p.sprite)
    Inventory.init(playerId)
    // 恢復 Client 帶來的背包（join 訊息裡的 playerData.inventory）
    if (pData.inventory?.length) {
      Inventory.setInventory(playerId, pData.inventory)
    }
    // 更新 HUD 人數（+1 = Host 自己）
    refreshWorldClockSnapshot()
    assignPlayerSprites()
    NetworkHost.sendTo(playerId, {
      type: 'state_full',
      tick: GameStateManager_.get().tick,
      state: GameStateManager_.get(),
    } as any)
    hud.setPlayerCount(NetworkHost.getConnectedCount() + 1)
  })

  // 玩家斷線
  EventBus.on('network:disconnected', ({ playerId }) => {
    heldMoves.delete(playerId)
    players.get(playerId)?.destroy()
    players.delete(playerId)
    GameStateManager_.removePlayer(playerId)
    hud.setPlayerCount(NetworkHost.getConnectedCount() + 1)
  })

  // 收到輸入（Host 端處理）
  EventBus.on('network:input', ({ playerId, input }) => {
    if (RoomManager.role !== 'host') return

    if (input.type === 'move') {
      // edge-triggered：client 只在方向改變時送一次，Host 在 GameLoop 內每 tick 持續套用
      if (input.dx === 0 && input.dy === 0) heldMoves.delete(playerId)
      else heldMoves.set(playerId, { dx: input.dx, dy: input.dy })

    } else if (input.type === 'build') {
      if (!buildingSystem.canPlace(input.buildingDefId, input.x, input.y, playerId)) return
      const building = buildingSystem.place(playerId, input.buildingDefId, input.x, input.y)
      if (building) {
        NetworkHost.broadcast({
          type: 'state_delta',
          tick: GameStateManager_.get().tick,
          delta: { buildings: [building] },
        })
      }

    } else if ((input as any).type === 'attack') {
      const atk = input as any
      const p   = players.get(playerId)
      if (!p) return
      const origin = getInteractionOrigin(p)
      _doAttack(playerId, origin.x, origin.y,
        atk.dirX ?? 1, atk.dirY ?? 0,
        atk.damage, atk.range, atk.arc)

    } else if ((input as any).type === 'unlock_island') {
      const req = input as any
      _unlockIsland(playerId, req.ix, req.iy)

    } else if ((input as any).type === 'cheat_spawn_entity') {
      const req = input as any
      runCheatSpawnEntity(req.entityId, req.category, playerId)

    } else if ((input as any).type === 'cheat_set_gold') {
      const req = input as any
      runCheatSetGold(Number(req.amount), playerId)

    } else if ((input as any).type === 'cheat_set_time') {
      const req = input as any
      runCheatSetGameTime(req.target, req.dayOrTime)

    } else if ((input as any).type === 'cheat_fast_forward_time') {
      const req = input as any
      runCheatFastForwardTime(Number(req.seconds))

    } else if ((input as any).type === 'furnace_smelt') {
      // Client 熔爐冶煉：Host 驗證背包並更新
      const smel   = input as any
      const recipe: 'iron' | 'gold' | 'gold_coin' = smel.recipe ?? 'iron'
      const SMELT = {
        iron:      { oreId: 'iron' as const, ingotId: 'ingot' as const,      ratio: 3, isCurrency: false },
        gold:      { oreId: 'gold' as const, ingotId: 'gold_ingot' as const,  ratio: 3, isCurrency: false },
        gold_coin: { oreId: 'gold' as const, ingotId: 'gold_coin' as const,   ratio: 1, isCurrency: true  },
      }
      const def = SMELT[recipe]
      if (!def) return
      const inv  = Inventory.get(playerId)
      const oreAvail = inv.find(i => i.itemId === def.oreId)?.amount ?? 0
      const maxIngots = Math.floor(oreAvail / def.ratio)
      const amount = Math.min(smel.amount, maxIngots)
      if (amount > 0) {
        Inventory.remove(playerId, def.oreId, amount * def.ratio)
        if (def.isCurrency) {
          const pd2 = GameStateManager_.getPlayer(playerId)
          if (pd2) { pd2.gold = (pd2.gold ?? 0) + amount; GameStateManager_.setPlayer(playerId, pd2) }
          const pd3 = GameStateManager_.getPlayer(playerId)
          NetworkHost.broadcast({
            type: 'state_delta', tick: GameStateManager_.get().tick,
            delta: { players: { [playerId]: { inventory: Inventory.get(playerId), gold: pd3?.gold ?? 0 } } },
          })
        } else {
          Inventory.add(playerId, def.ingotId, amount)
          NetworkHost.broadcast({
            type: 'state_delta', tick: GameStateManager_.get().tick,
            delta: { players: { [playerId]: { inventory: Inventory.get(playerId) } } },
          })
        }
      }

    } else if ((input as any).type === 'build_upgrade') {
      // Client 請求升級建築（Host 驗證材料並執行）
      const req = input as any
      const ok  = buildingSystem.upgrade(playerId, req.buildingId)
      if (ok) {
        const b = buildingSystem.getAll().find(b2 => b2.id === req.buildingId)
        if (playerId === myPlayerId) hotbarUI.show(Inventory.get(playerId))
        NetworkHost.broadcast({
          type: 'state_delta', tick: GameStateManager_.get().tick,
          delta: { buildings: { [req.buildingId]: { level: b?.level, hp: b?.hp, maxHp: b?.maxHp } } } as any,
        })
      }

    } else if ((input as any).type === 'demolish_building') {
      // Client 請求拆除建築（Host 執行並廣播）
      const req = input as any
      const building = buildingSystem.demolish(req.buildingId)
      if (building) {
        const def = BUILDING_DEFS[building.defId]
        def.cost.forEach(c => {
          const refund = Math.ceil(c.amount * 0.75)
          Inventory.add(playerId, c.itemId, refund)
        })
        if (playerId === myPlayerId) hotbarUI.show(Inventory.get(playerId))
        NetworkHost.broadcast({
          type: 'state_delta', tick: GameStateManager_.get().tick,
          delta: { demolishedBuildings: [req.buildingId] } as any,
        })
      }

    } else if ((input as any).type === 'market_buy') {
      // Client 購買每日設計圖：Host 驗證金幣並給予物品
      const buy = input as any
      const buyItemId = buy.itemId as string
      const buyPrice  = 100_000
      const pdBuy = GameStateManager_.getPlayer(playerId)
      if (!pdBuy || (pdBuy.gold ?? 0) < buyPrice) return
      pdBuy.gold = (pdBuy.gold ?? 0) - buyPrice
      GameStateManager_.setPlayer(playerId, pdBuy)
      Inventory.add(playerId, buyItemId, 1)
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: { gold: pdBuy.gold, inventory: Inventory.get(playerId) } } },
      })

    } else if ((input as any).type === 'market_sell') {
      // Client 市場賣出：Host 驗證背包並扣除物品、給金幣
      const sell = input as any
      const sellItemId = sell.itemId as string
      const sellAmount = sell.amount as number
      if (marketPricing.getPrice(sellItemId, dayNight.currentDayCount) <= 0 || sellAmount <= 0) return
      const clientInv  = Inventory.get(playerId)
      const available  = clientInv.find(i => i.itemId === sellItemId)?.amount ?? 0
      const actual     = Math.min(sellAmount, available)
      if (actual <= 0) return
      const earned = marketPricing.calculateGold(sellItemId, actual, dayNight.currentDayCount)
      Inventory.remove(playerId, sellItemId, actual)
      const pdSell = GameStateManager_.getPlayer(playerId)
      if (pdSell) {
        pdSell.gold = Math.floor(pdSell.gold ?? 0) + earned
        GameStateManager_.setPlayer(playerId, pdSell)
      }
      NetworkHost.broadcast({
        type: 'state_delta', tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: { gold: pdSell?.gold ?? 0, inventory: Inventory.get(playerId) } } },
      })

    } else if ((input as any).type === 'pray') {
      // Client 祈禱女神像（Host 驗證冷卻再執行）
      const pray = input as any
      const COOLDOWN_MS = 3 * 60 * 1000
      const lastPray = goddessCooldowns.get(pray.statueId) ?? 0
      if (performance.now() - lastPray < COOLDOWN_MS) return
      goddessCooldowns.set(pray.statueId, performance.now())
      _goddessPray(pray.cx, pray.cy)

    } else if (input.type === 'harvest') {
      const node = spawner.getNode(input.targetId)
      if (!node) return
      // 距離檢查（允許 playerReach + 0.8 格容差，防作弊）
      const player = players.get(playerId)
      if (player) {
        const hdx = player.x - node.x, hdy = player.y - node.y
        const inputRange = Math.max(1, Math.min(20, Number((input as any).range) || 1))
        const maxDist = TILE_SIZE * (Math.max(playerReach, inputRange) + 0.8)
        if (hdx * hdx + hdy * hdy > maxDist * maxDist) return
      }
      // 先快照資料，避免 hit() 觸發 depleted → destroy 後取不到
      // damage 欄位由魔法泡泡傳入（預設 1）
      const harvestDmg = Math.max(1, (input as any).damage ?? 1)
      const nodeSnap   = node.getData()
      const afterHp    = nodeSnap.hp - harvestDmg
      node.hit(harvestDmg, playerId)
      const tick = GameStateManager_.get().tick
      if (afterHp <= 0) {
        // 耗盡：授予 XP + 素材直接給背包並送回
        _grantHarvestXP(playerId, nodeSnap.type as string, node.x, node.y)
        // 移除廣播由 resource:depleted 事件處理
      } else {
        // 只廣播 HP 變化
        NetworkHost.broadcast({
          type: 'state_delta', tick,
          delta: { resources: { [input.targetId]: { hp: Math.max(0, afterHp) } } },
        })
      }
    }
  })

  // Host 端資源耗盡 → 廣播移除給 Clients
  EventBus.on('resource:depleted', ({ nodeId }) => {
    if (RoomManager.role !== 'host') return
    const world = GameStateManager_.getWorld()
    world.resources = (world.resources ?? []).filter(r => r.id !== nodeId)
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { removedResources: [nodeId] },
    })
  })

  // 開背包（HUD 按鈕 / I 鍵都發這個 event，由這裡注入真正的背包資料）
  EventBus.on('ui:open_inventory', () => {
    if (!myPlayerId) return
    inventoryUI.show(Inventory.get(myPlayerId))
  })

  // 開製作台（HUD 按鈕 / C 鍵）
  EventBus.on('ui:open_crafting', () => {
    if (!myPlayerId) return
    const pd = GameStateManager_.getPlayer(myPlayerId)
    craftingUI.show(RECIPES, Inventory.get(myPlayerId), pd?.researchLevel ?? 1)
  })

  // 開建築面板（HUD 按鈕 / B 鍵，用 window 事件避免 GameEvents 型別限制）
  window.addEventListener('ui:open_building', () => {
    if (!myPlayerId) return
    buildingUI.show(BUILDING_DEFS, Inventory.get(myPlayerId))
  })

  // 儲存請求
  EventBus.on('save:request', async () => {
    try {
      if (RoomManager.role === 'host') {
        // Host：存世界 + 所有玩家（用相同的 saveName 覆寫）
        const world = GameStateManager_.getWorld() as any
        // 帶入日夜狀態（讓下次載入還原）
        world.nightCount = nightCount
        world.dayCount   = dayNight.currentDayCount
        world.dayTimeS   = dayNight.currentTimeS
        // 確保有存檔名稱（保險：理論上新世界創建時已設定）
        if (!currentMapName) currentMapName = `world_${world.seed}`
        await SaveManager.saveWorld(world, currentMapName)
        // 記錄 Host 自己在此地圖的位置
        const hostPlayer = players.get(myPlayerId)
        if (hostPlayer && world.seed !== undefined) {
          const mapPos: Record<string, { x: number; y: number }> =
            JSON.parse(localStorage.getItem('forager_map_pos') ?? '{}')
          mapPos[String(world.seed)] = { x: hostPlayer.x, y: hostPlayer.y }
          localStorage.setItem('forager_map_pos', JSON.stringify(mapPos))
        }
        for (const [pid, p] of players) {
          // GameStateManager_ 是金幣/XP/等級的真實來源；Player sprite 是位置的真實來源
          const gsData = GameStateManager_.getPlayer(pid) ?? {}
          const pPos   = p.getData()
          const data: any = { ...gsData, x: pPos.x, y: pPos.y, inventory: Inventory.get(pid) }
          if (pid === myPlayerId) {
            // 一起儲存背包內容
            data._bags = {
              bag_small: { ...smallBagContents },
              bag_large: { ...largeBagContents },
            }
            // 以「stableId + 世界 seed」為鍵存檔 → 每個世界各自獨立的玩家進度
            await SaveManager.savePlayer({ ...data, id: `${stableId}__${world.seed}` })
            // localStorage 只用來保留跨世界的「身分」（名稱/外觀），新世界建立玩家時沿用
            SyncProtocol.saveLocalPlayer(data)
          } else {
            await SaveManager.savePlayer(data)
          }
        }
      } else {
        // Client：存自己的玩家資料到 localStorage，並記錄此地圖的位置
        const me = players.get(myPlayerId)
        if (me) {
          // 更新 per-map 位置（key = worldSeed）
          const worldSeed = GameStateManager_.getWorld()?.seed
          if (worldSeed !== undefined) {
            const mapPos: Record<string, { x: number; y: number }> =
              JSON.parse(localStorage.getItem('forager_map_pos') ?? '{}')
            mapPos[String(worldSeed)] = { x: me.x, y: me.y }
            localStorage.setItem('forager_map_pos', JSON.stringify(mapPos))
          }
          const data = { ...me.getData(), inventory: Inventory.get(myPlayerId) }
          SyncProtocol.saveLocalPlayer(data)
        }
      }
      EventBus.emit('save:complete', {})
    } catch (err) {
      console.error('[Save] 存檔失敗：', err)
      const tip = document.createElement('div')
      tip.textContent = t('toast.save_failed', { error: String(err) })
      tip.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#3d1e1e;color:#ef9a9a;' +
        'border:1px solid #e53935;border-radius:8px;padding:8px 16px;font-size:0.9rem;z-index:200;'
      document.body.appendChild(tip)
      setTimeout(() => tip.remove(), 4000)
    }
  })

  EventBus.on('save:complete', () => {
    // 短暫在 HUD 顯示「已存檔」提示
    const tip = document.createElement('div')
    tip.textContent = t('toast.saved')
    tip.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#2e3d2e;color:#81c784;' +
      'border:1px solid #4caf50;border-radius:8px;padding:8px 16px;font-size:0.9rem;z-index:200;'
    document.body.appendChild(tip)
    setTimeout(() => tip.remove(), 2000)
  })

  // ── 水面閃光 timer（每 1.2 秒隨機挑幾格水面閃光） ──────────
  let waterPositions: { x: number; y: number }[] = []
  setInterval(() => {
    if (waterPositions.length === 0) return
    const count = Math.min(25, Math.floor(waterPositions.length * 0.008) + 5)
    for (let i = 0; i < count; i++) {
      const wp = waterPositions[Math.floor(Math.random() * waterPositions.length)]
      fxLayer.spawnWaterShimmer(wp.x, wp.y)
    }
  }, 1200)

  // ── Game Loop ──────────────────────────────────────────────
  // Client 端最後送出的移動方向（edge-triggered：改變才送）
  const lastSentMove = { dx: 0, dy: 0 }
  GameLoop.addCallback((_delta, tick) => {
    if (!myPlayerId) return
    if (!clientPlayerHydrationChecked) {
      clientPlayerHydrationChecked = true
      if (RoomManager.role === 'client' && !players.get(myPlayerId)) {
        const pData = GameStateManager_.getPlayer(myPlayerId)
        if (pData) {
          assignPlayerSprites()
          upsertPlayerSprite(GameStateManager_.getPlayer(myPlayerId) ?? pData)
        }
      }
    }

    // ── 本地玩家輸入（連續移動） ─────────────────────────────
    ;(EventBus as any).emit('interaction:prompt', getCurrentInteractionPrompt())

    const dx = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0)
    const dy = (inputState.down  ? 1 : 0) - (inputState.up   ? 1 : 0)
    // 本幀實際套用的移動方向（client 端 edge-triggered 發送用；停止時為 0,0）
    const frameMove = { dx: 0, dy: 0 }

    if (dx !== 0 || dy !== 0) {
      const mover = players.get(myPlayerId)
      let sdx = dx, sdy = dy
      if (mover) {
        if (inDungeon) {
          // 遺跡牆壁碰撞（只允許在地板範圍內移動）
          const halfR = PLAYER_COLLISION_RADIUS
          const newX = mover.x + sdx * 10
          const newY = mover.y + sdy * 10
          if (sdx !== 0) {
            const nx = newX
            if (!dungeonScene.isFloor(nx, mover.y)
              || !dungeonScene.isFloor(nx - halfR, mover.y)
              || !dungeonScene.isFloor(nx + halfR, mover.y)) sdx = 0
          }
          if (sdy !== 0) {
            const ny = newY
            if (!dungeonScene.isFloor(mover.x, ny)
              || !dungeonScene.isFloor(mover.x, ny - halfR)
              || !dungeonScene.isFloor(mover.x, ny + halfR)) sdy = 0
          }
        } else {
          if (sdx !== 0 && isMovementBlockedAt(mover.x + sdx * 10, mover.y)) sdx = 0
          // 水面碰撞
          if (sdy !== 0 && isMovementBlockedAt(mover.x, mover.y + sdy * 10)) sdy = 0
          // 資源節點碰撞（分軸檢查，允許沿邊滑動）
          // 若玩家本身已在節點範圍內（出生點重疊），跳過限制讓其自由逃脫
          // 建築碰撞（不能穿過建築）
        }
      }
      if (sdx !== 0 || sdy !== 0) {
        const move = normalizeMove(sdx, sdy)
        const input: PlayerInput = { type: 'move', dx: move.dx, dy: move.dy }
        if (RoomManager.role === 'host') {
          const hostPlayer = players.get(myPlayerId)
          if (hostPlayer) {
            hostPlayer.applyInput(input)
            dirtyMovedPlayers.add(myPlayerId)   // 每 4 tick 批次廣播（見下方 flush）
          }
        } else {
          const meC = players.get(myPlayerId)
          if (meC) {
            const predicted = prediction.predict(input, meC.x, meC.y, tick)
            meC.syncFromServer(predicted)
          }
          frameMove.dx = move.dx
          frameMove.dy = move.dy
        }
      }
    }

    // Client 端：方向改變（含停止 → 0,0）才送 input，Host 會持續套用最後方向
    if (RoomManager.role !== 'host'
      && (frameMove.dx !== lastSentMove.dx || frameMove.dy !== lastSentMove.dy)) {
      lastSentMove.dx = frameMove.dx
      lastSentMove.dy = frameMove.dy
      NetworkClient.send({
        type: 'input', playerId: myPlayerId,
        input: { type: 'move', dx: frameMove.dx, dy: frameMove.dy }, tick,
      })
    }

    // 更新所有玩家動畫，並同步 zIndex 實現 Y 排序（2.5D 深度遮擋）
    players.forEach(p => {
      p.update(_delta)
      p.sprite.zIndex = p.y + 22   // +22 讓玩家腳底對齊排序基線（對應放大後的腿高）
    })

    // 更新特效層 & 日夜循環 & 寶箱動畫 & 建築建造進度
    fxLayer.update(_delta)
    if (!inDungeon) monsterSpawner.update(_delta)
    // 夜晚遮罩尺寸安全網：偵測到畫面尺寸變動（含縮放）就重新撐滿
    if (app.screen.width !== lastDnW || app.screen.height !== lastDnH) {
      lastDnW = app.screen.width
      lastDnH = app.screen.height
      dayNight.resize(lastDnW, lastDnH)
    }
    dayNight.update(app.ticker.deltaMS)
    treasureSpawner.update()
    buildingSystem.update()

    // 遺跡每幀更新
    if (inDungeon && myPlayerId) {
      const meD = players.get(myPlayerId)
      if (meD) {
        dungeonScene.update(meD.x, meD.y, app.ticker.deltaMS, (dmg) => {
          const pdD = GameStateManager_.getPlayer(myPlayerId)
          if (!pdD) return
          applyCombatStats(pdD)
          const { actualDamage: actualDmg, totalDefPct } = getPlayerDamageTaken(myPlayerId, dmg)
          pdD.hp = Math.round(Math.max(0, pdD.hp - actualDmg) * 10) / 10
          GameStateManager_.setPlayer(myPlayerId, pdD)
          const dmgText = totalDefPct > 0
            ? `-${actualDmg} DMG (${Math.round(totalDefPct * 100)}% ${t('game.defense_pct')})`
            : `-${actualDmg} DMG`
          fxLayer.spawnFloatingText(meD.x, meD.y - 30, dmgText, 0xff4444)
          hud.update({ hp: pdD.hp, maxHp: pdD.maxHp ?? 100 } as any)
          // 遺跡中死亡
          if (pdD.hp <= 0 && !deadPlayers.has(myPlayerId)) {
            deadPlayers.add(myPlayerId)
            fxLayer.spawnFloatingText(meD.x, meD.y - 55, t('game.killed'), 0xFF4444)
            setTimeout(() => _respawnPlayer(myPlayerId), 2000)
          }
        })
      }
    }

    // ── Host 端：套用 client 的持續移動輸入 + 批次廣播移動 ──────
    if (RoomManager.role === 'host') {
      heldMoves.forEach((mv, pid) => {
        const player = players.get(pid)
        if (!player) return
        let sdx = mv.dx, sdy = mv.dy
        if (sdx !== 0 && isMovementBlockedAt(player.x + sdx * 10, player.y)) sdx = 0
        if (sdy !== 0 && isMovementBlockedAt(player.x, player.y + sdy * 10)) sdy = 0
        if (sdx === 0 && sdy === 0) return
        const move = normalizeMove(sdx, sdy)
        player.applyInput({ type: 'move', dx: move.dx, dy: move.dy })
        dirtyMovedPlayers.add(pid)
      })
      // 每 4 tick 把所有玩家移動合併成一則 state_delta（降低網路壓力）
      if (tick % 4 === 0 && dirtyMovedPlayers.size > 0) {
        const movedPlayers: Record<string, { x: number; y: number }> = {}
        dirtyMovedPlayers.forEach(pid => {
          const p = players.get(pid)
          if (p) movedPlayers[pid] = { x: p.x, y: p.y }
        })
        dirtyMovedPlayers.clear()
        NetworkHost.broadcast({
          type: 'state_delta', tick,
          delta: { players: movedPlayers },
        })
      }
    }

    // ── 怪物系統（Host 負責 AI + 廣播） ─────────────────────
    const nowMs = performance.now()
    if (RoomManager.role === 'host' && !inDungeon) {
      // 更新難度 / 夜晚計數 / 玩家所在環
      monsterSpawner.setDifficulty(currentDifficulty)
      monsterSpawner.setNightCount(nightCount)
      const me = players.get(myPlayerId)
      if (me) {
        const stridePx = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE
        const ix = (me.x - WORLD_CONFIG.CENTER_X) / stridePx
        const iy = (me.y - WORLD_CONFIG.CENTER_Y) / stridePx
        monsterSpawner.setPlayerRing(Math.round(Math.max(Math.abs(ix), Math.abs(iy))))
      }

      const pMap = new Map<string, { x: number; y: number; id: string }>()
      players.forEach((p, id) => pMap.set(id, { x: p.x, y: p.y, id }))
      const deltas = monsterSpawner.tick(nowMs, pMap)

      // 每 4 tick 廣播一次（降低網路壓力）
      if (tick % 4 === 0 && deltas.length > 0) {
        NetworkHost.broadcast({
          type: 'state_delta', tick,
          delta: { monsters: deltas } as any,
        } as any)
      }
    }

    // ── 基地核心加成（每幀計算，Host 端） ───────────────────────
    if (myPlayerId && RoomManager.role === 'host') {
      const me = players.get(myPlayerId)
      const pd = GameStateManager_.getPlayer(myPlayerId)
      if (me && pd) {
        const CORE_RANGE = 8 * TILE_SIZE
        const coreBuildings = buildingSystem.getAll().filter(b => b.defId === 'base_core' && b.hp > 0)
        let nearestCore: { b: typeof coreBuildings[0]; dist: number } | null = null
        for (const b of coreBuildings) {
          const cx = b.x + TILE_SIZE, cy = b.y + TILE_SIZE
          const dist = Math.hypot(me.x - cx, me.y - cy)
          if (!nearestCore || dist < nearestCore.dist) nearestCore = { b, dist }
        }
        if (nearestCore && nearestCore.dist < CORE_RANGE) {
          const lv = nearestCore.b.level
          const hpBonus  = lv > 1 ? (0.10 + (lv - 2) * 0.10) : 0  // +10% per lv from lv2
          const atkBonus = lv > 1 ? (0.10 + (lv - 2) * 0.08) : 0
          const regenPerSec = [0, 5, 8, 10, 12, 15, 18, 22, 28, 35][lv - 1] ?? 0
          // 被動回血（每 5 秒）
          const REGEN_INTERVAL = 5000
          if (!(pd as any)._coreRegenNext) (pd as any)._coreRegenNext = 0
          if (nowMs > (pd as any)._coreRegenNext && regenPerSec > 0) {
            const baseMaxHp = 100 + ((pd.level ?? 1) - 1) * 15
            const maxHp = baseMaxHp * (1 + hpBonus)
            pd.hp = Math.min((pd.hp ?? 0) + regenPerSec, maxHp)
            ;(pd as any)._coreRegenNext = nowMs + REGEN_INTERVAL
            GameStateManager_.setPlayer(myPlayerId, pd)
          }
          // 存下加成供攻擊計算用
          ;(globalThis as any).__coreAtkBonus = atkBonus
        } else {
          ;(globalThis as any).__coreAtkBonus = 0
        }
      }
    }

    // ── 手榴彈更新（飛行 + 爆炸，所有端同步執行視覺） ────────────
    if (grenades.length > 0) {
      for (let gi = grenades.length - 1; gi >= 0; gi--) {
        const g = grenades[gi]
        if (g.exploded) { grenades.splice(gi, 1); continue }
        const elapsed = nowMs - g.spawnMs
        const tProgress = Math.min(elapsed / g.fuseMs, 1)
        // 拋物線運動（x 線性，y 帶弧度）
        g.sprite.x = g.startX + (g.targetX - g.startX) * tProgress
        g.sprite.y = g.startY + (g.targetY - g.startY) * tProgress - Math.sin(tProgress * Math.PI) * 40
        g.sprite.rotation = tProgress * Math.PI * 4   // 旋轉效果
        if (elapsed >= g.fuseMs) {
          // 爆炸！
          g.exploded = true
          fxLayer.spawnDepletionBurst(g.targetX, g.targetY, 'gold')  // 借用金礦爆炸視覺
          fxLayer.spawnFloatingText(g.targetX, g.targetY - 20, t('game.grenade_explode'), 0xFF8822)
          dropLayer.removeChild(g.sprite)
          g.sprite.destroy()
          // Host 計算怪物傷害
          if (RoomManager.role === 'host') {
            const GRENADE_DMG = 60
            for (const m of monsterSpawner.getAllMonsters()) {
              const dist = Math.hypot(m.x - g.targetX, m.y - g.targetY)
              if (dist < GRENADE_RADIUS) {
                const dmg = Math.floor(GRENADE_DMG * (1 - dist / GRENADE_RADIUS * 0.4))
                monsterSpawner.hitMonster(m.id, dmg, myPlayerId)
                fxLayer.spawnFloatingText(m.x, m.y - 15, `-${dmg}`, 0xFF4422)
              }
            }
          }
        }
      }
    }

    // ── 士兵系統（Host only） ─────────────────────────────────
    if (RoomManager.role === 'host') {
      const allBarracks = buildingSystem.getAll().filter(b => b.defId === 'barracks' && b.hp > 0)
      for (const b of allBarracks) {
        // 統計此兵營存活士兵數
        const alive = soldiers.filter(s => s.barracksId === b.id && !s.dead).length
        const nextSpawn = barracksSpawnTimer.get(b.id) ?? 0
        if (alive < SOLDIER_MAX_PER_BARRACKS && nowMs >= nextSpawn) {
          spawnSoldier(b.id, b.x, b.y)
          barracksSpawnTimer.set(b.id, nowMs + SOLDIER_SPAWN_INTERVAL)
        }
      }
      // 處理已死亡士兵重生
      for (const s of soldiers) {
        if (s.dead && nowMs >= s.respawnAt) {
          const b = allBarracks.find(b2 => b2.id === s.barracksId)
          if (b) {
            s.x = b.x + TILE_SIZE; s.y = b.y + TILE_SIZE
            s.hp = s.maxHp; s.dead = false
            s.sprite.visible = true
          }
        }
      }
      // 士兵 AI：尋找最近怪物 → 移動 → 攻擊
      const allMonsters = monsterSpawner.getAllMonsters()
      const dtSec = app.ticker.deltaMS / 1000
      for (const s of soldiers) {
        if (s.dead) continue
        // 找最近怪物
        let nearestMon: typeof allMonsters[0] | null = null
        let nearestDist = TILE_SIZE * 12  // 追擊範圍 12 格
        for (const m of allMonsters) {
          const dist = Math.hypot(m.x - s.x, m.y - s.y)
          if (dist < nearestDist) { nearestDist = dist; nearestMon = m }
        }
        if (nearestMon) {
          if (nearestDist > SOLDIER_ATTACK_RANGE) {
            // 移動靠近
            const dx = nearestMon.x - s.x
            const dy = nearestMon.y - s.y
            const len = Math.hypot(dx, dy)
            s.x += (dx / len) * SOLDIER_SPEED * dtSec
            s.y += (dy / len) * SOLDIER_SPEED * dtSec
          } else if (nowMs - s.lastAttackMs >= SOLDIER_ATTACK_CD_MS) {
            // 攻擊
            monsterSpawner.hitMonster(nearestMon.id, SOLDIER_ATK, 'soldier')
            s.lastAttackMs = nowMs
            fxLayer.spawnFloatingText(nearestMon.x, nearestMon.y - 15, `-${SOLDIER_ATK}`, 0x88FF44)
          }
        }
        // 同步 sprite 位置
        s.sprite.x = s.x; s.sprite.y = s.y
        s.sprite.zIndex = s.y + 21
        // 若被怪物攻擊（簡化：每秒受到目標怪攻擊）
        if (nearestMon && nearestDist < SOLDIER_ATTACK_RANGE) {
          if (nowMs - s.lastAttackMs > SOLDIER_ATTACK_CD_MS * 1.5) {
            s.hp -= Math.floor(nearestMon.damage * 0.5)  // 士兵受怪物傷害
          }
          if (s.hp <= 0) {
            s.dead = true
            s.respawnAt = nowMs + SOLDIER_RESPAWN_MS
            s.sprite.visible = false
            fxLayer.spawnFloatingText(s.x, s.y - 20, t('game.soldier_dead'), 0xFF8844)
          }
        }
      }
      // 清理死亡士兵中已不存在的兵營
      for (let si = soldiers.length - 1; si >= 0; si--) {
        const s = soldiers[si]
        if (!allBarracks.find(b => b.id === s.barracksId)) {
          objectsLayer.removeChild(s.sprite)
          s.sprite.destroy()
          soldiers.splice(si, 1)
        }
      }

      // ── 農場產出（每 30 秒掉落漿果在地上） ─────────────────────
      const allFarms = buildingSystem.getAll().filter(b => b.defId === 'farm' && b.hp > 0)
      for (const farm of allFarms) {
        if (!farmProduceTimer.has(farm.id)) {
          farmProduceTimer.set(farm.id, nowMs + FARM_PRODUCE_INTERVAL)
        }
        if (nowMs >= farmProduceTimer.get(farm.id)!) {
          const fcx = farm.x + TILE_SIZE   // 2×2 農場中心
          const fcy = farm.y + TILE_SIZE
          spawnDropByItemId(fcx, fcy, 'berry', 2)
          fxLayer.spawnFloatingText(fcx, fcy - 20, `🌾 +${t('item.berry.name', undefined, '漿果')}`, 0xAAFF66)
          farmProduceTimer.set(farm.id, nowMs + FARM_PRODUCE_INTERVAL)
        }
      }

      // ── 防禦建築自動攻擊（tower / laser_tower / cannon_tower） ──────
      const defBuildings = buildingSystem.getAll().filter(
        b => ['tower', 'laser_tower', 'cannon_tower'].includes(b.defId) && b.hp > 0
      )
      for (const b of defBuildings) {
        const bCx = b.x + TILE_SIZE / 2
        const bCy = b.y + TILE_SIZE / 2
        const lv   = b.level

        // 各建築屬性
        const CONFIG = {
          tower:        { range: TILE_SIZE * 4,  dmg: 15,         cd: 2000, aoe: 0 },
          laser_tower:  { range: TILE_SIZE * 15, dmg: 50 + lv * 20, cd: 2000, aoe: 0 },
          cannon_tower: { range: TILE_SIZE * 8,  dmg: 20 + lv * 8,  cd: 3500, aoe: TILE_SIZE * 2 },
        }
        const cfg = CONFIG[b.defId as keyof typeof CONFIG]
        if (!cfg) continue

        const lastShotKey = `__tshot_${b.id}`
        const lastShotMs: number = (b as any)[lastShotKey] ?? 0
        if (nowMs - lastShotMs < cfg.cd) continue

        // 找最近怪物（菁英/Boss 優先）
        const allMon = monsterSpawner.getAllMonsters()
        let target = allMon.filter(m => m.isAlive && (m.isElite || m.isBoss))
          .sort((a, z) => Math.hypot(a.x - bCx, a.y - bCy) - Math.hypot(z.x - bCx, z.y - bCy))[0]
        if (!target) {
          target = allMon.filter(m => m.isAlive)
            .sort((a, z) => Math.hypot(a.x - bCx, a.y - bCy) - Math.hypot(z.x - bCx, z.y - bCy))[0]
        }
        if (!target) continue
        const distToTarget = Math.hypot(target.x - bCx, target.y - bCy)
        if (distToTarget > cfg.range) continue

        ;(b as any)[lastShotKey] = nowMs

        if (cfg.aoe > 0) {
          // 加農砲：爆炸傷害範圍
          fxLayer.spawnDepletionBurst(target.x, target.y, 'iron')
          for (const m of allMon) {
            const d = Math.hypot(m.x - target.x, m.y - target.y)
            if (d < cfg.aoe) {
              const actualDmg = Math.floor(cfg.dmg * (d < TILE_SIZE ? 1 : 0.5))
              monsterSpawner.hitMonster(m.id, actualDmg, b.id)
              fxLayer.spawnFloatingText(m.x, m.y - 12, `-${actualDmg}`, 0xFF6600)
            }
          }
          fxLayer.spawnFloatingText(bCx, bCy - 30, '💥', 0xFF8800)
        } else {
          // 瞭望塔 / 雷射塔：直線命中
          monsterSpawner.hitMonster(target.id, cfg.dmg, b.id)
          fxLayer.spawnFloatingText(target.x, target.y - 12, `-${cfg.dmg}`, 0xAAFF44)
          // 雷射塔：顯示光束特效（簡單白色線段，等正式渲染）
          if (b.defId === 'laser_tower') {
            fxLayer.spawnFloatingText(bCx, bCy - 30, '⚡', 0x66AAFF)
          } else {
            fxLayer.spawnFloatingText(bCx, bCy - 30, '🏹', 0xAAFF88)
          }
        }
      }
    }

    // ── 夜晚計數 ─────────────────────────────────────────────
    const isNightNow = dayNight.phase === 'night'
    if (!lastNightState && isNightNow) {
      questSystem.add('nights', 1)
      nightCount++
    }
    if (lastNightState && !isNightNow) {
      // 夜→日：守城結束，即時存檔（save:request 已在 handler 內做 host-only 守衛）
      EventBus.emit('save:request', {})
    }
    lastNightState = isNightNow

    // ── 飢餓系統 ──────────────────────────────────────────────
    if (myPlayerId) {
      // 每 10 秒消耗 2 點飢餓（0~100，10 格）
      if (nowMs - lastHungerDecay > 10_000) {
        lastHungerDecay = nowMs
        const pd = GameStateManager_.getPlayer(myPlayerId)
        if (pd) {
          ;(pd as any).hunger = Math.max(0, ((pd as any).hunger ?? 100) - 2)
          GameStateManager_.setPlayer(myPlayerId, pd)
        }
      }
      // 飢餓 > 80 時每 2 秒回 5 HP
      if (nowMs - lastHungerRegen > 2_000) {
        lastHungerRegen = nowMs
        const pd = GameStateManager_.getPlayer(myPlayerId)
        if (pd && ((pd as any).hunger ?? 100) > 80 && pd.hp < (pd.maxHp ?? 100)) {
          pd.hp = Math.round(Math.min(pd.maxHp ?? 100, pd.hp + 5) * 10) / 10  // 四捨五入到小數點第一位
          GameStateManager_.setPlayer(myPlayerId, pd)
          fxLayer.spawnFloatingText(
            players.get(myPlayerId)?.x ?? 0,
            (players.get(myPlayerId)?.y ?? 0) - 36,
            '+5 ❤️', 0xFF8888,
          )
          if (RoomManager.role === 'host') {
            NetworkHost.broadcast({
              type: 'state_delta', tick,
              delta: { players: { [myPlayerId]: { hp: pd.hp } } },
            })
          }
        }
      }
    }

    // ── 魔法泡泡自動採集 + 旋轉視覺 ─────────────────────────
    const meForOrb = players.get(myPlayerId)
    if (meForOrb && hotbarUI.activeItem?.itemId === 'laser_orb') {
      // 旋轉光球視覺
      if (!laserOrbGfx) {
        laserOrbGfx = new PIXI.Graphics()
        laserOrbGfx.circle(0, 0, 7).fill({ color: 0xBB55FF, alpha: 0.92 })
        laserOrbGfx.circle(0, 0, 7).stroke({ color: 0xFFAAFF, width: 1.5 })
        laserOrbGfx.circle(-2, -2, 3).fill({ color: 0xFFCCFF, alpha: 0.7 })
        objectsLayer.addChild(laserOrbGfx)
      }
      const orbAngle = performance.now() / 380
      const orbScale = 0.85 + Math.sin(performance.now() / 190) * 0.15
      laserOrbGfx.x = meForOrb.x + Math.cos(orbAngle) * 32
      laserOrbGfx.y = meForOrb.y + Math.sin(orbAngle) * 22
      laserOrbGfx.zIndex = laserOrbGfx.y + 9999
      laserOrbGfx.scale.set(orbScale)
      laserOrbGfx.visible = true

      // 自動採集
      const nowMs = performance.now()
      const laserDef = getWeaponDef('laser_orb')
      if (nowMs - laserLastHitMs >= laserDef.cooldown) {
        const LASER_R = laserDef.range * TILE_SIZE
        let closest: import('./resources').ResourceNodeEntity | undefined
        let closestDist = Infinity
        for (const node of spawner.getAllNodes()) {
          const nd = node.getData()
          if (nd.hp <= 0) continue
          const d = Math.hypot(node.x - meForOrb.x, node.y - meForOrb.y)
          if (d < LASER_R && d < closestDist) { closestDist = d; closest = node }
        }
        if (closest) {
          laserLastHitMs = nowMs
          if (RoomManager.role === 'host') {
            const snap    = closest.getData()
            const afterHp = snap.hp - laserDef.resDmg
            closest.hit(laserDef.resDmg, myPlayerId)
            if (afterHp > 0) {
              NetworkHost.broadcast({
                type: 'state_delta', tick,
                delta: { resources: { [closest.id]: { hp: Math.max(0, afterHp) } } },
              })
            }
          } else {
            NetworkClient.send({
              type: 'input', playerId: myPlayerId, tick: GameStateManager_.get().tick,
              input: { type: 'harvest', targetId: closest.id, damage: laserDef.resDmg, range: laserDef.range } as any,
            })
          }
          fxLayer.spawnFloatingText(closest.x, closest.y - 15, '🔮', 0xCC88FF)
        }
      }
    } else if (laserOrbGfx) {
      laserOrbGfx.visible = false
    }

    // 掉落物撿取（Host 本地玩家，2 格範圍自動撿）
    if (RoomManager.role === 'host' && drops.size > 0) {
      const pickedDropIds: string[] = []
      for (const [dropId, drop] of Array.from(drops)) {
        const pickerEntry = Array.from(players.entries()).find(([, picker]) =>
          Math.hypot(picker.x - drop.worldX, picker.y - drop.worldY) < TILE_SIZE * 2
        )
        if (!pickerEntry) continue

        const [pickerId] = pickerEntry
        Inventory.add(pickerId, drop.itemId, drop.amount, pickerId === myPlayerId)
        const pickerData = GameStateManager_.getPlayer(pickerId)
        if (pickerData) {
          pickerData.inventory = Inventory.get(pickerId)
          GameStateManager_.setPlayer(pickerId, pickerData)
        }
        if (pickerId !== myPlayerId) {
          NetworkHost.sendTo(pickerId, {
            type: 'state_delta',
            tick: GameStateManager_.get().tick,
            delta: { players: { [pickerId]: { inventory: Inventory.get(pickerId) } } },
          })
        }
        fxLayer.spawnHarvest(drop.worldX, drop.worldY - 10, drop.resourceType, drop.amount)
        PIXI.Ticker.shared.remove(drop.bobTick)
        drop.sprite.destroy()
        drops.delete(dropId)
        pickedDropIds.push(dropId)
      }
      if (pickedDropIds.length > 0) {
        NetworkHost.broadcast({
          type: 'state_delta',
          tick: GameStateManager_.get().tick,
          delta: { removedDrops: pickedDropIds } as any,
        })
      }
    }

    // 相機跟隨本地玩家（含縮放補償）
    const me = players.get(myPlayerId)
    if (me) {
      camera.x = Math.round(app.screen.width  / 2 - me.x * CAMERA_ZOOM)
      camera.y = Math.round(app.screen.height / 2 - me.y * CAMERA_ZOOM)
    }

    // 選格位置更新（跟著玩家 + selectedDir 方向）
    if (me && !placingDefId) {
      const origin = getInteractionOrigin(me)
      if (!selectedPoint.hasPointer) {
        selectedPoint.x = origin.x + selectedDir.dx * getInteractionRadius()
        selectedPoint.y = origin.y + selectedDir.dy * getInteractionRadius()
      } else {
        const mouse = screenToWorld(selectedPoint.clientX, selectedPoint.clientY)
        const dx = mouse.x - origin.x
        const dy = mouse.y - origin.y
        const len = Math.hypot(dx, dy)
        const radius = getInteractionRadius()
        const scale = len > radius && len > 0 ? radius / len : 1
        selectedPoint.x = origin.x + dx * scale
        selectedPoint.y = origin.y + dy * scale
      }
      paintSelectorGfx(selectorGfx, performance.now() < selectorFlashUntil ? 'invalid' : 'normal')
      selectorGfx.visible = true
      selectorGfx.x = selectedPoint.x
      selectorGfx.y = selectedPoint.y
    } else {
      selectorGfx.visible = false
    }

    // ── 鎖定島嶼圓圈高亮 + 費用標籤（靠近時才顯示） ─────────
    islandRingGfx.clear()
    if (me) {
      const world2       = GameStateManager_.getWorld()
      const ul2: string[]= (world2 as any)?.unlockedIslands ?? ['0,0']
      const unlockedSet2 = new Set(ul2)
      const myData2      = GameStateManager_.getPlayer(myPlayerId)
      const myGold2      = myData2?.gold ?? 0
      // 使用 window.innerWidth/Height 確保 resize 後立即反映最新尺寸（app.screen 有一幀延遲）
      const sw = window.innerWidth, sh = window.innerHeight
      // 只在靠近（0.9 格步長）才顯示，避免滿畫面都是圈
      const DETECT_RANGE = WORLD_CONFIG.ISLAND_STRIDE * TILE_SIZE * 0.9   // ~950 px
      const RING_R = (WORLD_CONFIG.ISLAND_SAND_R + 2) * TILE_SIZE        // 沙灘半徑 +2 格，圈圈稍微外擴包住整座島

      let lblIdx = 0
      outer: for (let iy = -4; iy <= 4; iy++) {
        for (let ix = -4; ix <= 4; ix++) {
          if (lblIdx >= ISLAND_LABEL_POOL_SIZE) break outer
          const key = `${ix},${iy}`
          if (unlockedSet2.has(key)) continue
          const ic = WorldGen.islandWorldCenter(ix, iy)
          const worldDist = Math.hypot(ic.x - me.x, ic.y - me.y)
          if (worldDist > DETECT_RANGE) continue

          const ring = Math.max(Math.abs(ix), Math.abs(iy))
          const cost = ISLAND_UNLOCK_COST[ring] ?? 9999
          const canAfford = myGold2 >= cost

          // 世界座標畫圓圈（islandRingGfx 在 camera 內，自動跟相機走）
          const ringColor = canAfford ? 0x44ee88 : 0xdd7733
          islandRingGfx
            .circle(ic.x, ic.y, RING_R)
            .stroke({ color: ringColor, width: 5, alpha: 0.85 })

          // DOM 標籤定位到圓圈頂端（螢幕座標）
          const rawSx = (ic.x - me.x) * CAMERA_ZOOM + sw / 2
          const rawSy = (ic.y - RING_R - me.y) * CAMERA_ZOOM + sh / 2
          const sx = Math.max(70, Math.min(sw - 70, rawSx))
          const sy = Math.max(40, Math.min(sh - 40, rawSy))

          const lbl = islandLabelPool[lblIdx++]
          lbl.textContent = canAfford ? t('game.island_unlock_label', { cost }) : t('game.island_locked_label', { cost })
          lbl.className = 'island-label ' + (canAfford ? 'island-label--afford' : 'island-label--locked')
          lbl.style.left    = `${sx}px`
          lbl.style.top     = `${sy}px`
          lbl.style.display = 'block'
        }
      }
      for (; lblIdx < ISLAND_LABEL_POOL_SIZE; lblIdx++) {
        islandLabelPool[lblIdx].style.display = 'none'
      }
    }

    // ── 手持物品顯示（本地玩家） ─────────────────────────────────
    const mePlayer2 = players.get(myPlayerId)
    if (mePlayer2) {
      const origin = getInteractionOrigin(mePlayer2)
      mePlayer2.setHeldToolItem(hotbarUI.activeItem?.itemId ?? null, hotbarUI.activeItemKind)
      mePlayer2.setHeldToolAim(selectedPoint.x - origin.x, selectedPoint.y - origin.y)
    }

    // ── 手電筒光束（夜晚 + 手持(hotbar 選中)手電筒時才亮；切到別格即關） ──
    const mePlayerFlash = players.get(myPlayerId)
    if (mePlayerFlash) {
      const hasFlashlight = Inventory.get(myPlayerId).some(s => s.itemId === 'flashlight')
      if (flashlightOn && hasFlashlight && dayNight.darkness > 0.1) {
        if (!flashlightGfx) {
          flashlightGfx = new PIXI.Graphics()   // 均勻的光（被形狀遮罩裁切）
          // 掛在 stage（夜晚暗化覆蓋層之上）並用疊加混合 → 真的把夜晚提亮，而不是被暗幕壓住
          flashlightGfx.blendMode = 'add'
          flashlightGfx.eventMode = 'none'
          flashlightMask = new PIXI.Graphics()  // 形狀遮罩（三角+圓）
          flashlightMask.eventMode = 'none'
          app.stage.addChild(flashlightMask)
          app.stage.addChild(flashlightGfx)
          flashlightGfx.mask = flashlightMask
        }
        flashlightGfx.clear()
        flashlightMask!.clear()
        flashlightGfx.visible = true
        // 根據玩家面向方向決定錐形朝向
        const facingDir = mePlayerFlash.currentFacingDir
        let angle = 0
        if      (facingDir === 'RIGHT') angle = 0
        else if (facingDir === 'LEFT')  angle = Math.PI
        else if (facingDir === 'DOWN')  angle = Math.PI / 2
        else                             angle = -Math.PI / 2  // UP

        // 螢幕座標（光錐畫在 stage 上，需把世界座標換算成螢幕座標）
        const px = mePlayerFlash.x * CAMERA_ZOOM + camera.x
        const py = mePlayerFlash.y * CAMERA_ZOOM + camera.y
        // 扇形：前方 10 格、半角 32 度（距離 +2 格）
        const coneLen  = TILE_SIZE * 10 * CAMERA_ZOOM
        const halfAngle = (32 * Math.PI) / 180
        const k = dayNight.darkness   // 越暗越亮
        const lx = px + Math.cos(angle - halfAngle) * coneLen
        const ly = py + Math.sin(angle - halfAngle) * coneLen
        const rx = px + Math.cos(angle + halfAngle) * coneLen
        const ry = py + Math.sin(angle + halfAngle) * coneLen
        // 遮罩 = 三角形 + 圓形的「覆蓋形狀」（重疊與否都只算一層）
        flashlightMask!
          .poly([px, py, lx, ly, rx, ry])
          .circle(px, py, TILE_SIZE * 3.2 * CAMERA_ZOOM)
          .fill({ color: 0xffffff, alpha: 1 })
        // 均勻的光：畫滿整個畫面、被上面的形狀遮罩裁切 → 整片亮度一致，重疊處不再更亮
        flashlightGfx
          .rect(0, 0, app.screen.width, app.screen.height)
          .fill({ color: 0x6e5f38, alpha: 0.95 * k })
      } else {
        if (flashlightGfx) flashlightGfx.visible = false
      }
    }

    // HUD 更新
    const myData = GameStateManager_.getPlayer(myPlayerId)
    if (myData) {
      const levelBefore = myData.level
      const me = players.get(myPlayerId)
      settleCombatLevel(myPlayerId, myData, me?.x, me?.y)
      if (myData.level !== levelBefore) GameStateManager_.setPlayer(myPlayerId, myData)
      hud.update(myData)
    }
  })

  // ── 難度選擇 Modal（Host 開新地圖前顯示） ──────────────────
  function selectDifficulty(): Promise<Difficulty> {
    return new Promise(resolve => {
      const modal = document.createElement('div')
      modal.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.85)',
        'display:flex', 'align-items:center', 'justify-content:center', 'z-index:900',
      ].join(';')
      const box = document.createElement('div')
      box.style.cssText = [
        'background:#1a2a1a', 'border:2px solid #4a8a4a', 'border-radius:14px',
        'padding:28px 36px', 'text-align:center', 'color:#d0e8c0',
      ].join(';')
      box.innerHTML = `
        <h2 style="margin:0 0 8px;font-size:1.5rem">${t('game.difficulty_title')}</h2>
        <p style="margin:0 0 20px;color:#8ab08a;font-size:0.9rem">${t('game.difficulty_desc')}</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button data-d="easy"   style="${diffBtnStyle('#3a7a3a','#2a5a2a')}">${t('game.difficulty_easy')}<br><small>${t('game.difficulty_easy_sub')}</small></button>
          <button data-d="normal" style="${diffBtnStyle('#5a7a3a','#3a5a2a')}">${t('game.difficulty_normal')}<br><small>${t('game.difficulty_normal_sub')}</small></button>
          <button data-d="hard"   style="${diffBtnStyle('#8a3a3a','#6a2a2a')}">${t('game.difficulty_hard')}<br><small>${t('game.difficulty_hard_sub')}</small></button>
        </div>
      `
      function diffBtnStyle(bg: string, hover: string) {
        return `background:${bg};border:none;border-radius:10px;color:#e0f0d0;` +
          `padding:12px 18px;cursor:pointer;font-size:0.95rem;line-height:1.5;` +
          `min-width:120px;transition:background 0.15s`
      }
      box.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mouseenter', () => (btn as HTMLElement).style.filter = 'brightness(1.25)')
        btn.addEventListener('mouseleave', () => (btn as HTMLElement).style.filter = '')
        btn.addEventListener('click', () => {
          document.body.removeChild(modal)
          resolve((btn as HTMLElement).dataset.d as Difficulty)
        })
      })
      modal.appendChild(box)
      document.body.appendChild(modal)
    })
  }

  // ── 開始遊戲 ───────────────────────────────────────────────
  async function startGame(role: 'host' | 'client', mapName: string | null = null, playerName?: string) {
    lobby.hide()
    hud.show()
    hotbarUI.show(myPlayerId ? Inventory.get(myPlayerId) : [])
    currentMapName = mapName   // 提升到 bootstrap 作用域供 save:request 使用

    if (role === 'host') {
      myPlayerId = RoomManager.myId
      setLocalInventoryUiPlayer(myPlayerId)

      // mapName = null → 全新地圖；有值 → 載入指定存檔
      let world = mapName ? await SaveManager.loadWorld(mapName) : null

      // 舊存檔遷移：若缺少 unlockedIslands 欄位，視為舊世界重新生成
      if (world && !(world as any).unlockedIslands) {
        currentDifficulty = 'normal'
        world = WorldGen.generate(world.seed, new Set(['0,0']), currentDifficulty)
        // 確保 currentMapName 與 seed 綁定（舊存檔可能是 'autosave'，保留原名）
        if (!currentMapName) currentMapName = `world_${world.seed}`
        await SaveManager.saveWorld(world, currentMapName)
      }

      if (!world) {
        // 全新地圖：顯示難度選擇 modal
        currentDifficulty = await selectDifficulty()
        world = WorldGen.generate(
          Math.floor(Math.random() * 999999),
          new Set(['0,0']),
          currentDifficulty,
        )
        // 以 seed 為存檔名稱，確保同一個世界永遠存在同一個槽位
        currentMapName = `world_${world.seed}`
        await SaveManager.saveWorld(world, currentMapName)
      } else {
        currentDifficulty = ((world as any).difficulty as Difficulty) ?? 'normal'
      }

      // 設定 monsterSpawner 難度
      monsterSpawner.setDifficulty(currentDifficulty)

      GameStateManager_.setWorld(world)
      GameStateManager_.get().hostId = myPlayerId

      // 建立 Host 玩家：存檔以「stableId + 世界 seed」為鍵 → 每個世界的進度
      // （背包/金幣/等級/裝備/位置/飽食度）完全獨立，不再跨世界共用。
      const worldPlayerKey = `${stableId}__${world.seed}`
      let myData = await SaveManager.loadPlayer(worldPlayerKey)
      if (!myData) {
        // 此世界尚無存檔 → 建立全新玩家，只沿用名稱與外觀，其餘進度全部歸零
        const localPlayer = SyncProtocol.getLocalPlayer()
        const baseName = (playerName ?? localPlayer?.name ?? t('game.default_player_name')).replace(/^👑\s*/, '')
        myData = SyncProtocol.createNewPlayer('👑 ' + baseName)
        if (localPlayer?.color != null) myData.color = localPlayer.color
        // 新玩家出生在此世界起始島中心
        myData.x = (world as any).spawnX ?? WORLD_CONFIG.CENTER_X
        myData.y = (world as any).spawnY ?? WORLD_CONFIG.CENTER_Y
        ;(myData as any).hunger = 100
        // 新世界沒有背包箱存檔 → 清掉上一個世界殘留在記憶體的背包箱內容
        for (const k of Object.keys(smallBagContents)) delete smallBagContents[k]
        for (const k of Object.keys(largeBagContents)) delete largeBagContents[k]
      }
      ;(myData as any).hunger = (myData as any).hunger ?? 100
      myData.id = myPlayerId  // 每次連線都更新為當前 PeerJS ID（執行期以 PeerJS id 當 key）
      applyCombatStats(myData)
      GameStateManager_.setPlayer(myPlayerId, myData)
      assignPlayerSprites()

      // 初始化背包（讀入存檔背包）
      Inventory.init(myPlayerId)
      const hostInventory = myData.inventory ?? []
      Inventory.setInventory(myPlayerId, hostInventory)
      EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: hostInventory })
      hotbarUI.show(hostInventory)

      // 還原背包（bag_small / bag_large）內容
      const savedBags = (myData as any)._bags
      if (savedBags?.bag_small) Object.assign(smallBagContents, savedBags.bag_small)
      if (savedBags?.bag_large) Object.assign(largeBagContents, savedBags.bag_large)

      // 還原裝備欄顯示
      const savedArmor = (myData as any).equipped?.armor as string | undefined
      if (savedArmor) {
        const armorItemDef = ITEMS[savedArmor]
        const savedArmorDef = getArmorDef(savedArmor)
        if (armorItemDef && savedArmorDef) {
          equipUI.updateArmor(savedArmor, armorItemDef.icon, savedArmorDef.name, savedArmorDef.defPct)
        }
      }


      // 渲染地圖
      tileMap.render(world)
      waterPositions = tileMap.getWaterPositions()
      spawner.spawnAll(world)

      // ── 寶箱：有存檔就還原，沒有就生成並存入 ──────────────────
      if ((world as any).treasureChests?.length > 0) {
        treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
      } else {
        treasureSpawner.spawnAll(world)
        ;(world as any).treasureChests = treasureSpawner.getAllChestsData()
        // setWorld 讓 autosave 之後能帶著新欄位存出去
        GameStateManager_.setWorld(world)
      }

      // ── 還原 nightCount + 日夜時間 ──────────────────────────────
      if ((world as any).nightCount != null) nightCount = (world as any).nightCount
      if ((world as any).dayCount  != null || (world as any).dayTimeS != null) {
        dayNight.restore(
          (world as any).dayCount  ?? 1,
          (world as any).dayTimeS  ?? 0,
        )
      }

      // 舊存檔座標可能在水上、被寶箱或建築卡住（bug 遺留）→ 強制移回中心島安全點
      {
        const safeX = (world as any).spawnX ?? WORLD_CONFIG.CENTER_X
        const safeY = (world as any).spawnY ?? WORLD_CONFIG.CENTER_Y
        // 出界（座標落在新世界沒有的區塊 → getTileAt 回 null）也要移回中心，
        // 否則畫面四周沒有任何地塊會是一片空白
        const offMap = tileMap.getTileAt(myData.x, myData.y, world) == null
        if (offMap || isMovementBlockedAt(myData.x, myData.y)) {
          const safe = findSafeSpawn(safeX, safeY)
          myData.x = safe.x
          myData.y = safe.y
          GameStateManager_.setPlayer(myPlayerId, myData)
        }
      }

      // 恢復已放置的建築（讀檔時重建 sprite）
      for (const building of world.buildings ?? []) {
        buildingSystem.restoreBuilding(building)
      }

      // 建立玩家 Sprite
      const mePlayer = new Player(myData)
      players.set(myPlayerId, mePlayer)
      playerLayer.addChild(mePlayer.sprite)

      // 廣播完整 state 給所有已連線的 client
      NetworkHost.broadcast({
        type: 'state_full',
        tick: GameStateManager_.get().tick,
        state: GameStateManager_.get(),
      })

      // 自動存檔（每 10 秒，走 save:request 路徑，同時存世界 + 所有玩家背包）
      setInterval(() => EventBus.emit('save:request', {}), 10_000)

      // 關鍵事件即時存檔（節流：最短 3 秒一次，避免連續放置建築時狂寫 IndexedDB）
      let lastEventSaveAt = 0
      const requestEventSave = () => {
        const t = performance.now()
        if (t - lastEventSaveAt < 3000) return
        lastEventSaveAt = t
        EventBus.emit('save:request', {})
      }
      EventBus.on('player:died',       requestEventSave)   // 玩家死亡
      EventBus.on('build:placed',      requestEventSave)   // 建造
      EventBus.on('building:upgraded', requestEventSave)   // 升級基地核心等建築

      // 初始廣播寶箱狀態（初始時沒有打開的寶箱，但保持結構一致）
      if (openedChests.size > 0) {
        NetworkHost.broadcast({
          type: 'state_delta',
          tick: GameStateManager_.get().tick,
          delta: { openedChests: Array.from(openedChests) } as any,
        })
      }

      // ── 寶箱點擊處理（Host 直接打開） ─────────────────────────
      treasureSpawner.setClickHandler((chestId: string) => {
        if (!openedChests.has(chestId)) {
          treasureSpawner.openChest(chestId)  // 發出 'treasure:opened' 事件，處理背包更新
          openedChests.add(chestId)
          treasureSpawner.removeChest(chestId)
          // 更新 world 中的寶箱快照
          ;(GameStateManager_.getWorld() as any).treasureChests = treasureSpawner.getAllChestsData()

          // 廣播寶箱已打開狀態給所有 Client
          NetworkHost.broadcast({
            type: 'state_delta',
            tick: GameStateManager_.get().tick,
            delta: { openedChests: Array.from(openedChests) } as any,
          })
        }
      })

      // ── 自然樹木再生（Host only，每 50 秒嘗試一次） ──────────
      setInterval(() => {
        if (RoomManager.role !== 'host') return
        const world = GameStateManager_.getWorld()
        if (!world?.chunks?.length) return
        if (Math.random() > 0.5) return   // 50% 機率略過（讓再生率隨機）

        const allTrees = spawner.getAllNodes().filter(n => n.getData().type === 'tree')
        if (allTrees.length === 0) return

        for (let tries = 0; tries < 15; tries++) {
          const parent = allTrees[Math.floor(Math.random() * allTrees.length)]
          const angle  = Math.random() * Math.PI * 2
          const dist   = (2.5 + Math.random() * 5) * TILE_SIZE
          const nx     = parent.x + Math.cos(angle) * dist
          const ny     = parent.y + Math.sin(angle) * dist
          if (tileMap.getTileAt(nx, ny, world) !== 'grass') continue
          const tooClose = spawner.getAllNodes().some(n =>
            Math.hypot(n.x - nx, n.y - ny) < TILE_SIZE * 1.8
          )
          if (tooClose) continue
          const resType = pickResourceForSpawn(ringAtWorld(nx, ny), 'grass') ?? 'tree'
          const cfg   = RESOURCE_CONFIG[resType]
          const newId = `tree_nat_${Date.now()}_${Math.random().toString(36).slice(2)}`
          const nodeData: import('./types').ResourceNode = {
            id: newId, type: resType as import('./types').ResourceType, x: nx, y: ny,
            hp: cfg.hp, maxHp: cfg.hp, respawnTime: cfg.respawnTime,
          }
          const newNode = spawner.spawnOne(nodeData)
          newNode.playRespawnAnim()
          world.resources = (world.resources ?? []).filter(r => r.id !== newId)
          world.resources.push(newNode.getData())
          NetworkHost.broadcast({
            type: 'state_delta', tick: GameStateManager_.get().tick,
            delta: { resources: { [newId]: newNode.getData() } },
          })
          break  // 每次只長一棵樹
        }
      }, 50_000)
    } else {
      // Client：用 state_full 裡的資料初始化畫面
      const state = GameStateManager_.get()
      syncClientFullState(state)
      const world = state.world

      // 渲染世界
      if (world.chunks.length > 0) {
        tileMap.render(world)
        waterPositions = tileMap.getWaterPositions()
        spawner.spawnAll(world)
        // 寶箱：Host 已存入 world.treasureChests，Client 直接還原
        if ((world as any).treasureChests?.length > 0) {
          treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
        } else {
          treasureSpawner.spawnAll(world)
        }
        // ── 還原建築（Client 端建築來自 world.buildings，與 Host 同步）──
        for (const b of world.buildings ?? []) {
          if (!buildingSystem.getAll().find(existing => existing.id === b.id)) {
            buildingSystem.restoreBuilding(b)
          }
        }
      }

      // Client 寶箱點擊：發送網路輸入
      treasureSpawner.setClickHandler((chestId: string) => {
        // TODO: 未來可能需要實作網路點擊指令，目前先留空
        console.log('Client clicked treasure:', chestId)
      })

      // 建立所有玩家 sprite（跳過已由 client:state_full 提前建好的，避免分身）
      for (const pData of Object.values(state.players)) {
        if (!players.has(pData.id)) {
          const p = new Player(pData)
          players.set(pData.id, p)
          playerLayer.addChild(p.sprite)
        }
      }

      // 初始化自己的背包，並從 state_full 的 playerData 恢復背包內容
      const myPData = state.players[myPlayerId]
      Inventory.init(myPlayerId)
      const clientInventory = myPData?.inventory ?? []
      Inventory.setInventory(myPlayerId, clientInventory)
      EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: clientInventory })
      hotbarUI.show(clientInventory)

      // 後續 state_full/delta 都透過 EventBus 更新（NetworkClient 已處理）
    }
  }

  // Client 收到 Host 的差分更新（玩家位置 + 資源狀態）
  window.addEventListener('client:state_delta', (e) => {
    const msg = (e as CustomEvent).detail as import('./types').NetMessage & { type: 'state_delta' }
    if (!msg.delta) return
    // 玩家位置 + 背包更新
    if (msg.delta.players) {
      for (const [playerId, delta] of Object.entries(msg.delta.players)) {
        const current = GameStateManager_.getPlayer(playerId)
        if (!current && !(delta as any)?.name) continue
        // 高頻移動同步只帶 x/y → 跳過戰鬥屬性重算與 sprite 重指派（效能）
        const positionOnly = !!current
          && Object.keys(delta ?? {}).every(k => k === 'x' || k === 'y')
        // 自己的位置由本地預測主導：移動中忽略純位置快照，避免被較舊的座標往回拉
        if (positionOnly && playerId === myPlayerId && RoomManager.role !== 'host'
          && (inputState.up || inputState.down || inputState.left || inputState.right)) {
          continue
        }
        const next = { ...(current ?? { id: playerId }), ...(delta ?? {}), id: playerId } as import('./types').PlayerData
        if (!positionOnly) applyCombatStats(next)
        GameStateManager_.setPlayer(playerId, next)
        if (!positionOnly) assignPlayerSprites()
        upsertPlayerSprite(GameStateManager_.getPlayer(playerId) ?? next)
        // Host 送回我自己的背包更新時，同步到本地 Inventory
        if (playerId === myPlayerId && delta?.inventory) {
          Inventory.setInventory(myPlayerId, delta.inventory)
          EventBus.emit('inventory:changed', { playerId: myPlayerId, inventory: delta.inventory })
        }
        // Client 收到 Host 廣播的死亡訊息（自己的 HP 被打到 0）
        if (playerId === myPlayerId && RoomManager.role !== 'host') {
          const newHp = (delta as any)?.hp
          const prevHp = current?.hp ?? 100
          if (typeof newHp === 'number' && newHp <= 0 && prevHp > 0) {
            const meC = players.get(myPlayerId)
            if (meC) fxLayer.spawnFloatingText(meC.x, meC.y - 55, t('game.killed_respawning'), 0xFF4444)
          }
        }
      }
    }
    // 資源 HP 更新 / 新增 / 移除
    if (msg.delta.resources || msg.delta.removedResources) {
      spawner.applyResourceDelta(
        msg.delta.resources as Record<string, Partial<import('./types').ResourceNode>> | undefined,
        msg.delta.removedResources
      )
    }
    const dropDelta = (msg.delta as any).drops as DropSnapshot[] | undefined
    if (dropDelta) {
      for (const drop of dropDelta) {
        _spawnDropSprite(drop.worldX, drop.worldY, drop.resourceType, drop.itemId, drop.amount, drop)
        fxLayer.spawnHarvest(drop.worldX, drop.worldY - 10, drop.resourceType, drop.amount)
      }
    }
    const removedDropIds = (msg.delta as any).removedDrops as string[] | undefined
    if (removedDropIds) {
      for (const dropId of removedDropIds) {
        const drop = drops.get(dropId)
        if (!drop) continue
        PIXI.Ticker.shared.remove(drop.bobTick)
        drop.sprite.destroy()
        drops.delete(dropId)
      }
    }
    // 新放置的建築
    if (msg.delta.buildings) {
      const buildingDelta = msg.delta.buildings as any
      if (Array.isArray(buildingDelta)) {
        for (const b of buildingDelta) {
          buildingSystem.restoreBuilding(b)
        }
      } else {
        for (const [id, patch] of Object.entries(buildingDelta)) {
          const existing = buildingSystem.getAll().find(b => b.id === id)
          if (existing) {
            Object.assign(existing, patch)
            buildingSystem.restoreBuilding(existing)
          }
        }
      }
    }
    // 怪物同步（Client 端）
    const monsterDelta = (msg.delta as any).monsters
    if (monsterDelta && RoomManager.role !== 'host') {
      monsterSpawner.applyDelta(monsterDelta)
    }
    // 寶箱同步（Client 端移除已打開的寶箱）
    const openedChestsList = (msg.delta as any).openedChests as string[] | undefined
    if (openedChestsList) {
      for (const chestId of openedChestsList) {
        treasureSpawner.removeChest(chestId)
      }
    }
    // 建築拆除同步（Client 端移除被 Host 拆除的建築）
    const demolishedList = (msg.delta as any).demolishedBuildings as string[] | undefined
    if (demolishedList) {
      for (const bid of demolishedList) {
        buildingSystem.demolish(bid)  // 只移除 sprite，不給材料
      }
    }
  })

  // 有玩家加入或離開：補建 sprite / 移除離線玩家
  window.addEventListener('client:player_list', (e) => {
    const list = (e as CustomEvent).detail as import('./types').PlayerData[]
    for (const pData of list) {
      applyCombatStats(pData)
      GameStateManager_.setPlayer(pData.id, pData)
    }
    assignPlayerSprites()
    const incomingIds = new Set(list.map(p => p.id))

    // 移除已不在清單內的玩家（斷線）
    for (const [pid, p] of players) {
      if (pid !== myPlayerId && !incomingIds.has(pid)) {
        p.destroy()
        players.delete(pid)
      }
    }
    // 補建還沒有 sprite 的玩家（新加入）
    for (const pData of list) {
      if (!players.has(pData.id)) {
        upsertPlayerSprite(GameStateManager_.getPlayer(pData.id) ?? pData)
        Inventory.init(pData.id)
        if (pData.inventory?.length) Inventory.setInventory(pData.id, pData.inventory)
      }
    }
  })

  // Client 收到 Host 的完整 state（Host 開始遊戲後廣播）
  window.addEventListener('client:state_full', (e) => {
    const state = (e as CustomEvent).detail
    syncClientFullState(state)
    return
    const world = state.world
    if (!world?.chunks?.length) return

    tileMap.render(world)
    waterPositions = tileMap.getWaterPositions()
    spawner.spawnAll(world)
    // 還原寶箱
    if ((world as any).treasureChests?.length > 0) {
      treasureSpawner.restoreFromSnapshot((world as any).treasureChests)
    }
    // 還原建築（重要：避免 Client 看不到已放置的建築）
    for (const b of world.buildings ?? []) {
      if (!buildingSystem.getAll().find(existing => existing.id === b.id)) {
        buildingSystem.restoreBuilding(b)
      }
    }

    for (const pData of Object.values(state.players as Record<string, import('./types').PlayerData>)) {
      if (!players.has(pData.id)) {
        const p = new Player(pData)
        players.set(pData.id, p)
        playerLayer.addChild(p.sprite)
      }
    }
  })

  // ── i18n:changed → 重繪 main.ts 自己持有的常駐文字 ──────────
  EventBus.on('i18n:changed', () => {
    _renderMapLegend()
    _renderReconnectOverlay()
    _renderDemolishPanel()
    // minimap canvas 的標題會在下次 renderMap() 呼叫時自動套用新語言，無須額外處理
  })

  // 監聽 Lobby 的開始事件
  window.addEventListener('game:start', (e) => {
    const detail = (e as CustomEvent).detail as {
      role: 'host' | 'client'
      mapName?: string | null
      playerName?: string
      roomCode?: string
    }
    myPlayerId = RoomManager.myId
    setLocalInventoryUiPlayer(myPlayerId)
    if (detail.role === 'host' && detail.roomCode) {
      hud.setRoomCode(detail.roomCode)
      hud.setPlayerCount(1)  // 開始只有 Host 自己
    }
    startGame(detail.role, detail.mapName ?? null, detail.playerName)
  })
}

bootstrap()
