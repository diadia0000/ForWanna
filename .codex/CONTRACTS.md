# Forager MP — Pre-Resolved Architecture Contracts

Cheat sheet for Codex. Read this before writing any code. Do not guess — every answer is here.

---

## 1. TypeScript Interfaces (`src/types/index.ts`)

**DO NOT edit `src/types/index.ts` without architect consensus.**  
All modules import types exclusively from `@/types`.

### Primitive ID aliases
| Alias | Base type | Purpose |
|---|---|---|
| `PlayerId` | `string` | Player identifier |
| `ItemId` | `string` | Item identifier |
| `RecipeId` | `string` | Recipe identifier |
| `BuildingId` | `string` | Building definition identifier |
| `NodeId` | `string` | Resource node identifier |

### Core interfaces

**`Vec2`** — 2D coordinate
```ts
{ x: number; y: number }
```

**`PlayerData`** — canonical player state (lives in `GameState.players[playerId]`)
```ts
{
  id: PlayerId; name: string
  x: number; y: number
  hp: number; maxHp: number
  xp: number; level: number          // combat level (from XP)
  researchLevel: number              // recipe unlock gate — NOT level
  gold: number
  inventory: InventoryItem[]
  unlockedSkills: string[]
  color: number                      // PixiJS hex color
}
```

**`InventoryItem`**
```ts
{ itemId: ItemId; amount: number }
```

**`ItemDef`**
```ts
{ id: ItemId; name: string; icon: string; maxStack: number; sellPrice: number }
```

**`RecipeDef`**
```ts
{ id: RecipeId; name: string; requires: InventoryItem[]; produces: InventoryItem[]; unlockLevel: number }
```
> `unlockLevel` compares against `player.researchLevel`, never `player.level`.

**`ResourceNode`**
```ts
{ id: NodeId; type: ResourceType; x: number; y: number; hp: number; maxHp: number; respawnTime: number }
```
`ResourceType` = `'tree' | 'rock' | 'iron' | 'gold' | 'crystal'`

**`Building`** — placed instance
```ts
{ id: string; defId: BuildingId; x: number; y: number; ownerId: PlayerId; placedAt: number; level: number; hp: number; maxHp: number }
```

**`BuildingDef`** — static definition
```ts
{ id: BuildingId; name: string; cost: InventoryItem[]; size: Vec2; effect: string }
```

**`TileType`** = `'grass' | 'water' | 'sand' | 'stone' | 'snow'`

**`Chunk`**
```ts
{ cx: number; cy: number; tiles: TileType[][]; seed: number }  // tiles is 16×16
```

**`WorldData`**
```ts
{ seed: number; chunks: Chunk[]; resources: ResourceNode[]; buildings: Building[]; createdAt: number }
```

**`GameState`**
```ts
{ tick: number; players: Record<PlayerId, PlayerData>; world: WorldData; hostId: PlayerId }
```

**`StateDelta`** — sent from Host to Clients every tick
```ts
{
  players?:         Partial<Record<PlayerId, Partial<PlayerData>>>
  resources?:       Partial<Record<NodeId, Partial<ResourceNode>>>
  buildings?:       Building[]      // newly placed only
  removedResources?: NodeId[]
}
```

**`PlayerInput`** — union type sent Client → Host
```ts
| { type: 'move';    dx: -1|0|1; dy: -1|0|1 }
| { type: 'harvest'; targetId: NodeId }
| { type: 'craft';   recipeId: RecipeId }
| { type: 'build';   buildingDefId: BuildingId; x: number; y: number }
```

**`NetMessage`** — full wire protocol union
```ts
// Client → Host
| { type: 'input';       playerId: PlayerId; input: PlayerInput; tick: number }
| { type: 'join';        playerData: PlayerData }
| { type: 'save_request' }

// Host → Client(s)
| { type: 'state_full';  tick: number; state: GameState }
| { type: 'state_delta'; tick: number; delta: StateDelta }
| { type: 'join_ack';    playerId: PlayerId; roomCode: string }
| { type: 'player_list'; players: PlayerData[] }
| { type: 'kicked';      reason: string }
```

