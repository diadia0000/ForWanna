const treasure: Record<string, any> = {
  // ── Chest Interaction ──────────────────────────────────────────
  hint:           'Press [R] to open chest',
  opening:        'Opening chest…',
  opened:         'Chest opened!',
  empty:          'The chest is empty',
  too_far:        'Too far away, get closer to open',
  already_opened: 'This chest has already been opened',

  // ── Reward Notifications ───────────────────────────────────────
  reward:         'Received {item} ×{n}',
  reward_multi:   'Received {count} items!',
  no_reward:      'Nothing this time…',

  // ── Rarity ────────────────────────────────────────────────────
  rarity: {
    common: 'Common',
    rare:   'Rare',
    epic:   'Epic',
  },

  // ── Chest Labels ──────────────────────────────────────────────
  chest: {
    common: 'Common Chest',
    rare:   'Rare Chest',
    epic:   'Epic Chest',
  },
}
export default treasure
