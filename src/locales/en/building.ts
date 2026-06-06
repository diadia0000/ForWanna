// Agent 7 — src/locales/en/building.ts
const building = {
  furnace:        { name: 'Furnace',        effect: 'Automatically smelts ores' },
  farm:           { name: 'Farm',           effect: 'Automatically produces food' },
  market:         { name: 'Market',         effect: 'Sell items for coins' },
  research_lab:   { name: 'Workbench',      effect: 'Press E nearby to open the workbench and unlock more recipes via research' },
  wooden_bridge:  { name: 'Wooden Bridge',  effect: 'Allows crossing water (10 s build time)' },
  wall:           { name: 'Stone Wall',     effect: 'Blocks monsters and fortifies your base' },
  tower:          { name: 'Watchtower',     effect: 'Auto-attacks monsters within 4 tiles' },
  spike_trap:     { name: 'Spike Trap',     effect: 'Deals damage + 50% slow on step (transparent when broken)' },
  fire_trap:      { name: 'Fire Trap',      effect: 'Deals damage + 3 s burn on step (transparent when broken)' },
  ice_trap:       { name: 'Ice Trap',       effect: 'Deals damage + 1.5 s freeze on step (transparent when broken)' },
  base_core:      { name: 'Base Core',      effect: 'Grants HP/ATK bonus and regen to players within 8 tiles; monsters target this first' },
  barracks:       { name: 'Barracks',       effect: 'Spawns a soldier every 30 s to assist in combat' },
  laser_tower:    { name: 'Laser Tower',    effect: 'Auto-attacks monsters within 15 tiles (50+Lv×20 dmg, 2 s cooldown)' },
  cannon_tower:   { name: 'Cannon Tower',   effect: 'Fires cannonballs (20+Lv×8 dmg, 2-tile blast radius, 3.5 s cooldown)' },
  goddess_statue: { name: 'Goddess Statue', effect: 'Press E nearby to pray and summon abundant resources (3 min cooldown)' },
  upgrade: {
    level:   'Level',
    upgrade: 'Upgrade',
    repair:  'Repair',
    cost:    'Cost',
  },
}
export default building