---

## 2. Module File Layout (`src/`)

```
src/
├── main.ts                        # Entry point; registers all EventBus listeners
├── GameController.ts              # Integrator: wires modules together
├── types/index.ts                 # SHARED TYPES — DO NOT EDIT without consensus
│
├── core/
│   ├── App.ts                     # PixiJS Application singleton
│   ├── EventBus.ts                # Typed event bus (GameEvents)
│   ├── GameLoop.ts                # Main tick loop
│   ├── GameState.ts               # GameStateManager_ singleton + LevelSystem + PlayerStats
│   └── i18n/                      # i18n: I18n.ts, detect.ts, index.ts
│
├── network/
│   ├── MessageTypes.ts            # Re-exports NetMessage, PlayerInput, StateDelta, PlayerId
│   ├── NetworkHost.ts             # Host-side PeerJS connections, validation, broadcast
│   ├── NetworkClient.ts           # Client-side PeerJS connection, send input
│   └── RoomManager.ts             # createRoom / joinRoom; connects to localhost:9000
│
├── player/
│   ├── Player.ts                  # PixiJS sprite + applyInput (SPEED = 10)
│   ├── ClientPrediction.ts        # Client-side movement prediction
│   └── index.ts
│
├── world/
│   ├── WorldGen.ts                # Procedural world generation (WORLD_CONFIG)
│   ├── TileMap.ts                 # Tile rendering
│   └── index.ts
│
├── resources/
│   ├── ResourceNode.ts            # Node hit/respawn logic
│   ├── Spawner.ts                 # Spawns resource nodes on world
│   ├── resourceConfig.ts          # Resource type definitions
│   ├── spawnConfig.ts             # Spawn density/distribution
│   └── index.ts
│
├── inventory/
│   ├── Inventory.ts               # InventorySystem singleton (Inventory)
│   ├── CraftingSystem.ts          # CraftingSystem singleton
│   └── data/
│       ├── items.ts               # ITEMS: Record<string, ItemDef>
│       ├── recipes.ts             # RECIPES: Record<string, RecipeDef>
│       ├── itemKinds.ts           # HeldItemKind type
│       └── researchUpgradeCosts.ts
│
├── building/
│   ├── BuildingSystem.ts          # Placement, water check, upgrade, repair
│   ├── BuildingPlacer.ts          # Input handling for placement mode
│   └── data/buildings.ts          # BUILDING_DEFS, BUILDING_UPGRADES, TRAP_REPAIR_COST
│
├── combat/
│   ├── Monster.ts                 # Monster entity + AI
│   ├── MonsterSpawner.ts          # Wave/siege spawning
│   ├── WeaponDefs.ts              # Weapon stats
│   ├── ArmorDefs.ts               # Armor stats
│   └── index.ts
│
├── dungeon/
│   ├── DungeonGenerator.ts        # Procedural dungeon layout
│   ├── DungeonScene.ts            # Dungeon rendering/management
│   └── index.ts
│
├── quest/
│   ├── QuestSystem.ts             # Quest tracking
│   ├── QuestUI.ts                 # Quest HUD overlay
│   ├── milestones.ts              # Milestone definitions
│   └── index.ts
│
├── render/
│   ├── AssetLoader.ts             # Asset loading pipeline
│   ├── EntitySpriteDriver.ts      # Sprite manifest driver
│   ├── DayNight.ts                # Day/night overlay (use window.innerWidth/Height in resize)
│   ├── FxLayer.ts                 # Visual effects layer
│   ├── ItemSpriteRegistry.ts      # Item icon lookup
│   ├── TileSpriteRegistry.ts      # Tile texture lookup
│   └── index.ts
│
├── save/
│   ├── SaveManager.ts             # SaveManagerClass singleton; Dexie-backed
│   ├── GameDB.ts                  # Dexie database schema
│   ├── SyncProtocol.ts            # State sync helpers
│   └── index.ts
│
├── treasure/
│   ├── TreasureChest.ts           # Chest entity
│   ├── TreasureSpawner.ts         # Chest placement
│   ├── treasureConfig.ts          # Loot tables
│   └── index.ts
│
├── ui/
│   ├── HUD.ts                     # Main heads-up display
│   ├── HotbarUI.ts                # Hotbar (bottom item slots)
│   ├── InventoryUI.ts             # Inventory panel
│   ├── CraftingUI.ts              # Crafting panel
│   ├── BuildingUI.ts              # Building panel
│   ├── BagUI.ts                   # Bag overlay
│   ├── EquipUI.ts                 # Equipment slots
│   ├── FurnaceUI.ts               # Furnace interaction
│   ├── MarketUI.ts / MarketPricing.ts  # Market buy/sell
│   ├── ResearchUI.ts              # Research station
│   ├── BarracksUI.ts              # Barracks management
│   ├── BaseCoreUI.ts              # Base core panel
│   ├── LobbyScreen.ts             # Host/join lobby
│   ├── SelectorGfx.ts             # Harvest cursor highlight
│   └── index.ts
│
└── locales/                       # i18n strings: en/ and zh-TW/
```

