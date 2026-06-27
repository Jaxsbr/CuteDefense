/**
 * Pure color helpers (no DOM) so they can be unit-tested headless.
 *
 * withAlpha is the fix for the addColorStop crash: appending an alpha pair to a
 * color that ALREADY had an alpha pair produced a 10-digit string
 * ('#FF888888' + '66' -> '#FF88888866'), which CanvasGradient rejects. withAlpha
 * normalises to a 6-digit base first, so the result is always '#RRGGBBAA'.
 */
export function withAlpha(hex, alpha2) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length >= 6) h = h.slice(0, 6);          // drop any existing alpha
  return '#' + h + alpha2;
}

// Coin palette by lifecycle state — all 6-digit so withAlpha stays valid.
export function coinColors(phase) {
  switch (phase) {
    case 'warning': return { body: '#FF8C42', border: '#E2571E', glow: '#FFB066' };
    case 'expired': return { body: '#777777', border: '#FF5555', glow: '#FF8888' };
    default:        return { body: '#FFD700', border: '#FFA500', glow: '#FFE680' };
  }
}

export default { withAlpha, coinColors };
