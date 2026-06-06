# Forager MP — Hackathon Prompt Sequence
# 2026-06-06, 10:30–16:00 (5.5 hours)

This file is the ordered list of prompts to paste into OpenAI Codex during the hackathon.
Paste them in order. Do NOT modify any prompt text before the competition starts.

---

## Schedule Overview

| Time        | Prompt | Feature                         | Est.  |
|-------------|--------|---------------------------------|-------|
| 10:30–10:35 | 00     | Codex orientation               | 5 min |
| 10:35–11:20 | 01-A   | Multiplayer crafting sync       | 45 min|
| 11:20–11:25 | —      | Review + commit                 | 5 min |
| 11:25–12:30 | 01-B   | Dungeon/relic multiplayer sync  | 65 min|
| 12:30–12:50 | —      | Review + commit + lunch break   | 20 min|
| 12:50–13:30 | 02-A   | Building damage sync            | 40 min|
| 13:30–13:45 | —      | Review + commit                 | 15 min|
| 13:45–14:25 | 02-B   | Soldier system sync             | 40 min|
| 14:25–14:40 | —      | Review + commit                 | 15 min|
| 14:40–15:20 | 02-C   | Equipment slot sync             | 40 min|
| 15:20–15:35 | —      | Review + commit                 | 15 min|
| 15:35–16:00 | 02-D   | Visual effects (laser / cannon) | 25 min|

---

## Prompt 00 — Codex Orientation

**Estimated time:** 5 min (read + load into context only)
**Prerequisites:** none
**Purpose:** Give Codex the full project context in one shot before any feature work.

```
You are working on Forager MP, a PixiJS 2D multiplayer sandbox game.
TypeScript + Vite. Entrypoint: src/main.ts. No SSR.

=== ARCHITECTURE ===

Network model: WebRTC P2P via PeerJS. One Host, one or more Clients.
- Host: authoritative. Runs game logic, validates inputs, broadcasts state.
- Client: sends input to Host, receives state_delta / state_full.

Module init order (all in src/main.ts):
  App → GameState → EventBus → Network (RoomManager) →
  World (WorldGen, TileMap) → Player → Resources (Spawner) →
  Inventory → Crafting → Building → UI → SaveManager → GameLoop

Key globals available inside bootstrap() in src/main.ts:
  - myPlayerId: string               — local player's PeerJS ID
  - RoomManager.role: 'host'|'client'
  - players: Map<PlayerId, Player>   — live sprite instances
  - GameStateManager_                — source of truth for player/world data
  - Inventory                        — add/remove/get/setInventory per playerId
  - craftingSystem: CraftingSystem   — canCraft(pid, recipeId), craft(pid, recipeId)
  - buildingSystem: BuildingSystem   — getAll(), takeDamage(), restoreBuilding()
  - monsterSpawner: MonsterSpawner   — getAllMonsters(), hitMonster()
  - NetworkHost.broadcast(msg)       — send to all clients (host only)
  - NetworkHost.sendTo(pid, msg)     — send to one client (host only)
  - NetworkClient.send(msg)          — send to host (client only)
  - fxLayer: FxLayer                 — spawnFloatingText(x, y, text, color)
  - hotbarUI: HotbarUI               — show(inventory), activeItem
  - hud: HUD                         — update(playerData)
  - TILE_SIZE = 48

=== EVENTBUS RULES ===

EventBus is the ONLY way to communicate between modules.
NEVER import and directly call methods across module boundaries.
Allowed direct imports: @/core/EventBus, @/core/GameState.

EventBus.emit / EventBus.on must be registered in src/main.ts, not in module constructors.

Defined events (do not invent new names without updating events.md):
  player:moved     {playerId, x, y}
  player:levelup   {playerId, level}
  resource:collected {playerId, type, amount}
  resource:depleted  {nodeId}
  inventory:changed  {playerId, inventory}
  craft:success      {playerId, recipeId, result}
  build:placed       {playerId, buildingId, x, y}
  network:input      {playerId, input}
  network:connected  {playerId}
  network:disconnected {playerId}
  save:request       {}
  save:complete      {}
  i18n:changed       {lang}

Window custom events (main.ts only — do not use inside modules):
  game:start            detail: { role, mapName, playerName, roomCode }
  client:state_full     detail: GameState
  client:state_delta    detail: NetMessage

=== STATE DELTA SHAPE ===

Host broadcasts state_delta like:
  NetworkHost.broadcast({
    type: 'state_delta',
    tick: GameStateManager_.get().tick,
    delta: {
      players: { [playerId]: { inventory, gold, hp, ... } },
      buildings: { [buildingId]: { hp, level, ... } },
      monsters: [...],
      resources: { [nodeId]: { hp } },
      removedResources: [nodeId, ...],
      drops: [...],
      removedDrops: [...],
      demolishedBuildings: [...],
      openedChests: [...],
    }
  })

Client handles delta in the 'client:state_delta' window event listener (src/main.ts ~line 3861).

=== FORBIDDEN PATTERNS ===

- Do NOT edit any file in src/ except src/main.ts.
- Do NOT import BuildingSystem, CraftingSystem, Inventory etc. from their modules
  and call methods directly from another module file. Only main.ts may do this.
- Do NOT add npm packages not already in package.json.
- Do NOT put EventBus.on() calls inside module class constructors.
- Do NOT use 'claude' in commit messages.

=== KEY INPUT HANDLERS (src/main.ts) ===

Client sends input:
  NetworkClient.send({ type: 'input', playerId: myPlayerId, input: { type: 'harvest'|'attack'|'build'|..., ...fields }, tick })

Host receives input via EventBus.on('network:input', ({ playerId, input }) => { ... })
The handler switch is around line 2578 in src/main.ts. Add new input types as
  } else if ((input as any).type === 'YOUR_NEW_TYPE') { ... }

=== FILES TO KNOW ===

src/main.ts                  — ONLY file you may edit (4032 lines)
src/inventory/CraftingSystem.ts  — canCraft(pid, recipeId), craft(pid, recipeId)
src/inventory/Inventory.ts       — add/remove/get/setInventory
src/inventory/data/recipes.ts    — RECIPES dictionary
src/building/BuildingSystem.ts   — getAll(), takeDamage(), restoreBuilding()
src/network/NetworkHost.ts       — broadcast(), sendTo()
src/network/NetworkClient.ts     — send()
src/dungeon/DungeonScene.ts      — setup(), update(), getSpawnPoint(), isFloor()
src/dungeon/DungeonGenerator.ts  — generateDungeon()
src/combat/MonsterSpawner.ts     — getAllMonsters(), tick(), applyDelta()
src/render/FxLayer.ts            — spawnFloatingText(), spawnHarvest()

=== TESTING CHECKLIST ===

After every feature:
1. Run: npx tsc --noEmit   (must be 0 errors)
2. Host path: open game as host, perform action, check console for broadcast.
3. Client path: join as client, perform same action, verify Host handles it and
   broadcasts result back. Client UI must update correctly.
```