---

## 3. EventBus Events

**Import path:** `import { EventBus } from '@/core/EventBus'`  
**API:** `EventBus.on(event, handler)` / `EventBus.emit(event, payload)` / `EventBus.off(event, handler)` / `EventBus.once(event, handler)`  
**Type safety:** All events are typed via `GameEvents` in `src/types/index.ts`.

| Event | Payload | Emitter | Listeners |
|---|---|---|---|
| `player:moved` | `{ playerId, x, y }` | Player | Network, World |
| `player:levelup` | `{ playerId, level }` | Player | UI, Skills |
| `player:died` | `{ playerId }` | Combat | UI, GameState |
| `resource:collected` | `{ playerId, type: ResourceType, amount }` | Resource | Inventory, UI |
| `resource:depleted` | `{ nodeId }` | Resource | World, Spawner |
| `inventory:changed` | `{ playerId, inventory: InventoryItem[] }` | Inventory | UI, Crafting |
| `craft:success` | `{ playerId, recipeId, result: InventoryItem[] }` | Crafting | Inventory, UI |
| `build:placed` | `{ playerId, buildingId, x, y }` | Building | World, UI |
| `building:upgraded` | `{ playerId, buildingId, newLevel }` | Building | UI |
| `network:input` | `{ playerId, input: PlayerInput }` | Network | GameLoop |
| `network:connected` | `{ playerId }` | Network | UI, GameState |
| `network:disconnected` | `{ playerId }` | Network | GameState, UI |
| `save:request` | `{}` | UI / auto-save | SaveManager |
| `save:complete` | `{}` | SaveManager | UI |
| `ui:open_inventory` | `{}` | main.ts | InventoryUI |
| `ui:close_inventory` | `{}` | main.ts | InventoryUI |
| `ui:open_crafting` | `{}` | main.ts | CraftingUI |
| `ui:close_crafting` | `{}` | main.ts | CraftingUI |
| `treasure:opened` | `{ chestId, loot: Array<{itemId, amount}> }` | Treasure | UI |
| `i18n:changed` | `{ lang: string }` | Core i18n | All UI panels |

**Rules:**
- Register all listeners in `main.ts`, not in module constructors.
- Do not add new events without updating `GameEvents` in `src/types/index.ts` and `.claude/claudemd/events.md`.

### Window custom events (main.ts internal only — do not use in modules)
| Event | From | To | Payload |
|---|---|---|---|
| `game:start` | LobbyScreen | main.ts | `{ mode: 'host' \| 'client' }` |
| `client:state_full` | NetworkClient | main.ts | `{ worldData, players }` |
| `client:state_delta` | NetworkClient | main.ts | `{ playerId, x, y, ... }` |

---

## 4. Module Ownership & Init Order

Modules must initialize in this order (dependencies first):

