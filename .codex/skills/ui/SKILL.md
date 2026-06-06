---
name: ui
description: UI/HUD 模組總綱：大廳、HUD、Hotbar、各面板（背包/製作/熔爐/市場/研究/基地核心/兵營/裝備）。重建任何 DOM/HUD UI 先看這份，再按需展開 reference 子檔。
---

# ui 模組總綱

本檔是 `src/ui/` 的重建索引。各 reference 子檔是對應檔案的完整重建規格（公開 API、核心邏輯、EventBus 互動、依賴、重建提示）——只在需要時展開，避免一次載入吃掉 context。

## 子檔導航（重建時按需展開）

- [`ui/index`](./index/reference.md) — Rebuild the ui barrel export — exact re-export list of all UI classes, helpers, and types.
- [`ui/BagUI`](./BagUI/reference.md) — Rebuild the bag panel (small/large) — capacity calc, put-in/take-out lists, amount prompt.
- [`ui/BarracksUI`](./BarracksUI/reference.md) — Rebuild the barracks management panel — soldier stat formula per level, upgrade cost & preview.
- [`ui/BaseCoreUI`](./BaseCoreUI/reference.md) — Rebuild the base-core upgrade panel — buff formula (hp/atk/regen per level), next-level cost preview.
- [`ui/BuildingUI`](./BuildingUI/reference.md) — Rebuild the scrollable building placement menu — cost affordability, icon map, start-placement callback.
- [`ui/CraftingUI`](./CraftingUI/reference.md) — Rebuild the two-column crafting UI — recipe list + detail with qty controls, weapon stats, lock/affordability.
- [`ui/EquipUI`](./EquipUI/reference.md) — Rebuild the small fixed equipment widget (armor slot) — inline-styled panel, update/clear armor, unequip.
- [`ui/FurnaceUI`](./FurnaceUI/reference.md) — Rebuild the furnace smelting UI — iron/gold/gold-coin recipes, ratio math, qty controls, two-column layout.
- [`ui/HUD`](./HUD/reference.md) — Rebuild the top HUD (hearts/hunger/XP/gold/room code) and the TAB-hold side-dock keybind help panel.
- [`ui/HotbarUI`](./HotbarUI/reference.md) — Rebuild the 9-slot hotbar — active slot selection, scroll-wheel cycling, bag right-click/drag-drop integration.
- [`ui/InventoryUI`](./InventoryUI/reference.md) — Rebuild the 18-slot inventory grid with mouse drag-to-reorder, floating ghost, and bag-drop hand-off.
- [`ui/LobbyScreen`](./LobbyScreen/reference.md) — Rebuild the lobby/start screen — character create, host/join room flow, map (save) list with rename/delete.
- [`ui/MarketPricing`](./MarketPricing/reference.md) — Rebuild the market dynamic pricing algorithm — seeded daily RNG, rarity multiplier, daily blueprint rotation.
- [`ui/MarketUI`](./MarketUI/reference.md) — Rebuild the sell-only market UI — item list with rarity, sell qty/price detail, daily blueprint buy.
- [`ui/ResearchUI`](./ResearchUI/reference.md) — Rebuild the research-lab upgrade UI — two-column list/detail, in-progress timer bar, level rollover.
- [`ui/SelectorGfx`](./SelectorGfx/reference.md) — Rebuild the PixiJS placement/target selector graphic — normal vs invalid state circles, top z-index.