---

## Prompt 01-A — Multiplayer Crafting Sync

**Estimated time:** 45 min (Codex generation ~20 min + human review ~25 min)
**Prerequisites:** Prompt 00 orientation loaded
**Depends on nothing** — this is a standalone feature

### What needs to happen

Currently `craftingUI.setOnCraft()` in `src/main.ts` (around line 1658) calls
`craftingSystem.craft(myPlayerId, recipeId)` directly, with no network sync.
Host crafting works locally. Client crafting also runs locally without asking Host — 
materials are deducted locally but the Host's authoritative state is not updated.

The fix: make crafting follow the same pattern as `furnace_smelt`:
- Host crafts directly, then broadcasts the updated inventory.
- Client sends `{ type: 'craft', recipeId, qty }` input to Host.
- Host validates, crafts, broadcasts `inventory` delta back to the Client (and all players).

```
TASK: Implement multiplayer crafting sync in src/main.ts.

=== CONTEXT ===
File: src/main.ts
The craftingUI.setOnCraft callback is around line 1658.
The network:input EventBus handler (Host side) is around line 2578.

craftingSystem.canCraft(playerId, recipeId) — checks inventory + researchLevel
craftingSystem.craft(playerId, recipeId)    — deducts materials, gives result, emits craft:success
Inventory.get(playerId)                     — returns current inventory array
NetworkHost.broadcast(msg)                  — sends to all clients
NetworkClient.send(msg)                     — sends to host

=== CHANGE 1: craftingUI.setOnCraft callback (around line 1658) ===

Replace the existing body:
  for (let i = 0; i < qty; i++) {
    if (!craftingSystem.canCraft(myPlayerId, recipeId)) break
    craftingSystem.craft(myPlayerId, recipeId)
  }
  const pd = GameStateManager_.getPlayer(myPlayerId)
  craftingUI.show(RECIPES, Inventory.get(myPlayerId), pd?.researchLevel ?? 1)

With:
  if (!myPlayerId) return
  if (RoomManager.role === 'host') {
    let crafted = 0
    for (let i = 0; i < qty; i++) {
      if (!craftingSystem.canCraft(myPlayerId, recipeId)) break
      craftingSystem.craft(myPlayerId, recipeId)
      crafted++
    }
    if (crafted > 0) {
      NetworkHost.broadcast({
        type: 'state_delta',
        tick: GameStateManager_.get().tick,
        delta: { players: { [myPlayerId]: { inventory: Inventory.get(myPlayerId) } } },
      })
    }
    const pd = GameStateManager_.getPlayer(myPlayerId)
    craftingUI.show(RECIPES, Inventory.get(myPlayerId), pd?.researchLevel ?? 1)
  } else {
    // Client: send craft request to Host, do NOT deduct locally
    NetworkClient.send({
      type: 'input',
      playerId: myPlayerId,
      tick: GameStateManager_.get().tick,
      input: { type: 'craft', recipeId, qty } as any,
    })
  }

=== CHANGE 2: Host network:input handler (around line 2578, inside EventBus.on('network:input', ...)) ===

Inside the else-if chain, after the existing 'market_sell' handler (~line 2703),
add a new handler:

  } else if ((input as any).type === 'craft') {
    // Host validates and executes crafting for Client
    const craftReq = input as any
    const cRecipeId: string = craftReq.recipeId
    const cQty: number = Math.max(1, Math.min(Number(craftReq.qty) || 1, 20))  // cap at 20
    let crafted = 0
    for (let ci = 0; ci < cQty; ci++) {
      if (!craftingSystem.canCraft(playerId, cRecipeId)) break
      craftingSystem.craft(playerId, cRecipeId)
      crafted++
    }
    if (crafted > 0) {
      // Broadcast updated inventory to all (so other clients see the item appear)
      NetworkHost.broadcast({
        type: 'state_delta',
        tick: GameStateManager_.get().tick,
        delta: { players: { [playerId]: { inventory: Inventory.get(playerId) } } },
      })
    }

=== AFTER EDITING ===

Run: npx tsc --noEmit
Fix any type errors. Do not edit files other than src/main.ts.
```

