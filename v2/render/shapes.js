/**
 * Shape paths + color utilities. All color math runs at sprite-BAKE time (once),
 * never per frame — that's a core reason V2 beats V1 (which rebuilt ~260 color
 * strings and 50+ gradients every frame).
 */
export function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clampByte(v).toString(16).padStart(2, '0')).join('');
}
export function lighten(hex, amt) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + amt, g + amt, b + amt); }
export function darken(hex, amt) { return lighten(hex, -amt); }

// Build a centered shape path of "radius" r into ctx (does not fill/stroke).
export function shapePath(ctx, shape, cx, cy, r) {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case 'square': {
      const h = r * 0.85;
      ctx.rect(cx - h, cy - h, h * 2, h * 2);
      break;
    }
    case 'diamond':
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
      break;
    case 'hexagon': polygon(ctx, cx, cy, r, 6, -Math.PI / 2); break;
    case 'octagon': polygon(ctx, cx, cy, r, 8, -Math.PI / 8); break;
    case 'star': star(ctx, cx, cy, r, r * 0.45, 5, -Math.PI / 2); break;
    case 'fortress': fortress(ctx, cx, cy, r); break;
    default: ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

// A regal royal-keep silhouette for the 2x2 boss tower (V2.2 rework): a wide
// rounded keep body topped by a 3-POINT CROWN — a central spire reaching the top
// of the radius, flanked by two shorter crown points with soft dips between. No
// jagged spikes, no full-height side towers: softer + monarch-like, not menacing.
// Spans the full radius (a 2-tile footprint). The shape id stays `fortress` so the
// config + shape API are untouched (keeps this fork pure-render). Pure path; no
// fills here. The gold crown band + gem are painted on top at bake time.
function fortress(ctx, cx, cy, r) {
  const X = (dx) => cx + dx * r, Y = (dy) => cy + dy * r;
  const rad = 0.18;                       // softened bottom-corner radius

  ctx.moveTo(X(-0.95), Y(1.0 - rad));     // start above the rounded bottom-left
  ctx.lineTo(X(-0.95), Y(-0.30));         // up the left wall to the crown base
  ctx.lineTo(X(-0.70), Y(-0.30));         // small shoulder ledge in
  ctx.lineTo(X(-0.55), Y(-0.74));         // LEFT crown point
  ctx.lineTo(X(-0.30), Y(-0.40));         // dip
  ctx.lineTo(X(0.0),  Y(-1.0));           // CENTRAL crown SPIRE (top of the radius)
  ctx.lineTo(X(0.30), Y(-0.40));          // dip
  ctx.lineTo(X(0.55), Y(-0.74));          // RIGHT crown point
  ctx.lineTo(X(0.70), Y(-0.30));          // small shoulder ledge in
  ctx.lineTo(X(0.95), Y(-0.30));          // right wall top
  ctx.lineTo(X(0.95), Y(1.0 - rad));      // down the right wall
  ctx.arcTo(X(0.95), Y(1.0), X(0.95 - rad), Y(1.0), rad * r);   // round bottom-right
  ctx.lineTo(X(-0.95 + rad), Y(1.0));     // across the base
  ctx.arcTo(X(-0.95), Y(1.0), X(-0.95), Y(1.0 - rad), rad * r); // round bottom-left
  ctx.closePath();
}

function polygon(ctx, cx, cy, r, sides, rot) {
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function star(ctx, cx, cy, rOuter, rInner, points, rot) {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// A small offscreen canvas factory that works in browser + headless Chrome.
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
