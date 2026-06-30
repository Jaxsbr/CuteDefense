/**
 * Composable enemy-flag helpers (P2) — pure, shared by the sim (spawn/compose)
 * and the renderer (SpriteCache flagmask key). No render or DOM dependency, so
 * headless tests can import this directly.
 */

// Stable integer bitmask for a set of flags, using cfg.enemyFlags.order as the
// canonical bit order. Author order is irrelevant: the same flags always yield
// the same mask, so the SpriteCache key `enemy:type:frame:mask` is deterministic.
export function flagMask(cfg, flags) {
  const order = cfg.enemyFlags.order;
  let m = 0;
  for (const f of flags || []) {
    const i = order.indexOf(f);
    if (i >= 0) m |= (1 << i);
  }
  return m;
}

// Clamp authored flags to the legibility cap (cap.max), preserving the stable
// enemyFlags.order so the kept subset is deterministic regardless of author order.
export function clampFlags(cfg, flags) {
  const order = cfg.enemyFlags.order;
  const set = new Set(flags || []);
  const ordered = order.filter(f => set.has(f));
  return ordered.slice(0, cfg.enemyFlags.cap.max);
}

// Compose an enemy's full trait list from its base-type traits + flag traits
// (deduped). Drives affinity. Returned order: base traits, then flag traits.
export function composeTraits(cfg, baseTraits, flags) {
  const out = [...(baseTraits || [])];
  for (const f of flags || []) {
    const def = cfg.enemyFlags.defs[f];
    if (def?.trait && !out.includes(def.trait)) out.push(def.trait);
  }
  return out;
}

export default { flagMask, clampFlags, composeTraits };