### Acceptance criteria

- Host opens crafting panel (C key), crafts an item, other clients see the hotbar update within 1 second.
- Client opens crafting panel, clicks craft, Host console shows `network:input` with `type: 'craft'`, client's hotbar updates.
- Crafting with insufficient materials silently fails (no crash, no deduction).

---

## Prompt 01-B — Dungeon/Relic Multiplayer Sync

**Estimated time:** 65 min (Codex ~30 min + human review ~35 min)
**Prerequisites:** Prompt 00 orientation loaded
**Dependency:** Can run in parallel with 01-A if two people available; otherwise run after 01-A.

### What needs to happen

Currently the dungeon (`_enterDungeon`, `_exitDungeon`) only runs on the local player.
When the Host enters a dungeon, Clients don't know. When a Client enters, only their
local view changes but the Host has no record.

Minimum viable multiplayer dungeon sync:
1. When any player enters a dungeon, broadcast a `dungeon:entered` delta so other
   clients can know (and in the future render the player as "in dungeon").
2. When a player exits, broadcast `dungeon:exited`.
3. Client entering a dungeon: send input `{ type: 'dungeon_enter', instanceSeed }` to Host.
   Host records the player's dungeon seed and broadcasts to others.
4. Dungeon enemies/state stay LOCAL (each player has their own dungeon instance),
   only player position sync is needed.

The goal: Host knows which players are in dungeons, and their world-coordinates while
inside are replaced with dungeon coordinates until they exit.

