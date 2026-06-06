# CodeGraph Usage Rules for Code Writing

## When Writing Code: Always Use CodeGraph First

Before modifying or creating code, run ONE of these queries (depending on your task):

| Task Type | CodeGraph Call |
|-----------|---|
| "Find where symbol X is defined" | `codegraph_search('X')` |
| "Understand how module X works" | `codegraph_context('understand X module')` |
| "What calls function Y?" | `codegraph_callers('Y')` |
| "How does X reach Y?" (trace flow) | `codegraph_trace(from='X', to='Y')` |
| "What would break if I change Z?" | `codegraph_impact('Z')` |
| "Show me Z's source + signature" | `codegraph_node('Z', includeCode=true)` |

## Why CodeGraph, Not Grep?

- **Grep**: Text search (slow, finds duplicates, misses imports)
- **CodeGraph**: Structural analysis (instant, returns symbol kind + location + type + callers)

## One-Call Rule

- Start with ONE codegraph call to gather context
- Don't run multiple search queries in sequence
- Don't grep first then use codegraph
- Don't Read files before understanding dependencies via CodeGraph

## After CodeGraph: Verify & Edit

1. Run the codegraph query
2. Read only the files CodeGraph returned
3. Edit with confidence (CodeGraph already found the ripple effects)

## EventBus Modular Principle

When modifying cross-module code:

```typescript
// Don't: direct imports between modules
import { BuildingSystem } from '@/building'
BuildingSystem.place(...)

// Do: emit events via EventBus
import { EventBus } from '@/core/EventBus'
EventBus.emit('build:placed', { playerId, buildingId, x, y })
```

Run `codegraph_search('EventBus.emit')` to see all event names in use before defining new ones.

---

**TL;DR**: Every code write starts with CodeGraph. One call. Then Read. Then Edit.
