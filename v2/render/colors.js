/**
 * Pure color helpers (no DOM) so they can be unit-tested headless.
 *
 * withAlpha is the fix for the addColorStop crash: appending an alpha pair to a
 * color that ALREADY had an alpha pair produced a 10-digit string
 * ('#FF888888' + '66' -> '#FF88888866'), which CanvasGradient rejects. withAlpha
 * normalises to a 6-digit base first, so the result is always '#RRGGBBAA'.
 */
import { PALETTE } from './palette.js';

export function withAlpha(hex, alpha2) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length >= 6) h = h.slice(0, 6);          // drop any existing alpha
  return '#' + h + alpha2;
}

// Coin palette by lifecycle state — all 6-digit so withAlpha stays valid.
export function coinColors(phase) {
  return PALETTE.coin[phase] ?? PALETTE.coin.normal;
}

// Lerp two #RRGGBB hexes -> an rgb() string. Used only inside short flash windows
// (e.g. the lives-lost colour pulse), never on an always-on path.
export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const L = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${L(r1, r2)},${L(g1, g2)},${L(b1, b2)})`;
}

export default { withAlpha, coinColors, mix };