```
TASK: Add basic dungeon entry/exit multiplayer sync in src/main.ts.

=== CONTEXT ===
_enterDungeon(instanceSeed, retX, retY) is defined around line 345.
_exitDungeon() is defined around line 360.
The 'E' key handler that calls _enterDungeon is around line 2015.
The network:input handler is around line 2578.
The client:state_delta window event listener is around line 3861.

=== STEP 1: Add a per-player dungeon state tracker at the top of bootstrap() ===

After the line `let inDungeon = false` (around line 341), add:
  // Tracks which players are currently in a dungeon instance (playerId → instanceSeed)
  const playerDungeons = new Map<string, number>()

=== STEP 2: Patch _enterDungeon to broadcast when HOST enters ===

At the END of _enterDungeon(), after setting inDungeon = true, add:
  playerDungeons.set(myPlayerId, instanceSeed)
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { dungeonEntered: { playerId: myPlayerId, instanceSeed } } as any,
    })
  }

=== STEP 3: Patch _exitDungeon to broadcast when HOST exits ===

At the END of _exitDungeon(), after setting inDungeon = false, add:
  playerDungeons.delete(myPlayerId)
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { dungeonExited: { playerId: myPlayerId } } as any,
    })
  }

=== STEP 4: Client dungeon entry — send input to Host, then enter locally ===

In the 'E' key handler section for entering a dungeon (around line 2017, inside the
`hotbarUI.activeItem?.itemId === 'dungeon_map'` branch), after calling _enterDungeon:

Currently:
  _enterDungeon(instanceSeed, me2.x, me2.y)

Change to:
  _enterDungeon(instanceSeed, me2.x, me2.y)
  if (RoomManager.role === 'client') {
    NetworkClient.send({
      type: 'input',
      playerId: myPlayerId,
      tick: GameStateManager_.get().tick,
      input: { type: 'dungeon_enter', instanceSeed, retX: me2.x, retY: me2.y } as any,
    })
  }

=== STEP 5: Client dungeon exit — send input to Host, then exit locally ===

In the 'E' key handler for _exitDungeon (around line 1981), after calling _exitDungeon():

Currently:
  _exitDungeon()
  fxLayer.spawnFloatingText(...)

Change to:
  _exitDungeon()
  fxLayer.spawnFloatingText(me2.x, me2.y - 30, t('game.leave_dungeon'), 0x00ffaa)
  if (RoomManager.role === 'client') {
    NetworkClient.send({
      type: 'input',
      playerId: myPlayerId,
      tick: GameStateManager_.get().tick,
      input: { type: 'dungeon_exit' } as any,
    })
  }
  return

=== STEP 6: Host network:input handler — handle dungeon_enter and dungeon_exit ===

Inside EventBus.on('network:input', ...), add after the last else-if block:

  } else if ((input as any).type === 'dungeon_enter') {
    const dReq = input as any
    playerDungeons.set(playerId, dReq.instanceSeed)
    // Broadcast to other clients so they know this player is in a dungeon
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { dungeonEntered: { playerId, instanceSeed: dReq.instanceSeed } } as any,
    })

  } else if ((input as any).type === 'dungeon_exit') {
    playerDungeons.delete(playerId)
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { dungeonExited: { playerId } } as any,
    })

=== STEP 7: Handle dungeonEntered / dungeonExited in client:state_delta listener ===

Inside the 'client:state_delta' window event listener (around line 3861),
after the existing demolishedBuildings block, add:

  // Dungeon sync: track which players are in dungeons
  const dungeonEntered = (msg.delta as any).dungeonEntered as { playerId: string; instanceSeed: number } | undefined
  if (dungeonEntered && dungeonEntered.playerId !== myPlayerId) {
    playerDungeons.set(dungeonEntered.playerId, dungeonEntered.instanceSeed)
    // Optionally show a floating text to local player
    const enteringPlayer = GameStateManager_.getPlayer(dungeonEntered.playerId)
    if (enteringPlayer) {
      fxLayer.spawnFloatingText(
        players.get(myPlayerId)?.x ?? 0,
        (players.get(myPlayerId)?.y ?? 0) - 40,
        `${enteringPlayer.name ?? '?'} entered relic`,
        0xff9900,
      )
    }
  }

  const dungeonExited = (msg.delta as any).dungeonExited as { playerId: string } | undefined
  if (dungeonExited && dungeonExited.playerId !== myPlayerId) {
    playerDungeons.delete(dungeonExited.playerId)
  }

=== AFTER EDITING ===

Run: npx tsc --noEmit
Fix any type errors. Do not edit files other than src/main.ts.
```

### Acceptance criteria

- Host enters dungeon (uses dungeon_map item + E key): Client console shows `dungeonEntered` in the delta within 1 second, and a floating text appears on the Client screen.
- Client enters dungeon: Host's `playerDungeons` Map contains the client's ID after the entry.
- Exiting dungeon from either side removes the entry from `playerDungeons` and broadcasts `dungeonExited`.

---

## Prompt 02-A — Building Damage Sync to Clients

**Estimated time:** 40 min (Codex ~15 min + human review ~25 min)
**Prerequisites:** Prompt 00 orientation loaded
**Dependency:** None (independent of 01-A and 01-B)

### What needs to happen

When a monster attacks a building (via `monsterSpawner.setHitBuildingCallback`), the Host
calls `buildingSystem.takeDamage(buildingId, damage)` which changes `b.hp` and sets
`b.alpha = 0.3` (visual damage). The Host already broadcasts `{ buildings: { [buildingId]: { hp } } }`.

However, on the Client side, the `client:state_delta` handler processes the building delta
only as an array (new buildings) or as an object patch — but it does NOT update the visual
alpha on the existing sprite. The Client sees the building with full opacity even when
it should be semi-transparent (damaged).

The fix: After patching `existing` with new hp in the `client:state_delta` handler,
call `buildingSystem.restoreBuilding(existing)` — which already handles alpha.
Also ensure `buildingSystem.takeDamage` broadcasts the full building patch including `alpha`.

