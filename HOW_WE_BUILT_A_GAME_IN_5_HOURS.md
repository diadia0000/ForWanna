# How We Built a Multiplayer Game in 5 Hours with a Agent AI Workflow

We built a real-time multiplayer sandbox game for a hackathon — resource harvesting, crafting, building, combat, procedural dungeons, P2P networking, day/night cycle, save/load, i18n, a full HUD.

It's a PixiJS 8 + TypeScript browser game. P2P multiplayer via PeerJS WebRTC, no backend, runs offline, persists to IndexedDB. This document explains how the workflow was structured.

---

## The Short Version

We ran **17 specialized sub-agents in parallel**, each owning exactly one module directory, coordinated by a strict harness of rules, MCP tools, skills, and automated hooks. No agent could modify another agent's files. Every cross-module call goes through a typed EventBus. A dedicated Event Architect guards the shared type contracts. A Stop hook runs TypeScript type-checking after every agent stops, so broken code can't accumulate.

The output: **135 TypeScript source files**, a **4,349-line integration entry point** (`main.ts`), **84 compressed context snapshots** (SKILL.md files), and a working multiplayer game.

---

## The Agent Team: 17 Sub-Agents, One Codebase

Each agent maps to exactly one directory under `src/`. No agent touches any other directory. This is enforced, not just suggested.

| Agent | Module | Core Responsibility |
|-------|--------|---------------------|
| Agent 1 — Core Engine | `src/core/` | PixiJS App, GameLoop, EventBus, GameState |
| Agent 2 — Network Layer | `src/network/` | PeerJS WebRTC Host/Client, room management, state sync |
| Agent 3 — World/Map | `src/world/` | Procedural world generation, TileMap rendering, chunk management |
| Agent 4 — Player | `src/player/` | Player entity, client-side prediction & reconciliation |
| Agent 5 — Resources | `src/resources/` | Resource nodes (trees/rocks/ores), spawner, respawn logic |
| Agent 6 — Inventory+Crafting | `src/inventory/` | Backpack, crafting system, item & recipe data |
| Agent 7 — Building | `src/building/` | Building placement, HP/damage/repair, upgrade system |
| Agent 8 — Save System | `src/save/` | Dexie.js IndexedDB persistence, world/player save & load |
| Agent 9 — UI/HUD | `src/ui/` | Lobby, HUD, hotbar, all panels (inventory/crafting/furnace/market/barracks/base-core) |
| Agent 10 — Integrator | `src/main.ts` | Wires all modules together in the correct initialization order |
| Agent 11 — Combat | `src/combat/` | Monster AI state machine, wave spawning, elites, bosses, weapon defs |
| Agent 12 — Quest | `src/quest/` | Milestone tracking, quest panel UI |
| Agent 13 — Render | `src/render/` | Particle FX, day/night cycle, asset loading |
| Agent 14 — Dungeon | `src/dungeon/` | Procedural dungeon (遺跡) generation, boss room mechanics |
| Agent 15 — Treasure | `src/treasure/` | Overworld chest spawning, rarity tiers, loot tables |
| Agent 16 — i18n | `src/core/i18n/` + `src/locales/` | Translation engine, zh-TW + English, 22 namespaces |
| Event Architect | `src/types/index.ts` + `events.md` | Shared type contracts, EventBus event registry — the only one who can modify these |

The Integrator (Agent 10) had one rule: wait until every other agent finishes, then wire everything in `main.ts` in the correct boot order. It cannot touch any other file.

---

## The Hard Rules: Module Isolation by Decree

Every agent operates under a set of absolute prohibitions encoded in `.claude/rules/development-rules.md`:

```
🚫 No modifying files outside your own directory
🚫 No modifying src/types/index.ts (only Event Architect can)
🚫 No direct cross-module imports — everything goes through EventBus
🚫 No npm install of packages not already in package.json
🚫 No deleting another agent's files
🚫 No "claude" in git commit messages
🚫 Only check your own completion checkbox — never another agent's
```

