// Agent 6 負責 — src/inventory/CraftingSystem.ts
import type { PlayerId, RecipeId } from '@/types'
import { EventBus } from '@/core/EventBus'
import { Inventory } from './Inventory'
import { RECIPES } from './data/recipes'
import { GameStateManager_ } from '@/core/GameState'

export class CraftingSystem {
  canCraft(playerId: PlayerId, recipeId: RecipeId): boolean {
    const recipe = RECIPES[recipeId]
    if (!recipe) return false
    const researchLevel = GameStateManager_.getPlayer(playerId)?.researchLevel ?? 1
    if (researchLevel < recipe.unlockLevel) return false
    return recipe.requires.every(req =>
      Inventory.getAmount(playerId, req.itemId) >= req.amount
    )
  }

  craft(playerId: PlayerId, recipeId: RecipeId): boolean {
    if (!this.canCraft(playerId, recipeId)) return false
    const recipe = RECIPES[recipeId]

    // 扣除材料
    recipe.requires.forEach(req => Inventory.remove(playerId, req.itemId, req.amount))

    // 給予成品
    recipe.produces.forEach(prod => Inventory.add(playerId, prod.itemId, prod.amount))

    EventBus.emit('craft:success', {
      playerId,
      recipeId,
      result: recipe.produces,
    })
    return true
  }

  getAvailableRecipes(playerId: PlayerId): string[] {
    return Object.keys(RECIPES).filter(id => this.canCraft(playerId, id))
  }

  getAllRecipes() {
    return RECIPES
  }
}