```
TASK: Fix building damage visual sync for Clients in src/main.ts.

=== CONTEXT ===

The monsterSpawner.setHitBuildingCallback is around line 1069.
The client:state_delta building handler is around line 3913 (inside 'client:state_delta' listener).
BuildingSystem.takeDamage(buildingId, damage) returns true if destroyed.
BuildingSystem.restoreBuilding(building) creates or updates the visual sprite,
  including setting alpha based on hp/maxHp.

=== CHANGE 1: Broadcast alpha in the hit-building callback (around line 1069) ===

Find the existing broadcast inside setHitBuildingCallback:
  if (b) NetworkHost.broadcast({
    type: 'state_delta', tick: GameStateManager_.get().tick,
    delta: { buildings: { [buildingId]: { hp: b.hp } } } as any,
  })

Change it to also include maxHp (needed for Client to compute alpha):
  if (b) NetworkHost.broadcast({
    type: 'state_delta', tick: GameStateManager_.get().tick,
    delta: { buildings: { [buildingId]: { hp: b.hp, maxHp: b.maxHp } } } as any,
  })

=== CHANGE 2: Client state_delta building patch handler (around line 3913) ===

Find the else branch that patches existing buildings:
  } else {
    for (const [id, patch] of Object.entries(buildingDelta)) {
      const existing = buildingSystem.getAll().find(b => b.id === id)
      if (existing) {
        Object.assign(existing, patch)
        buildingSystem.restoreBuilding(existing)
      }
    }
  }

This already calls restoreBuilding — verify that BuildingSystem.restoreBuilding
correctly updates alpha when hp < maxHp. If it does not, add explicit alpha logic:

  } else {
    for (const [id, patch] of Object.entries(buildingDelta)) {
      const existing = buildingSystem.getAll().find(b => b.id === id)
      if (existing) {
        Object.assign(existing, patch)
        // Reflect damage alpha visually (same rule as BuildingSystem.takeDamage)
        if (typeof existing.hp === 'number' && typeof existing.maxHp === 'number') {
          const ratio = existing.hp / existing.maxHp
          // restoreBuilding will set alpha based on hp
        }
        buildingSystem.restoreBuilding(existing)
      }
    }
  }

=== CHANGE 3: Check BuildingSystem.takeDamage sets alpha ===

READ (do not edit) src/building/BuildingSystem.ts to confirm takeDamage sets:
  b.hp = Math.max(0, b.hp - damage)
  sprite.alpha = b.hp <= 0 ? 0.3 : 1.0   (or similar)

If restoreBuilding also applies alpha (hp <= 0 → alpha 0.3), then CHANGE 2 alone is sufficient.
Do NOT edit BuildingSystem.ts.

=== AFTER EDITING ===

Run: npx tsc --noEmit
```

### Acceptance criteria

- Host takes building damage from monsters at night: Client sees the same building become semi-transparent (alpha ~0.3) within the next broadcast tick (~4 frames).
- When building is destroyed (hp = 0), both Host and Client show it at alpha 0.3.
- When Host repairs a trap (R key), Client sprite returns to alpha 1.0.

---

## Prompt 02-B — Soldier System Multiplayer Sync

**Estimated time:** 40 min (Codex ~15 min + human review ~25 min)
**Prerequisites:** Prompt 00 orientation loaded
**Dependency:** None (independent of other prompts)

### What needs to happen

Soldiers currently live only in Host memory (`soldiers: SoldierEntry[]`) around line 444.
The Client sees no soldiers at all. The fix: every few ticks the Host broadcasts
soldier positions/states as a delta, and the Client renders simple placeholder sprites
for each soldier position received.

Strategy: broadcast a compact soldier snapshot every 4 ticks (same cadence as monsters),
and handle it in `client:state_delta`.

```
TASK: Add soldier sync to Clients in src/main.ts.

=== CONTEXT ===

The soldiers array is defined around line 444: `const soldiers: SoldierEntry[] = []`
The SoldierEntry interface is defined around line 445.
The soldier AI update loop is around line 3099 (inside GameLoop.addCallback).
The monster broadcast in the game loop is around line 3020:
  if (tick % 4 === 0 && deltas.length > 0) {
    NetworkHost.broadcast({ type: 'state_delta', tick, delta: { monsters: deltas } as any })
  }
The client:state_delta listener is around line 3861.

=== STEP 1: Define a compact soldier snapshot type near the SoldierEntry interface ===

After line `const soldiers: SoldierEntry[] = []`, add:
  // Compact snapshot for network broadcast
  interface SoldierSnapshot {
    id: string
    barracksId: string
    x: number
    y: number
    hp: number
    maxHp: number
    dead: boolean
  }
  // Client-side soldier sprite map (only used on Client)
  const clientSoldierSprites = new Map<string, PIXI.Container>()

=== STEP 2: Broadcast soldier snapshots every 4 ticks (Host side) ===

Inside the `if (RoomManager.role === 'host')` block in GameLoop.addCallback
(around line 3100), after the existing soldier AI update loop completes
(after the farm produce section, around line 3188), add:

  // Broadcast soldier state every 4 ticks
  if (tick % 4 === 0 && soldiers.length > 0) {
    const soldierSnapshots: SoldierSnapshot[] = soldiers.map(s => ({
      id: s.id,
      barracksId: s.barracksId,
      x: s.x,
      y: s.y,
      hp: s.hp,
      maxHp: s.maxHp,
      dead: s.dead,
    }))
    NetworkHost.broadcast({
      type: 'state_delta',
      tick,
      delta: { soldiers: soldierSnapshots } as any,
    })
  }
  // If all soldiers are gone, broadcast empty list to clear client sprites
  if (tick % 4 === 0 && soldiers.length === 0 && clientSoldierSprites.size === 0) {
    // nothing to do
  }

=== STEP 3: Handle soldier delta on Client in client:state_delta listener ===

Inside the 'client:state_delta' window event listener (around line 3861),
after the dungeonExited block (or after the demolishedBuildings block if 01-B was not done),
add:

  // Soldier sync (Client side: render simple sprites from Host snapshot)
  const soldierDelta = (msg.delta as any).soldiers as SoldierSnapshot[] | undefined
  if (soldierDelta && RoomManager.role !== 'host') {
    const receivedIds = new Set<string>()
    for (const snap of soldierDelta) {
      receivedIds.add(snap.id)
      if (snap.dead) {
        // Remove dead soldier sprite
        const existing = clientSoldierSprites.get(snap.id)
        if (existing) {
          objectsLayer.removeChild(existing)
          existing.destroy()
          clientSoldierSprites.delete(snap.id)
        }
        continue
      }
      let sprite = clientSoldierSprites.get(snap.id)
      if (!sprite) {
        // Create a simple soldier placeholder sprite
        sprite = new PIXI.Container()
        const gfx2 = new PIXI.Graphics()
        gfx2.rect(-6, -16, 12, 10).fill(0x4a7a2a)
        gfx2.rect(-4, -6, 8, 12).fill(0x3a5a1a)
        gfx2.circle(0, -22, 7).fill(0xcc9966)
        gfx2.rect(-8, -18, 16, 4).fill(0x2a4a0a)
        gfx2.rect(6, -16, 3, 8).fill(0x888888)
        sprite.addChild(gfx2)
        objectsLayer.addChild(sprite)
        clientSoldierSprites.set(snap.id, sprite)
      }
      sprite.x = snap.x
      sprite.y = snap.y
      sprite.zIndex = snap.y + 21
      sprite.visible = !snap.dead
    }
    // Remove sprites for soldiers no longer in the snapshot
    for (const [sid, sprite] of clientSoldierSprites) {
      if (!receivedIds.has(sid)) {
        objectsLayer.removeChild(sprite)
        sprite.destroy()
        clientSoldierSprites.delete(sid)
      }
    }
  }

=== AFTER EDITING ===

Run: npx tsc --noEmit
The PIXI import is already at the top of main.ts. SoldierSnapshot is a local interface —
define it inside bootstrap() alongside SoldierEntry.
```

