/**
 * V2.2 V1-visual-rework — the procedural BOSS-TOWER sprite (render-only slice).
 *
 * V2.1 shipped the boss as an off-palette obsidian/crimson villain "fortress".
 * V2.2 re-skins it as a friendly-but-MIGHTY crowned monarch that stays fully
 * inside the SOFT candy palette: it reads "BOSS" through SIZE (the 2x2 bake), a
 * chunky royal BORDER, a gold CROWN with a jewel, and a big confident FACE —
 * never through darkness. L2 (ultimate unlocked) visibly steps up: a brighter
 * crown gem, a bolder face, and extra sparkles (strictly MORE baked styles).
 *
 * Touches exactly the render files (no sim/config/balance):
 *   - v2/render/shapes.js     : the `fortress` shape kept (id stable), reworked to
 *                               a rounded royal keep + 3-point crown silhouette
 *   - v2/render/SpriteCache.js: footprint-aware 2x bake, now SOFT + royal
 *   - v2/render/palette.js    : PALETTE.towers.boss re-skinned (orchid body, gold
 *                               crown, sky gem, deep-orchid border, pale aura)
 *   - v2/render/faces.js      : a new drawBossFace (big confident monarch face)
 *
 * Pure rendering can't be asserted with a real canvas headlessly, so these tests
 * drive the bake through a recording mock 2D context (extents + assigned styles)
 * and assert: (1) the palette is SOFT + royal (no obsidian, no crimson); (2) the
 * fortress is a real multi-edge crown silhouette spanning the full radius; (3) the
 * bake is keyed + footprint-aware 2x; (4) the bake paints SOFT body + warm-gold
 * crown and NO near-black / NO pure-red; (5) the boss has a FACE (white eye
 * highlights) and L2 steps up over L1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { PALETTE } from '../../v2/render/palette.js';
import { shapePath } from '../../v2/render/shapes.js';

// ---- color helper (hex -> HSL lightness/sat) -----------------------------
function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function hexToHsl(hex) {
  const [r0, g0, b0] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0), d = max - min;
  const l = (max + min) / 2;
  let s = 0, h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) { case r0: h = ((g0 - b0) / d) % 6; break; case g0: h = (b0 - r0) / d + 2; break; default: h = (r0 - g0) / d + 4; }
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
const isHex6 = (s) => /^#[0-9a-fA-F]{6}$/.test(s);
// reddish/ember = high red dominance (the OLD villain tell — now must be ABSENT)
function isReddish(hex) {
  if (!isHex6(hex)) return false;
  const [r, g, b] = hexToRgb(hex);
  return r > 170 && r > g + 50 && r > b + 50;
}
// red-DOMINANT in a looser sense (channel that wins is red and it's a warm red)
function isRedDominant(hex) {
  if (!isHex6(hex)) return false;
  const [r, g, b] = hexToRgb(hex);
  return r > g && r > b && r - Math.max(g, b) > 40;
}
const isWarmGold = (hex) => { const { h } = hexToHsl(hex); return h >= 30 && h <= 60; };

// ---- recording mock 2D context -------------------------------------------
class MockCtx {
  constructor() {
    this.minX = Infinity; this.minY = Infinity; this.maxX = -Infinity; this.maxY = -Infinity;
    this.pathOps = 0; this.styles = [];
    this._tx = 0; this._ty = 0;
    this._fill = '#000'; this._stroke = '#000';
  }
  _pt(x, y) {
    const px = x + this._tx, py = y + this._ty;
    this.minX = Math.min(this.minX, px); this.maxX = Math.max(this.maxX, px);
    this.minY = Math.min(this.minY, py); this.maxY = Math.max(this.maxY, py);
    this.pathOps++;
  }
  set fillStyle(v) { if (typeof v === 'string') this.styles.push(v); this._fill = v; }
  get fillStyle() { return this._fill; }
  set strokeStyle(v) { if (typeof v === 'string') this.styles.push(v); this._stroke = v; }
  get strokeStyle() { return this._stroke; }
  beginPath() {}
  closePath() {}
  moveTo(x, y) { this._pt(x, y); }
  lineTo(x, y) { this._pt(x, y); }
  arc(x, y, r) { this._pt(x - r, y - r); this._pt(x + r, y + r); }
  ellipse(x, y, rx, ry) { this._pt(x - rx, y - ry); this._pt(x + rx, y + ry); }
  rect(x, y, w, h) { this._pt(x, y); this._pt(x + w, y + h); }
  fillRect(x, y, w, h) { this._pt(x, y); this._pt(x + w, y + h); }
  arcTo(x1, y1, x2, y2) { this._pt(x1, y1); this._pt(x2, y2); }
  quadraticCurveTo(cx, cy, x, y) { this._pt(x, y); }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this._pt(x, y); }
  fill() {}
  stroke() {}
  clip() {}
  save() {}
  restore() {}
  translate(x, y) { this._tx += x; this._ty += y; }
  rotate() {}
  scale() {}
  setLineDash() {}
  createLinearGradient() { return { addColorStop: (o, c) => { if (typeof c === 'string') this.styles.push(c); } }; }
  createRadialGradient() { return { addColorStop: (o, c) => { if (typeof c === 'string') this.styles.push(c); } }; }
  measureText() { return { width: 80 }; }
  fillText() {}
  strokeText() {}
}

function installCanvasDOM() {
  const made = [];
  globalThis.document = {
    createElement() {
      const ctx = new MockCtx();
      const canvas = { width: 0, height: 0, getContext: () => ctx, _ctx: ctx };
      made.push(canvas);
      return canvas;
    },
  };
  return made;
}

function bossConfig() {
  const c = structuredClone(CONFIG);
  // Synthetic boss def matching gameConfig's real shape/footprint (render-only test).
  c.towers.boss = {
    name: 'Boss', shape: 'fortress', color: PALETTE.towers.boss?.body ?? '#D26FC8',
    kind: 'boss', footprint: 2, fullMap: true,
    projectile: { speed: 600, size: 14, color: PALETTE.towers.boss?.projectile ?? '#F08CD0' },
    levels: [
      { damage: 30, range: 34, fireRateMs: 5000, cost: 250, sizeScale: 0.9 },
      { damage: 45, range: 34, fireRateMs: 4500, cost: 300, sizeScale: 1.0, ultimate: true },
    ],
  };
  return c;
}

async function loadCache() {
  installCanvasDOM();
  const { SpriteCache } = await import('../../v2/render/SpriteCache.js');
  return new SpriteCache(bossConfig());
}

// ==========================================================================
// 1. PALETTE — re-skinned boss color block: SOFT + ROYAL (no obsidian/crimson).
// ==========================================================================
test('palette: PALETTE.towers.boss is SOFT + ROYAL (no obsidian body, no crimson)', () => {
  const b = PALETTE.towers.boss;
  assert.ok(b, 'PALETTE.towers.boss must exist');
  assert.ok(isHex6(b.body), `boss.body is a 6-digit hex (${b.body})`);
  assert.ok(isHex6(b.projectile), `boss.projectile is a 6-digit hex (${b.projectile})`);
  // body lives INSIDE the soft palette (mid-light), NOT obsidian
  const bl = hexToHsl(b.body).l;
  assert.ok(bl >= 0.45 && bl <= 0.85, `boss.body must be a SOFT mid-light tone (lightness ${bl.toFixed(2)} in [0.45,0.85])`);
  // body + projectile are NOT red-dominant (the crimson villain is retired)
  assert.ok(!isRedDominant(b.body), `boss.body must not be red-dominant (${b.body})`);
  assert.ok(!isRedDominant(b.projectile), `boss.projectile must not be red-dominant (${b.projectile})`);
  // a new gold CROWN key — the BOSS-rank tell — is a warm gold
  assert.ok(isHex6(b.crown), `boss.crown is a 6-digit hex (${b.crown})`);
  assert.ok(isWarmGold(b.crown), `boss.crown must be a warm gold (hue 30-60), got ${hexToHsl(b.crown).h.toFixed(0)}`);
  // NO obsidian survives anywhere in the block (every color stays in the soft palette)
  for (const [k, v] of Object.entries(b)) {
    if (!isHex6(v)) continue;
    assert.ok(hexToHsl(v).l >= 0.35, `boss.${k} (${v}) must not be near-black obsidian (lightness ${hexToHsl(v).l.toFixed(2)} >= 0.35)`);
  }
  // existing towers untouched (additive)
  assert.ok(PALETTE.towers.basic && PALETTE.towers.strong, 'basic/strong tower colors still present');
});

// ==========================================================================
// 2. SHAPE — the `fortress` silhouette is a real crown keep (not the fallback).
// ==========================================================================
test('shapes: `fortress` is a multi-edge crown keep spanning the full radius', () => {
  const cx = 100, cy = 100, r = 50;
  const ctx = new MockCtx();
  shapePath(ctx, 'fortress', cx, cy, r);
  // a circle fallback would be a single arc (2 path points); the keep is many edges
  assert.ok(ctx.pathOps >= 12, `fortress must be a multi-edge polygon, got ${ctx.pathOps} path ops`);
  // spans the full diameter horizontally (a 2x2 footprint silhouette)
  assert.ok((ctx.maxX - ctx.minX) >= 1.8 * r, `fortress width ${(ctx.maxX - ctx.minX).toFixed(1)} must span ~2r`);
  // a central crown SPIRE reaches the top of the radius (regal, not jagged spikes)
  assert.ok(ctx.minY <= cy - r * 0.95, `fortress spire must reach the top of the radius (minY ${ctx.minY.toFixed(1)})`);
  // and a solid base at the bottom of the radius
  assert.ok(ctx.maxY >= cy + r * 0.95, `fortress base must reach the bottom of the radius (maxY ${ctx.maxY.toFixed(1)})`);
});

// ==========================================================================
// 3. BAKE — footprint-aware 2x boss sprite, keyed.
// ==========================================================================
test('SpriteCache: boss bake is keyed `tower:boss:...` and exists in the cache', async () => {
  const cache = await loadCache();
  const entry = cache.tower('boss', 2);
  assert.ok(entry && entry.canvas, 'tower("boss",2) returns a baked entry');
  assert.ok(cache.cache.has('tower:boss:2:-:neutral'), 'boss sprite is keyed tower:boss:2:-:neutral');
});

test('SpriteCache: boss sprite is footprint-aware (a 2x bake, larger than a 1-tile tower)', async () => {
  const cache = await loadCache();
  const boss = cache.tower('boss', 2);
  const basic = cache.tower('basic', 3); // even a maxed 1-tile tower
  assert.ok(boss.canvas.width > basic.canvas.width * 1.4,
    `boss canvas ${boss.canvas.width} must be a 2x bake vs basic ${basic.canvas.width}`);
  const tile = cache.tile;
  const ctx = boss.canvas._ctx;
  assert.ok((ctx.maxX - ctx.minX) >= 1.7 * tile,
    `boss body should span ~2 tiles (drawn width ${(ctx.maxX - ctx.minX).toFixed(1)} vs tile ${tile})`);
});

// ==========================================================================
// 4. BAKE reads SOFT & ROYAL (no near-black, no pure-red).
// ==========================================================================
test('SpriteCache: the boss bake reads SOFT & ROYAL (soft body + gold crown, no black/red)', async () => {
  const cache = await loadCache();
  const styles = cache.tower('boss', 2).canvas._ctx.styles;
  // a warm-gold CROWN tone was painted (the dominant boss-rank signal)
  assert.ok(styles.some(s => isHex6(s) && isWarmGold(s)), 'boss bake paints a warm-gold crown tone (hue 30-60)');
  // a SOFT body tone (mid-light) was painted
  assert.ok(styles.some(s => isHex6(s) && hexToHsl(s).l >= 0.45 && hexToHsl(s).l <= 0.9), 'boss bake paints a soft mid-light body tone');
  // NO near-black obsidian tone is painted
  assert.ok(!styles.some(s => isHex6(s) && hexToHsl(s).l < 0.30), 'boss bake paints NO near-black tone');
  // NO pure-red / ember crimson tone is painted (the villain is retired)
  assert.ok(!styles.some(isReddish), 'boss bake paints NO crimson/ember tone');
});

// ==========================================================================
// 5. FACE present + L2 step-up (the visible upgrade).
// ==========================================================================
test('SpriteCache: the boss bake has a FACE and L2 visibly steps up over L1', async () => {
  const cache = await loadCache();
  const l1 = cache.tower('boss', 1).canvas._ctx;
  const l2 = cache.tower('boss', 2).canvas._ctx;
  // a FACE: white eye highlights are painted
  const hasWhiteEyes = (s) => s.styles.some(v => /^#fff(fff)?$/i.test(v));
  assert.ok(hasWhiteEyes(l2), 'boss bake paints white eye highlights (a FACE)');
  assert.ok(hasWhiteEyes(l1), 'L1 boss also has a face');
  // L2 paints strictly MORE styles than L1 (bigger crown gem + bolder face + sparkles)
  assert.ok(l2.styles.length > l1.styles.length,
    `L2 must paint strictly more styles than L1 (L2 ${l2.styles.length} > L1 ${l1.styles.length})`);
});