These aren't guidelines. They're machine-readable rules that the harness enforces. What this achieves in practice: when Agent 7 (Building) needs to know how many items a player has, it doesn't import Inventory. It emits an event. When Agent 11 (Combat) kills a monster, it doesn't call UI directly. It emits an event. The EventBus is the **only** bridge between modules.

The one exception: every agent can import from `src/core/` (EventBus, GameState, App, GameLoop). The core layer is the foundation, not a peer.

---

## The EventBus Contract: 20+ Typed Events, One Gatekeeper

All cross-module communication flows through a fully typed EventBus. The contract lives in two places that must always stay in sync:

- `src/types/index.ts` → `GameEvents` interface (TypeScript type safety)
- `.claude/claudemd/events.md` → human-readable source of truth

Sample of the event registry:

| Event | Payload | Sender | Receiver |
|-------|---------|--------|----------|
| `resource:collected` | `{ playerId, type, amount }` | ResourceNode | Inventory, QuestSystem |
| `inventory:changed` | `{ playerId, inventory }` | Inventory | CraftingUI, InventoryUI, HotbarUI |
| `craft:success` | `{ playerId, recipeId, result }` | CraftingSystem | main.ts (quest tracking) |
| `build:placed` | `{ playerId, buildingId, x, y }` | BuildingSystem | main.ts (quest + autosave trigger) |
| `treasure:opened` | `{ chestId, loot }` | TreasureSpawner | main.ts (loot → inventory) |
| `i18n:changed` | `{ lang }` | I18n.setLang | Every UI panel (triggers redraw) |
| `save:request` / `save:complete` | `{}` | HUD / SaveManager | main.ts |
| `network:connected` / `network:disconnected` | `{ playerId }` | NetworkHost | main.ts, UI |
| `player:died` | `{ playerId }` | main.ts | autosave trigger |
| `building:upgraded` | `{ playerId, buildingId, newLevel }` | BuildingSystem | autosave trigger |

Any event emitted with `as any` is a flagged contract violation. The Event Architect reviews and either formalizes it into `GameEvents` or requires removal.

New events need architect review before any agent implements them. The process: open a GitHub Discussion, agree on payload, architect updates `events.md` + `types/index.ts`, then agents implement.

---

## The Harness Engineering

### Stop Hook: Mandatory TypeScript Check After Every Agent Stop

`.claude/settings.json` registers a Stop lifecycle hook:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "bash \"${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/typecheck-on-stop.sh\"",
        "statusMessage": "型別檢查中…"
      }]
    }]
  }
}
```

The script (`.claude/hooks/typecheck-on-stop.sh`):

```bash
output="$(npx tsc --noEmit 2>&1)"
status=$?
printf '%s\n' "$output" | head -40
if [ "$status" -eq 0 ]; then
  echo '✅ 型別檢查通過，可以安全收工'
else
  echo '⚠️  有型別錯誤，請修復後再收工'