### Acceptance criteria

- Host has a barracks, soldiers spawn: Client screen shows green soldier sprites at the same positions as the Host within ~4 ticks.
- Soldier dies on Host: Client sprite disappears within the next 4-tick broadcast.
- No TypeScript errors after edit.

---

## Prompt 02-C — Equipment Slot Multiplayer Sync

**Estimated time:** 40 min (Codex ~15 min + human review ~25 min)
**Prerequisites:** Prompt 00 orientation loaded
**Dependency:** None (independent)

### What needs to happen

When Host or Client equips armor (G key), `(pd as any).equipped = { armor: activeItem.itemId }`
is set on the local `GameStateManager_` player data, but it is never broadcast.
Other players cannot see each other's equipped armor badge (the EquipUI is local-only anyway),
but more importantly the armor's damage-reduction (`defPct`) is only applied on the Host
because only Host knows the armor data at damage time.

Fix: after equipping or unequipping, broadcast the `equipped` field as part of the player delta.

```
TASK: Broadcast equipped armor changes so Host applies the correct defPct for all players
      and all clients can display the equipped state if desired. Edit only src/main.ts.

=== CONTEXT ===

The G-key equip handler is around line 2322 in src/main.ts.
The G-key section has two branches: "already equipped → unequip" and "equip new".
The monsterSpawner.setHitPlayerCallback reads (pd as any).equipped?.armor around line 1143.

=== CHANGE 1: After equipping armor (around line 2347), broadcast the equipped field ===

Find the block that sets the equipped armor:
  ;(pd as any).equipped = { armor: activeItem.itemId }
  GameStateManager_.setPlayer(myPlayerId, pd)
  hotbarUI.show(Inventory.get(myPlayerId))
  ...

After the `GameStateManager_.setPlayer(myPlayerId, pd)` line, add:
  // Broadcast equipped state so Host applies correct defPct and other clients can display it
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { players: { [myPlayerId]: {
        equipped: (pd as any).equipped,
        inventory: Inventory.get(myPlayerId),
      } } },
    })
  } else {
    NetworkClient.send({
      type: 'input',
      playerId: myPlayerId,
      tick: GameStateManager_.get().tick,
      input: { type: 'equip_armor', armorId: activeItem.itemId } as any,
    })
  }

=== CHANGE 2: After unequipping armor (around line 2333), broadcast the unequip ===

Find the block that unequips:
  ;(pd as any).equipped = { armor: null }
  Inventory.add(myPlayerId, activeItem.itemId, 1)
  GameStateManager_.setPlayer(myPlayerId, pd)
  hotbarUI.show(Inventory.get(myPlayerId))
  equipUI.clearArmor()
  ...

After `GameStateManager_.setPlayer(myPlayerId, pd)`, add:
  if (RoomManager.role === 'host') {
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { players: { [myPlayerId]: {
        equipped: { armor: null },
        inventory: Inventory.get(myPlayerId),
      } } },
    })
  } else {
    NetworkClient.send({
      type: 'input',
      playerId: myPlayerId,
      tick: GameStateManager_.get().tick,
      input: { type: 'unequip_armor' } as any,
    })
  }

=== CHANGE 3: Host network:input handler — handle equip_armor and unequip_armor ===

Inside EventBus.on('network:input', ...), after the last else-if block, add:

  } else if ((input as any).type === 'equip_armor') {
    const eReq = input as any
    const armorId: string = eReq.armorId
    const pdE = GameStateManager_.getPlayer(playerId)
    if (!pdE) return
    // Refund previous armor if any
    const prev = (pdE as any).equipped?.armor as string | undefined
    if (prev) Inventory.add(playerId, prev, 1)
    Inventory.remove(playerId, armorId, 1)
    ;(pdE as any).equipped = { armor: armorId }
    GameStateManager_.setPlayer(playerId, pdE)
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { players: { [playerId]: {
        equipped: { armor: armorId },
        inventory: Inventory.get(playerId),
      } } },
    })

  } else if ((input as any).type === 'unequip_armor') {
    const pdU = GameStateManager_.getPlayer(playerId)
    if (!pdU) return
    const prevArmor = (pdU as any).equipped?.armor as string | undefined
    if (prevArmor) Inventory.add(playerId, prevArmor, 1)
    ;(pdU as any).equipped = { armor: null }
    GameStateManager_.setPlayer(playerId, pdU)
    NetworkHost.broadcast({
      type: 'state_delta',
      tick: GameStateManager_.get().tick,
      delta: { players: { [playerId]: {
        equipped: { armor: null },
        inventory: Inventory.get(playerId),
      } } },
    })

=== CHANGE 4: Ensure client:state_delta applies the `equipped` field ===

In the 'client:state_delta' handler, the players delta is merged with:
  const next = { ...(current ?? { id: playerId }), ...(delta ?? {}), id: playerId }
  GameStateManager_.setPlayer(playerId, next)

Because `equipped` is part of the delta, it is automatically merged. No additional change needed.
However, VERIFY this is the case by checking the spread around line 3868–3872.
If the spread does a shallow merge, `equipped: { armor: null }` from delta will correctly
overwrite the old value. Confirm and leave it as is.

=== AFTER EDITING ===

Run: npx tsc --noEmit
```