| Order | Module | Singleton/Class | Owns |
|---|---|---|---|
| 1 | Core/App | `App` (PixiJS) | `src/core/App.ts` |
| 2 | GameState | `GameStateManager_` | `src/core/GameState.ts` |
| 3 | EventBus | `EventBus` | `src/core/EventBus.ts` |
| 4 | Network | `RoomManager`, `NetworkHost`, `NetworkClient` | `src/network/` |
| 5 | World | `WorldGen`, `TileMap` | `src/world/` |
| 6 | Player | `Player` class instances | `src/player/` |
| 7 | Resources | `Spawner` | `src/resources/` |
| 8 | Inventory | `Inventory` (InventorySystem) | `src/inventory/` |
| 9 | Crafting | `CraftingSystem` | `src/inventory/CraftingSystem.ts` |
| 10 | Building | `BuildingSystem`, `BuildingPlacer` | `src/building/` |
| 11 | UI | all UI panels | `src/ui/` |
| 12 | SaveManager | `SaveManager` | `src/save/` |
| 13 | GameLoop | `GameLoop` | `src/core/GameLoop.ts` |

**Cross-module import rules:**
- Any module may import from `src/core/` (EventBus, GameState, App, GameLoop).
- Any module may import from `src/types/index.ts`.
- No other cross-module direct imports — use EventBus.

---

## 5. Network Authority Model

```
Host (authoritative)                Client (input-only)
────────────────────────────────    ────────────────────────────────
Owns GameState                      Never mutates GameState directly
Validates all inputs                Sends PlayerInput to Host
Broadcasts state_delta each tick    Applies ClientPrediction locally
Resolves collisions, combat, etc.   Reconciles with server state_delta
Sends state_full on join            Requests save via save_request msg
```

**Key flows:**
- **Client move:** `ClientPrediction.predict(input)` (local, visual only) + `NetworkClient.send({ type:'input', ... })` → Host → `applyInput()` → `broadcast(state_delta)`
- **Client harvest:** `NetworkClient.send({ type:'input', input:{ type:'harvest', targetId } })` → Host validates distance → `ResourceNode.hit()` → broadcasts resource HP delta → `Inventory.add(clientId)` → sends delta only to that client
- **Join:** Client sends `{ type:'join', playerData }` → Host calls `GameState.setPlayer()` → sends back `state_full`

**Never let a Client:**
- Call `GameStateManager_.setPlayer()` / `setWorld()` from a Client-side game action
- Emit `resource:collected` based on a local click without Host confirmation
- Directly modify building HP or resource HP

---

## 6. Named Singletons (exported instances)

| Singleton | Export name | File |
|---|---|---|
| EventBus | `EventBus` | `src/core/EventBus.ts` |
| GameState | `GameStateManager_` | `src/core/GameState.ts` |
| Inventory | `Inventory` | `src/inventory/Inventory.ts` |
| SaveManager | `SaveManager` | `src/save/SaveManager.ts` |

**Note the trailing underscore on `GameStateManager_`** — it is intentional.

---

## 7. Key Data Constants

### Items (`ITEMS` in `src/inventory/data/items.ts`)
Resources: `wood`, `stone`, `iron`, `gold`, `crystal`, `bone`  
Processed: `plank`, `ingot`, `gold_ingot`  
Weapons: `stone_sword`, `iron_sword`, `gold_sword`, `magic_sword`, `mithril_sword`, `laser_gun`, `whirlwind_hammer`, `laser_orb`, `grenade`  
Bows: `wood_bow`, `iron_bow`, `magic_bow` + ammo: `arrow`, `fire_arrow`, `ice_arrow`  
Armor: `leather_armor`, `iron_armor`, `gold_armor`, `crystal_armor`, `shield`  
Tools: `pickaxe`, `iron_pick`, `axe`  
Traps (item): `spike_trap`, `fire_trap`, `ice_trap`  
Food: `berry`, `bread`, `meat`, `cooked_meat`, `gourmet`  
Special: `flashlight`, `bed`, `bag_small`, `bag_large`, `dungeon_map`  
Blueprints: `blueprint`, `blueprint_1` … `blueprint_5`  
Essence: `fire_essence`, `ice_essence`, `ancient_crystal`

