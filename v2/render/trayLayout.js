/**
 * V2.2 V5-bugs — pure layout geometry for the two boss-cost surfaces.
 *
 * Both the build/ability tray cell and the placement-popup buy button draw a coin
 * cost beside a tower icon. The boss is the first 3-digit cost (250), which the
 * old fixed-offset math drew ON TOP of the tray icon (read as "50") and crowded
 * against the buy-button edge. These helpers compute the same geometry the renderer
 * draws, with NO canvas, so a test can import them and assert no overlap. The
 * renderer routes through the identical helpers (one source of truth for the math).
 * All constants live in cfg.visual.tray / cfg.visual.buyButton (no magic numbers).
 */

// Build-tray cost cell geometry (positions RELATIVE to the cell's left edge x).
//  n  = number of tower types in the tray
//  spW, spH = the tower sprite canvas dims (for the proportional icon scale)
export function trayCostLayout(cfg, n, spW, spH) {
  const W = cfg.layout.hudWidth, pad = 24, gap = 16;
  const th = 64;
  const bw = (W - pad * 2 - gap * (n - 1)) / n;
  const T = cfg.visual.tray;
  const thumb = T.iconThumb;
  const psc = thumb / Math.max(spW, spH);
  const iconRight = 12 + spW * psc;            // icon drawn at x+12
  const costRight = bw - T.costInset;          // cost text right inset within the cell
  const budget = costRight - (iconRight + T.iconGap);
  return { bw, th, thumb, psc, iconRight, costRight, budget,
           baseFontPx: T.costBaseFontPx, minFontPx: T.costMinFontPx };
}

// Placement-popup buy-button coin+cost geometry (positions RELATIVE to button x).
// Measured, right-anchored group: the cost sits at the right inset, the coin to its
// left across the configured gap — so any digit count clears the edge cleanly.
//  w  = button width
//  cw = measured cost-text width at the cost font size
export function buyCostLayout(cfg, w, cw) {
  const BB = cfg.visual.buyButton;
  const coinR = BB.coinR;
  const costRight = w - BB.costInset;
  const coinX = costRight - cw - BB.coinGap - coinR;
  const costLeft = costRight - cw;
  return { coinX, coinR, costLeft, costRight, align: 'right' };
}
