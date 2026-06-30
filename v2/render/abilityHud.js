/**
 * W4 — reusable HUD ABILITY slot/state idiom (the pure, canvas-free seam).
 *
 * Pure rendering (the actual canvas drawing in Renderer._freezeAbility) cannot be
 * asserted headlessly, so the two decisions the renderer makes are extracted here:
 *
 *   freezeSlotRect(layout, cfg) -> HUD-space rect, parked in the left dock gutter
 *     between the selection card and the build tray. Right edge stays <= gridOffsetX,
 *     so the control is structurally impossible to mis-tap onto a placeable tile.
 *
 *   freezeUiState(state, cfg) -> one of 'ready' | 'active' | 'cooldown' | 'locked'.
 *     ACTIVELY-FREEZING wins regardless of status (the ability is visibly doing its
 *     thing). Otherwise: not playing => locked; playing => ready/cooldown by readyAt.
 *
 *   freezeCastable(state) -> true only in 'ready' — pins the drawn affordance (the
 *     'freeze' hit-rect) to castFreeze's legality (Simulation.castFreeze).
 *
 * W8 slots a SECOND ability (the boss ultimate) into this same idiom.
 */

// HUD-space rect for the freeze ability slot. Geometry lives in cfg.visual.ability.
export function freezeSlotRect(layout, cfg) {
  const a = cfg.visual.ability, pad = a.pad;
  const w = layout.hudWidth - pad * 2;
  const h = a.slotH;
  const y = layout.canvasH - a.bottomOffset - h;
  return { x: pad, y, w, h };
}

// Four-state machine. `cfg` is unused today (kept for parity with the slot API and
// so a future ability can key thresholds off config without a signature change).
export function freezeUiState(state, cfg) {
  if (state.clock < state.freeze.activeUntil) return 'active';
  if (state.status !== 'playing') return 'locked';
  return state.clock >= state.freeze.readyAt ? 'ready' : 'cooldown';
}

export const freezeCastable = (s) => freezeUiState(s, null) === 'ready';

// ---- W8: the SECOND ability (the boss-tower ULTIMATE), same slot idiom ----

// True once a boss tower exists at all (the slot is only DRAWN then). Reads the
// cloned config off state so the renderer needs no extra wiring.
export function hasBossTower(state) {
  const cfg = state.config;
  return state.towers.some(t => cfg.towers[t.typeId]?.kind === 'boss');
}

// HUD-space rect for the ultimate slot — stacked directly ABOVE the freeze slot in
// the same left dock gutter (off the play grid), with room for its own eyebrow.
// Geometry is derived from the shared cfg.visual.ability block (no magic numbers).
export function ultimateSlotRect(layout, cfg) {
  const fr = freezeSlotRect(layout, cfg);
  const a = cfg.visual.ability;
  return { x: fr.x, y: fr.y - a.slotH - a.labelGap - a.pad, w: fr.w, h: a.slotH };
}

// Four-state machine mirroring freezeUiState, but per-tower (any boss tower whose
// ultimate is unlocked and off cooldown => ready). ACTIVE wins while a cast FX is
// playing. No unlocked boss / not playing => locked.
export function ultimateUiState(state) {
  const cfg = state.config;
  const bosses = state.towers.filter(t => cfg.towers[t.typeId]?.kind === 'boss');
  if (bosses.some(t => state.clock < (t.ultActiveUntil || 0))) return 'active';
  const unlocked = bosses.filter(t => cfg.towers[t.typeId].levels[t.level - 1]?.ultimate);
  if (unlocked.length === 0) return 'locked';
  if (state.status !== 'playing') return 'locked';
  const minReady = Math.min(...unlocked.map(t => t.ultReadyAt || 0));
  return state.clock >= minReady ? 'ready' : 'cooldown';
}

export const ultimateCastable = (s) => ultimateUiState(s) === 'ready';
