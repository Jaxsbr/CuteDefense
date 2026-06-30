/**
 * W6 — the SINGLE pure numeric formatter for every displayed stat.
 *
 * The Sniper fork computes range 3 * 1.6 = 4.800000000000001; printed raw it
 * spilled the tower card. fmtStat rounds to `decimals` and lets String(Number)
 * drop trailing zeros for free, so 4.800000000000001 -> "4.8", 138 -> "138",
 * 2.5 -> "2.5" (never "2.50"). Total: non-numbers/non-finite pass through as
 * String so a bad value is visible, not a crash. Pure (no canvas) -> unit-tested.
 */
export function fmtStat(n, decimals = 2) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f);
}

/**
 * W6 / V2.2 V5-bugs — the SINGLE auto-fit primitive. Shrinks a font from basePx
 * down to (never below) minPx until widthAt(px) <= maxW, returning the chosen px.
 * Pure: callers pass a measure closure — the renderer measures on the canvas ctx,
 * tests pass a synthetic avg-glyph model. _statLine, the tray cost, and the
 * buy-button cost all route through this (one loop, no forks). If even minPx
 * overflows, minPx is returned (clamped — text right-aligns inside the budget,
 * still no icon overlap, just smaller).
 */
export function fitFontPx(widthAt, basePx, minPx, maxW) {
  let px = basePx;
  while (px > minPx && widthAt(px) > maxW) px -= 1;
  return px;
}