fi
```

Every time an agent finishes work, TypeScript runs. The agent cannot mark itself done while type errors exist. This prevents error accumulation across 17 parallel workstreams — the most common failure mode in multi-agent code generation.

### Permission Allowlist: 26 Pre-Approved Operations

Instead of prompting for permission on every tool call, we pre-approved the safe operations in `settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__codegraph__codegraph_search",
      "mcp__codegraph__codegraph_context",
      "mcp__codegraph__codegraph_callers",
      "mcp__codegraph__codegraph_callees",
      "mcp__codegraph__codegraph_impact",
      "mcp__codegraph__codegraph_node",
      "mcp__codegraph__codegraph_status",
      "mcp__codegraph__codegraph_explore",
      "mcp__codegraph__codegraph_files",
      "mcp__codegraph__codegraph_trace",
      "Read",
      "Bash(git *)",
      "Bash(npx tsc *)",
      "Bash(npx vite *)",
      "Bash(npx vitest *)",
      "Bash(npm run *)",
      "Bash(npm test *)",
      "Bash(npm ci)",
      "Bash(npm list *)",
      "Bash(node *)",
      "Bash(codegraph *)"
    ]
  }
}
```

Read operations, all CodeGraph queries, and constrained Bash patterns are auto-approved. Write/Edit/destructive operations still require explicit approval. This eliminates interrupt latency for the high-frequency operations (codegraph queries + file reads) while preserving human oversight on writes.

### Agent Rule Files: Machine-Readable Constraints

Two files in `.claude/rules/` are automatically loaded by every agent at session start via CLAUDE.md(the setting is smae as the codex,copy it to the `.codex` dir):

- **`development-rules.md`** — the absolute prohibitions (no cross-directory writes, no direct cross-module imports, no `npm install`, no modifying `src/types/index.ts`). Written as a checklist so agents can self-audit before committing.
- **`codegraph-rules.md`** — forces every code write to start with exactly one CodeGraph query. Defines the lookup-by-intent table so agents pick the right tool first rather than falling back to grep.

Agents don't "know" these rules from training — they're injected into every session as context. The distinction matters: if the rules lived only in a system prompt, they'd be invisible to the agents. Checked-in files in the repo mean every agent, every session, reads the same constraint set from the same source of truth.

### CI Pipeline: GitHub Actions on Every PR

```yaml
# .github/workflows/ci.yml
# tsc --noEmit && npm test on every push to dev/main
```

No PR merges without TypeScript compiling clean and all vitest tests passing. The agents know this — they can't ship broken contracts.

### Git Pre-Push Hook: Type Check Before Push

`scripts/setup-hooks.sh` installs a shared pre-push hook that runs `tsc --noEmit` before any push reaches the remote. Belt and suspenders with the Stop hook.

---

## CodeGraph MCP: Structural Code Intelligence as a Tool Call

The standard search loop (grep → read file → understand imports → repeat) is slow and context-expensive. We wired up **CodeGraph**, a tree-sitter-parsed knowledge graph of every symbol in the workspace, as an MCP server.

`.mcp.json`:
```json
{
  "mcpServers": {
    "codegraph": {
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

10 tools available to every agent, sub-millisecond response:

| Tool | What it answers |
|------|----------------|
| `codegraph_search` | "Where is symbol X defined?" |
| `codegraph_context` | "What's the full context for task/feature area X?" |
| `codegraph_callers` | "What calls function Y?" |
| `codegraph_callees` | "What does Y call?" |
| `codegraph_trace` | "How does X reach Y? Give me the full call path including callbacks and JSX hops." |
| `codegraph_impact` | "What would break if I changed Z?" |
| `codegraph_node` | "Show me Z's source / signature / docstring" |
| `codegraph_explore` | "Show me several related symbols' source at once" |
| `codegraph_files` | "What files exist under this directory?" |
| `codegraph_status` | "Is the index healthy / how many symbols?" |

The rule: **every code write starts with one CodeGraph query**. You don't grep first. You don't open files speculatively. You call `codegraph_context` once, get back the relevant symbols with locations and signatures, then read only those files.

This keeps per-agent context windows tight. Instead of reading 3,000 lines to find one function, you get the function signature and file location in a single MCP call.

---

## The 84 SKILL.md Files: Compressed Context Snapshots

Each module and significant class has a `SKILL.md` file — a compressed, human + machine readable snapshot of that unit's:
- Public interface (method signatures, parameters, return types)
- Key invariants and architectural decisions
- Integration points with EventBus
- Common failure modes and gotchas
- build instructions with exact code snippets

The skill library spans the entire codebase:
(codex is similar claude code)
```
.claude/skills/
├── building/     (BuildingPlacer, BuildingSystem, data/buildings, index)
├── combat/       (ArmorDefs, index, Monster, MonsterSpawner, WeaponDefs)
├── core/         (App, EventBus, GameLoop, GameState, i18n/*)
├── dungeon/      (DungeonGenerator, DungeonScene, index)
├── inventory/    (CraftingSystem, data/*, index, Inventory)
├── locales/      (en, index, zh-TW)
├── main/         (SKILL.md + 5 reference sub-files covering all 4,349 lines)
├── network/      (index, MessageTypes, NetworkClient, NetworkHost, RoomManager)
├── player/       (ClientPrediction, index, Player)
├── quest/        (index, milestones, QuestSystem, QuestUI)
├── render/       (AssetLoader, DayNight, EntitySpriteDriver, FxLayer, index, ...)
├── resources/    (index, resourceConfig, ResourceNode, spawnConfig, Spawner)
├── save/         (GameDB, index, SaveManager, SyncProtocol)
├── style/        (full CSS reference for all UI panels)
├── treasure/     (index, TreasureChest, treasureConfig, TreasureSpawner)
├── types/        (index — shared type contracts)
├── ui/           (BagUI, BarracksUI, BaseCoreUI, BuildingUI, CraftingUI, ...)
└── world/        (index, TileMap, WorldGen)
```

`main.ts` alone is complex enough to need its own SKILL with **5 reference sub-files**, each covering a part of bootstrap function. The main skill is the index; agents expand only the reference they need.

When an agent starts a task, it loads the skill for its module. This replaces reading the actual source file — same information, a fraction of the tokens.

### How the SKILL Files Were Produced: A Codex–Claude API Relay

These 84 files weren't written by hand. They were produced through a **Codex CLI → Claude API review loop** — a meta-workflow running on top of the game development workflow itself.

The pipeline per module:

1. **Codex generates a draft SKILL.md** by reading the source file, inferring the public interface, extracting key invariants, and formatting it to the standard frontmatter schema (`name`, `description`, `metadata.type`, body with `[[link]]` references). Fast, pattern-following, broad coverage across 135 files.

2. **The draft is fed back to Claude via API call** for an audit pass — checking: are method signatures accurate against the actual source? Are EventBus integration points documented? Are the failure modes correct? Is the rebuild guidance usable? This is the catch layer: slower, higher precision, patches what the generator missed or hallucinated.

3. **The `/skill-creator` skill defines the schema** both passes work against — Codex CLI's built-in skill-creator specifies what a valid SKILL.md must contain. The generator conforms to the schema; the auditor validates against it.

The relay exploits the asymmetry: Codex's breadth (synthesizes a 1,000-line file quickly into 200 lines of documentation) combined with Claude's depth (reasons about whether the documented behavior is actually correct). Neither alone works reliably at this scale — generation alone produces confident hallucinations, and review-without-generation spends the full context budget just reading.

The result: 84 skills an agent can trust enough to substitute for reading source directly. Not perfect — the game still has bugs, some of which trace back to skills that captured behavior incorrectly. But the skill-induced error rate is measurably lower than the error rate from agents reading cold source and misinterpreting it.

---

## Token Economy

Token cost is the real constraint in multi-agent workflows. Every wasted read is money and latency. The strategies:

**1. Skills as compressed context**
84 SKILL.md files contain curated interface documentation instead of raw source. An agent loading `skills/building/BuildingSystem/SKILL.md` gets the full interface in ~200 lines instead of scanning 800 lines of implementation.

**2. CodeGraph instead of file reads**
`codegraph_context('understand EventBus')` returns relevant symbols + locations in one tool call. No file reading until you know exactly which 20 lines you need.

**3. Module isolation = smaller context per agent**
Because Agent 7 (Building) only owns `src/building/`, it never loads inventory source, player source, or combat source. Each agent's working context is bounded by its module size, not the full codebase.

**4. Structured permissions eliminate round-trips**
26 pre-approved operations never generate a permission prompt. The approval latency (even 2-3 seconds per confirmation) compounds badly across hundreds of tool calls per agent session.

**5. Typed events as contracts**
Agents don't need to read each other's implementation to know the interface. The `GameEvents` type in `src/types/index.ts` is the complete inter-module API. One file, ~100 lines, gives an agent everything it needs to know about how other modules communicate.

---

## The Network Architecture: Host-Authoritative P2P

No server costs. No backend. Pure PeerJS WebRTC mesh with a Host-authoritative model:

```
Host (Player A)                    Client (Player B)
────────────────────────────────────────────────────
RoomManager.createRoom()           RoomManager.joinRoom(code)
          ↓                                  ↓
  Peer(forager-room-XXXXX)         Peer(client-XXXXXXXX)
          ↓                                  ↓
  NetworkHost.init(peer)           NetworkClient.connect(peer, hostId)

B joins → sends join message
  → A receives → GameState.setPlayer(B) → sendTo(B, state_full)
  → B receives state_full → initializes world and all players

Every frame:
A: applyInput(A) + broadcast(state_delta{ A position })
B: ClientPrediction.predict(input) + NetworkClient.send(input)
  → A receives → applyInput(B) + broadcast(state_delta{ B position })
  → B receives state_delta → ClientPrediction.reconcile(serverState)
```

Host runs all authoritative logic: monster AI, resource depletion, attack resolution, island unlocking, soldier/farm/tower ticks. Clients send inputs, apply local prediction, and reconcile on `state_delta`. Visual effects (grenade flight, particles) run on all clients. Authority-class game logic runs Host-only.

Autoreconnect: signaling lost → `peer:signaling-lost` window event → overlay displayed → 3-second reconnect loop → `peer:signaling-restored` → overlay hidden.

---

## What Was Actually Built in the Hackathon Window

### Game Systems (all functional)

- **Procedural world generation** — seeded RNG, ring-based island layout (rings 0-4), tile types (grass/water/sand/snow/rock), decorated with per-chunk visual noise (ripples, flowers, cracks)
- **Multiplayer P2P networking** — Host/Client authority model, full state sync on join, delta sync every frame, reconnect handling
- **Resource harvesting** — 8 resource types (wood/stone/iron/gold/crystal/bone/feather/berry), tool efficiency modifiers, HP bars, respawn timers
- **Inventory + Crafting** — 55+ items, 50+ recipes, research unlock system, furnace smelting (iron_ore→ingot, gold_ore→ingot)
- **Building system** — 15+ building types (walls, traps, towers, farm, market, barracks, base core), placement validation, ghost preview, HP/damage/repair, upgrade levels 1-5
- **Combat** — Monster AI state machine (idle/wander/chase/attack), elite monsters (HP×3, ATK×2, speed×1.5), boss monsters (every 5 nights, HP×10), wave-based siege system (10-30s intervals, 1-3 groups, 1-5 monsters per group)
- **Dungeon system** — Procedurally generated dungeon layouts (muilty room branch), boss room at longest branch terminus, enemy HP bars, chest interaction, wall collision, portal in/out
- **Rarity + loot tables** — common/uncommon/rare/epic/legendary tiers, market pricing driven by rarity × daily seed
- **Equipment system** — 5 armor types (10-35% damage reduction), G key equip/unequip, EquipUI display
- **Save system** — Dexie.js IndexedDB, autosave every 10s, event-triggered saves (death/build/upgrade/siege end), 3s throttle to prevent write storms
- **Day/night cycle** — canvas overlay with smooth transitions, flashlight cone (25°, 5-tile range), bed to skip night (with penalty: items scatter + fall damage)
- **i18n** — zh-TW + English, 22 translation namespaces, `i18n:changed` event triggers all UI redraws
- **Quest/milestone system** — progress tracking via EventBus listeners, panel UI
- **Market** — daily rotating prices seeded on gameDay, blueprint special deals
- **Treasure chests** — per-island spawning (1-3 per island), rarity-based loot, 2×2 size, item scatter FX on open

### Project Scale by the Numbers

| Metric | Value |
|--------|-------|
| TypeScript source files | 135 |
| Lines in main.ts (integration layer) | 4,349 |
| Total TypeScript lines | ~12,000+ |
| Sub-agents | 17 |
| SKILL.md context snapshots | 84 |
| EventBus event types (typed) | 20+ |
| CodeGraph MCP tools | 10 |
| Pre-approved harness operations | 26 |
| Git commits | 60+ |
| NPM dependencies | 3 (pixi.js, peerjs, dexie) |
| Dev dependencies | 4 (vite, typescript, vitest, peer) |

### Known Limitations: The Bugs Are Real

The harness is good. The game still has bugs. Being explicit about this matters.

**Multiplayer sync gaps** — Several systems only run on the Host side and have no Client-side rendering:
- Soldier units (barracks spawn soldiers the Client cannot see)
- Building damage alpha (a wall that's 30% HP on Host looks full-HP to Client)
- Crafting is not network-validated (Client can craft locally without Host verification)

**Dungeon is single-player only** — The procedural dungeon (遺跡) uses a local scene that isn't synchronized over the network. Two players cannot explore the same dungeon instance.

**EventBus dead listeners** — `resource:collected` has registered listeners in Inventory and QuestSystem, but the event is never emitted — the harvesting path calls `Inventory.add()` directly from `main.ts`. The listeners are documented as dead code in `events.md`.

**Untyped building events** — `building:damaged`, `building:destroyed`, `building:repaired` are emitted with `as any`, bypassing the `GameEvents` type contract. They have no listeners. This is a flagged violation in `events.md` pending architect resolution.

These are documented in the project status doc, the events doc, and the architecture doc. The workflow produced a game fast enough to demo in the hackathon window — shipping speed and bug-free completeness are different goals, and the former was the priority here.

---

## Why This Approach Works (and What Would Have Broken Without It)

### Without module isolation:
Agents would overwrite each other's work. In a multi-agent session where 10+ agents run concurrently, the same file cannot have two writers. Hard directory ownership is the only reliable solution.

### Without the EventBus contract:
Module A would `import { Inventory } from '@/inventory'` and call `Inventory.add()` directly. When Inventory's interface changes (and it does, constantly during development), every caller breaks simultaneously. Typed events decouple the producers from consumers — Inventory changes its internals, emits the same event, nothing else breaks.

### Without the Stop hook:
Type errors accumulate silently. Agent 7 introduces a broken interface, Agent 9 imports it, Agent 10 tries to wire it in main.ts — now you have cascading errors across 3 modules and no clean state to recover from. The hook catches errors at the source, immediately, every time.

### Without CodeGraph:
Every agent that needs to understand a function it doesn't own would have to grep the codebase, read 3-4 files speculatively, parse the imports, understand the call graph manually. Multiply by 17 agents, each doing this dozens of times. The context window cost alone would exhaust the session budget. And the agent may lost in the large path of files and miss the relevant details.

### Without skills:
The main.ts is 4,349 lines. Reconstructing it from scratch — understanding initialization order, the global state variables, the host/client branching, the layer stacking — without a pre-built reference would take an agent the entire session budget just on exploration. The SKILL encodes that knowledge once; every rebuild of main.ts costs a fraction.

---

## The Stack

- **Renderer**: PixiJS v8 (Container/Graphics API, no sprites, pure programmatic rendering)
- **Networking**: PeerJS 1.5 (WebRTC P2P, no signaling server needed for LAN, uses public PeerJS cloud server for signaling)
- **Persistence**: Dexie.js 3.2 (IndexedDB wrapper, offline-capable)
- **Build**: Vite 5.2 + TypeScript 5.4
- **Tests**: Vitest 2.1
- **Agent orchestration**: Codex CLI with Claude Code sub-agents
- **Code intelligence**: CodeGraph MCP (tree-sitter AST → SQLite knowledge graph)
- **CI**: GitHub Actions (tsc + vitest on every push)

---

## Closing

Seventeen agents working in parallel under hard module ownership, a typed event contract enforced by a dedicated architect agent, automated type checking on every agent stop, a pre-approved permission harness to reduce operational friction, 84 compressed context snapshots so agents don't waste tokens on exploratory reads, and a structural code intelligence layer that makes cross-module reasoning fast. (otherwise the compition credit will be burned out evryquickly and not enough for our to build the game 0w0). 
This the way to approach AI-assisted development when the bottleneck is coordination across many parallel workstreams rather than any single feature's complexity.

---

*Built with Codex CLI + Claude Code cli. TypeScript + PixiJS + PeerJS + Dexie.*