### Buildings (`BUILDING_DEFS` in `src/building/data/buildings.ts`)
`furnace`, `farm`, `market`, `research_lab`, `wooden_bridge`, `wall`, `tower`, `spike_trap`, `fire_trap`, `ice_trap`, `base_core`, `barracks`, `laser_tower`, `cannon_tower`, `goddess_statue`

> `wooden_bridge` can only be placed on water. All other buildings cannot be placed on water.

### Recipes — `unlockLevel` by `researchLevel`
| researchLevel | Unlocks |
|---|---|
| 1 | plank, axe, pickaxe, stone_sword |
| 2 | bread, flashlight, bed |
| 3 | iron_pick, cooked_meat |
| 4 | wood_bow, arrow, ingot, iron_sword, gold_sword |
| 5 | bag_small, leather/iron/gold armor, iron_bow, fire_arrow, ice_arrow, shield |
| 6 | spike_trap, fire_trap, grenade, laser_gun, gourmet_1 |
| 7 | ice_trap, laser_tower, cannon_tower, magic_sword |
| 8 | bag_large, magic_bow, crystal_armor, whirlwind_hammer, gourmet_2 |
| 9 | mithril_sword |
| 10 | laser_orb |

### Level thresholds
- **Combat XP:** `[0, 50, 100, 150, 200, 250, 300, 350, 400, 500, 650, ...]` → `player.level`
- **Research points:** `[0, 0, 100, 200, 400, 800, 1200, 1800, 2500, 3500, 5000]` → `player.researchLevel`
- HP formula: `100 + (level-1) * 15`
- ATK formula: `10 + (level-1) * 5`

---

## 8. Naming Conventions

| Concept | Convention | Example |
|---|---|---|
| Functions / variables | `camelCase` | `applyInput`, `playerId` |
| Classes | `PascalCase` | `NetworkHost`, `InventorySystem` |
| Exported singleton instances | `PascalCase` or `PascalCase_` | `EventBus`, `GameStateManager_` |
| EventBus event names | `kebab-case` with `:` separator | `player:moved`, `inventory:changed` |
| Event format | `module:action` or `module:action:state` | `network:connected` |
| Files | `PascalCase.ts` for classes, `camelCase.ts` for data | `BuildingSystem.ts`, `buildings.ts` |
| Path alias | `@/` maps to `src/` | `import { EventBus } from '@/core/EventBus'` |
| Keyboard detection | `e.code`, never `e.key` | `e.code === 'KeyI'` |

---

## 9. Forbidden Patterns

| Forbidden | Correct alternative |
|---|---|
| Direct cross-module import + method call | `EventBus.emit('module:action', payload)` |
| `import { Inventory } from '@/inventory'` inside building/combat/etc. | Subscribe to `inventory:changed` or emit `inventory:add` |
| `player.level` for recipe unlock check | `player.researchLevel` |
| `e.key` for keyboard shortcuts | `e.code` |
| `app.screen.width/height` inside `resize` handler | `window.innerWidth / window.innerHeight` |
| `npm install <pkg>` not in `package.json` | Ask architect first |
| Editing `src/types/index.ts` unilaterally | Architect consensus required |
| Emitting a new EventBus event not in `GameEvents` | Add to `GameEvents` + `events.md` first |
| `EventBus.on(...)` inside a class constructor | Register listeners in `main.ts` |
| `inv.push({ itemId, amount })` without clamping | `inv.push({ itemId, amount: Math.min(amount, itemDef.maxStack) })` |
| Calling `Inventory.setInventory()` without re-emitting | Emit `inventory:changed` manually after `setInventory()` |
| Client mutating world state directly | Route through Host via `PlayerInput` |
| Committing `.js` files under `src/` | `tsconfig.json` has `"noEmit": true`; run `find src -name "*.js" -delete` |

---

## 10. Known Pitfalls

