import type { TileType } from '@/types'

export type SpawnRingRange = number | { min: number; max?: number }
export type SpawnRingRule = 'all' | SpawnRingRange | SpawnRingRange[]

export interface ResourceSpawnRule {
  id: string
  rings: SpawnRingRule
  tiles: TileType[]
  weight: number
}

export const FOOD_RESOURCE_IDS = [
  'berry',
  'tomato',
  'purple_grape',
  'onion',
  'carrot',
  'pumpkin',
  'watermelon',
] as const

export const RESOURCE_SPAWN_RULES: ResourceSpawnRule[] = [
  { id: 'tree', rings: 'all', tiles: ['grass'], weight: 40 },
  { id: 'rock', rings: 'all', tiles: ['grass', 'stone', 'sand', 'snow'], weight: 22 },
  { id: 'iron', rings: { min: 1 }, tiles: ['stone', 'snow'], weight: 35 },
  { id: 'gold', rings: 'all', tiles: ['grass', 'stone', 'sand', 'snow'], weight: 12 },
  { id: 'crystal', rings: { min: 1 }, tiles: ['stone', 'sand', 'snow'], weight: 10 },
  { id: 'fire_node', rings: { min: 1 }, tiles: ['sand'], weight: 16 },
  { id: 'ice_node', rings: { min: 1 }, tiles: ['snow'], weight: 11 },

  { id: 'berry', rings: 'all', tiles: ['grass'], weight: 2 },
  { id: 'tomato', rings: 'all', tiles: ['grass'], weight: 2 },
  { id: 'purple_grape', rings: 'all', tiles: ['grass'], weight: 2 },
  { id: 'onion', rings: 'all', tiles: ['grass'], weight: 2 },
  { id: 'carrot', rings: 'all', tiles: ['grass'], weight: 2 },
  { id: 'pumpkin', rings: 'all', tiles: ['grass'], weight: 2 },
  { id: 'watermelon', rings: 'all', tiles: ['grass'], weight: 2 },
]

export function canSpawnInRing(rule: SpawnRingRule, ring: number): boolean {
  if (rule === 'all') return true
  if (Array.isArray(rule)) return rule.some(part => canSpawnInRing(part, ring))
  if (typeof rule === 'number') return ring === rule
  if (ring < rule.min) return false
  return rule.max === undefined || ring <= rule.max
}

export function canSpawnResourceOn(type: string, ring: number, tile: TileType): boolean {
  const rule = RESOURCE_SPAWN_RULES.find(r => r.id === type)
  return !!rule && canSpawnInRing(rule.rings, ring) && rule.tiles.includes(tile)
}

export function getSpawnableResourceRules(ring: number, tile: TileType): ResourceSpawnRule[] {
  return RESOURCE_SPAWN_RULES.filter(rule =>
    canSpawnInRing(rule.rings, ring) && rule.tiles.includes(tile) && rule.weight > 0
  )
}

export function pickFoodResource(rng: () => number = Math.random): string {
  return FOOD_RESOURCE_IDS[Math.floor(rng() * FOOD_RESOURCE_IDS.length)] ?? 'berry'
}

export function pickResourceForSpawn(
  ring: number,
  tile: TileType,
  rng: () => number = Math.random,
): string | null {
  const rules = getSpawnableResourceRules(ring, tile)
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0)
  if (total <= 0) return null

  let roll = rng() * total
  for (const rule of rules) {
    roll -= rule.weight
    if (roll <= 0) return rule.id
  }
  return rules[rules.length - 1]?.id ?? null
}