### Acceptance criteria

- Host equips armor (G key): all connected clients have `GameStateManager_.getPlayer(hostId).equipped.armor` set correctly within 1 second.
- Client equips armor: Host receives `equip_armor` input, broadcasts updated `equipped` + `inventory`, and the correct `defPct` is applied when that client takes damage.
- Unequipping returns the armor to inventory for both Host and Client.

---

## Prompt 02-D — Visual Effects (Laser Beam + Cannonball Animation)

**Estimated time:** 25 min (Codex ~10 min + human review ~15 min)
**Prerequisites:** Prompt 00 orientation loaded; runs entirely on Host (visual only, no network changes needed)
**Dependency:** None

### What needs to happen

The laser_tower and cannon_tower currently deal damage instantly with only floating text
as feedback (`⚡` or `💥`). This prompt adds real PixiJS visual effects:

- **Laser tower**: draw a glowing line from tower center to target for ~150 ms.
- **Cannon tower**: spawn a cannonball `PIXI.Graphics` circle that travels from tower to target
  over `~400 ms`, then plays the existing `fxLayer.spawnDepletionBurst` explosion.

Both effects run locally (Host only for now; Client sees nothing, acceptable for the hackathon).

```
TASK: Add laser beam and cannonball travel animations to defensive towers in src/main.ts.
Edit only src/main.ts. Use only PIXI (already imported).

=== CONTEXT ===

The defensive tower auto-attack loop is around line 3190 inside GameLoop.addCallback.
fxLayer is a FxLayer instance. fxLayer.spawnDepletionBurst(x, y, type) already exists.
PIXI.Graphics, PIXI.Ticker are already available.
The camera container is named `camera` (world-coordinate graphics go inside it).
objectsLayer is inside camera.

=== STEP 1: Add a simple laser beam effect helper BEFORE GameLoop.addCallback ===

In src/main.ts, before the `GameLoop.addCallback((_delta, tick) => {` line
(around line 2887), add:

  /** Draw a brief laser line from (x1,y1) to (x2,y2) in world coordinates */
  function spawnLaserBeam(x1: number, y1: number, x2: number, y2: number): void {
    const beam = new PIXI.Graphics()
    beam.moveTo(x1, y1)
    beam.lineTo(x2, y2)
    beam.stroke({ color: 0x44aaff, width: 3, alpha: 0.9 })
    // Outer glow
    const glow = new PIXI.Graphics()
    glow.moveTo(x1, y1)
    glow.lineTo(x2, y2)
    glow.stroke({ color: 0x88ccff, width: 8, alpha: 0.25 })
    objectsLayer.addChild(glow)
    objectsLayer.addChild(beam)
    // Remove after 150 ms
    setTimeout(() => {
      objectsLayer.removeChild(glow)
      objectsLayer.removeChild(beam)
      glow.destroy()
      beam.destroy()
    }, 150)
  }

=== STEP 2: Add cannonball travel state array BEFORE GameLoop.addCallback ===

  interface CannonballFlight {
    sprite: PIXI.Graphics
    startX: number; startY: number
    targetX: number; targetY: number
    spawnMs: number
    travelMs: number
  }
  const cannonballs: CannonballFlight[] = []

  function spawnCannonball(fromX: number, fromY: number, toX: number, toY: number): void {
    const sprite = new PIXI.Graphics()
    sprite.circle(0, 0, 6).fill(0x333333)
    sprite.circle(0, 0, 6).stroke({ color: 0x666666, width: 1.5 })
    sprite.x = fromX; sprite.y = fromY
    objectsLayer.addChild(sprite)
    cannonballs.push({ sprite, startX: fromX, startY: fromY, targetX: toX, targetY: toY,
      spawnMs: performance.now(), travelMs: 400 })
  }

=== STEP 3: Update cannonballs in the GameLoop.addCallback ===

Inside GameLoop.addCallback, just before the camera-follow section (~line 3392), add:

  // Cannonball flight animation
  const nowCb = performance.now()
  for (let cbi = cannonballs.length - 1; cbi >= 0; cbi--) {
    const cb = cannonballs[cbi]
    const progress = Math.min(1, (nowCb - cb.spawnMs) / cb.travelMs)
    cb.sprite.x = cb.startX + (cb.targetX - cb.startX) * progress
    cb.sprite.y = cb.startY + (cb.targetY - cb.startY) * progress - Math.sin(progress * Math.PI) * 30
    if (progress >= 1) {
      objectsLayer.removeChild(cb.sprite)
      cb.sprite.destroy()
      cannonballs.splice(cbi, 1)
      fxLayer.spawnDepletionBurst(cb.targetX, cb.targetY, 'iron')
    }
  }

=== STEP 4: Replace emoji feedback with real effects in the tower loop (around line 3238) ===

Find:
  if (b.defId === 'laser_tower') {
    fxLayer.spawnFloatingText(bCx, bCy - 30, '⚡', 0x66AAFF)
  } else {
    fxLayer.spawnFloatingText(bCx, bCy - 30, '🏹', 0xAAFF88)
  }

Replace with:
  if (b.defId === 'laser_tower') {
    spawnLaserBeam(bCx, bCy, target.x, target.y)
  } else {
    // tower (watchtower): keep arrow emoji for now
    fxLayer.spawnFloatingText(bCx, bCy - 30, '🏹', 0xAAFF88)
  }

Find the cannon_tower block (the `if (cfg.aoe > 0)` branch, around line 3226):
  fxLayer.spawnDepletionBurst(target.x, target.y, 'iron')
  for (const m of allMon) { ... }
  fxLayer.spawnFloatingText(bCx, bCy - 30, '💥', 0xFF8800)

Change to:
  // Spawn cannonball — explosion happens when it arrives (inside cannonball update loop)
  spawnCannonball(bCx, bCy, target.x, target.y)
  // Still deal damage immediately (gameplay is not delayed by animation)
  for (const m of allMon) {
    const d = Math.hypot(m.x - target.x, m.y - target.y)
    if (d < cfg.aoe) {
      const actualDmg = Math.floor(cfg.dmg * (d < TILE_SIZE ? 1 : 0.5))
      monsterSpawner.hitMonster(m.id, actualDmg, b.id)
      fxLayer.spawnFloatingText(m.x, m.y - 12, `-${actualDmg}`, 0xFF6600)
    }
  }

Note: Remove the old fxLayer.spawnDepletionBurst line since the cannonball update loop
now calls it on arrival. Also remove the old damage loop since we now have it above.

=== AFTER EDITING ===

Run: npx tsc --noEmit
```

### Acceptance criteria

- Laser tower fires: a blue glowing line appears for ~150 ms from tower to target in world space.
- Cannon tower fires: a dark grey circle travels from tower to target over ~400 ms, then a burst explosion plays at the target.
- No existing damage behavior is changed (damage is still applied instantly on Host).
- No TypeScript errors.

---

## Notes for Review Between Prompts

- After each Codex output, run `npx tsc --noEmit` before committing.
- Check the browser console for errors (open devtools before each test).
- Host-path test: create a room, perform the action, observe console output.
- Client-path test: have a second browser tab join the room, perform the action or receive the broadcast.
- Commit message format: `feat: <feature name> multiplayer sync` (no "claude" in message).
- If Codex introduces a type error in a file other than `src/main.ts`, do NOT edit that file —
  report the issue and ask Codex to adjust the approach using only `src/main.ts`.