| # | Trap | Fix |
|---|---|---|
| 1 | Stale `.js` files in `src/` shadow `.ts` and break Vite HMR | `find src -name "*.js" -type f -delete` |
| 2 | PeerJS signaling needs `localhost:9000` running | `npm run peer`; verify with `lsof -i :9000` |
| 3 | Multiple Vite processes serve stale code | `pkill -f vite && npm run dev`; Vite port is **5175** |
| 4 | IME (Chinese input) turns `e.key` into `'Process'` | Always use `e.code === 'KeyI'` etc. |
| 5 | UI panels missing `position: fixed` in CSS get buried under canvas | Every panel `#id` must be in the CSS selector list |
| 6 | `InventoryUI` constructor listening to `ui:open_inventory` conflicts with `main.ts` toggle | UI classes expose `show/hide/toggle` only; listeners live in `main.ts` |
| 7 | `BuildingSystem.restoreBuilding()` crash on `undefined` buildings array | Guard: `if (!this.buildings) this.buildings = []` |
| 8 | Recipe check reads `player.level` instead of `player.researchLevel` — all recipes appear locked/unlocked incorrectly | Use `player.researchLevel` everywhere for `unlockLevel` |
| 9 | `items.json` missing `"plank"` entry → blank sprite | Keep `items.json`, item `.json`, and `ITEMS` data in sync |
| 10 | `Inventory.add()` new-slot path skips `maxStack` clamp → stack overflow | `Math.min(amount, itemDef.maxStack)` on push |
| 11 | `Inventory.init()` called multiple times → duplicate `resource:collected` listeners → item multiplication | Use `_resourceListenerRegistered` flag |
| 12 | Save reads `Player.getData()` for gold/XP — Host never receives its own `state_delta` | Read gold/XP/level/HP from `GameStateManager_.getPlayer(pid)`, position from `Player.getData()` |
| 13 | `MonsterDelta` missing `isElite/isBoss/attacking` → P2 sees no elite/boss visuals | Add optional fields to `MonsterDelta`; propagate in `tick()` and `applyDelta()` |
| 14 | `DayNight.resize()` not calling `_apply()` → stale overlay size | Call `_apply()` at end of `resize()` |
| 15 | `resize` handler reading `app.screen` has one-frame lag | Use `window.innerWidth/Height` in resize callbacks |
| 16 | `setInventory()` doesn't emit `inventory:changed` → hotbar stays blank | Emit `inventory:changed` manually after every `setInventory()` call |
| 17 | `selectorLayer` (harvest cursor) added before `objectsLayer` → gets hidden | Add `selectorLayer` **last** in `camera.addChild(...)` chain |
| 18 | Auto-save only saving world, not player inventory | Auto-save via `EventBus.emit('save:request', {})` so it follows the same path as manual save |
| 19 | `wooden_bridge` can be placed on land / normal buildings placed in water | Inject water checker: `buildingSystem.setWaterChecker((wx,wy) => worldMap.isWater(wx,wy))` |
| 20 | Duplicate player sprites on join | Guard with `if (!players.has(playerId))` before creating sprite |
| 21 | Client inventory empty after join | `state_full` must include `inventories` map; call `setInventory()` + emit `inventory:changed` on Client |

---

## 11. Dev Server & Infra

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev | `npm run dev` | **5175** | Single instance only |
| PeerJS signal | `npm run peer` | **9000** | Must be running for P2P |
| Type check | `npx tsc --noEmit` | — | CI gate; `noEmit: true` in tsconfig |
| Tests | `npm test` | — | Vitest |

**Persistence:** Dexie (IndexedDB) via `src/save/GameDB.ts`. Player data also mirrored to `localStorage` key `forager_player`.

---

## 12. Quick Import Reference

```typescript
// Core (allowed from anywhere)
import { EventBus }        from '@/core/EventBus'
import { GameStateManager_ } from '@/core/GameState'
import { PlayerStats, LevelSystem } from '@/core/GameState'

// Types (allowed from anywhere)
import type { PlayerData, ItemId, NetMessage, ... } from '@/types'

// Data constants (import within own module only)
import { ITEMS }          from '@/inventory/data/items'
import { RECIPES }        from '@/inventory/data/recipes'
import { BUILDING_DEFS }  from '@/building/data/buildings'
```
