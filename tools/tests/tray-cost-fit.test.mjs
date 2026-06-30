/**
 * V2.2 V5-bugs — the boss cost (250, the first 3-digit cost) must never collide
 * with its icon in the build tray, nor crowd past the placement buy-button edge.
 *
 * Mirrors card-overflow.test.mjs: re-models the renderer's tray / buy-button
 * geometry from CONFIG via the SAME pure helpers the renderer draws through
 * (trayCostLayout / buyCostLayout), with an avg-glyph stub measure, and the real
 * fitFontPx + fmtStat. Fails on the pre-fix fixed-offset math (cost left edge
 * lands behind the icon / past the button edge), passes once the helpers budget
 * + auto-fit + measure the cost group.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { towerTypeIds } from '../../v2/sim/systems/towerSystem.js';
import { fmtStat, fitFontPx } from '../../v2/render/format.js';
import { trayCostLayout, buyCostLayout } from '../../v2/render/trayLayout.js';

// avg glyph fraction of the font px for the bold body cost font ("250c" @22px ~ 48px)
const AVG_GLYPH = 0.55;
const widthAt = (s, px) => s.length * px * AVG_GLYPH;

// --- fitFontPx unit contract (the single auto-fit primitive) ---
test('fitFontPx shrinks to fit, clamps at minPx, and never over-shrinks', () => {
  // identity width, maxW below the floor -> clamps at minPx (never below)
  assert.equal(fitFontPx((p) => p, 22, 14, 10), 14);
  // identity width, floor low enough -> shrinks to first px whose width <= maxW
  assert.equal(fitFontPx((p) => p, 22, 8, 10), 10);
  // already fits -> no shrink
  assert.equal(fitFontPx(() => 5, 22, 14, 100), 22);
});

// --- cost routes through the W6 formatter (integer costs, 0 dp) ---
test('boss cost formats through fmtStat (no decimals)', () => {
  assert.equal(fmtStat(250, 0), '250');
  assert.equal(fmtStat(55, 0), '55');
});

// Square sprite => icon occupies the full thumb width (the tightest tray case;
// taller-than-wide sprites only shrink the icon, easing the budget).
const SQ = 68;

test('boss tray cost clears its icon and stays kid-legible', () => {
  const ids = towerTypeIds(CONFIG);
  assert.ok(ids.includes('boss'), 'boss is a tray type');
  const bossCost = CONFIG.towers.boss.levels[0].cost;
  assert.ok(bossCost >= 100 && bossCost <= 9999, 'boss is the widest (3-4 digit) tray cost label');

  const n = ids.length; // 3 today (basic, strong, boss) -> narrowest cells
  const L = trayCostLayout(CONFIG, n, SQ, SQ);
  const costTxt = `${fmtStat(bossCost, 0)}c`;
  const px = fitFontPx((p) => widthAt(costTxt, p), L.baseFontPx, L.minFontPx, L.budget);
  const costLeftEdge = L.costRight - widthAt(costTxt, px);

  assert.ok(costLeftEdge >= L.iconRight,
    `tray cost left edge ${costLeftEdge.toFixed(1)} overlaps icon right ${L.iconRight.toFixed(1)}`);
  assert.ok(px >= CONFIG.visual.tray.costMinFontPx,
    `tray cost shrank to ${px}px below the legibility floor ${CONFIG.visual.tray.costMinFontPx}`);
});

test('2-digit tray costs stay at full size (no needless shrink)', () => {
  const n = towerTypeIds(CONFIG).length;
  const L = trayCostLayout(CONFIG, n, SQ, SQ);
  const costTxt = '55c';
  const px = fitFontPx((p) => widthAt(costTxt, p), L.baseFontPx, L.minFontPx, L.budget);
  assert.equal(px, L.baseFontPx, '2-digit cost should not shrink');
});

test('placement buy-button coin+cost group clears the edge and the thumbnail', () => {
  const w = 248;        // CW in Renderer._towerPopup
  const h = 76;         // BH
  const BB = CONFIG.visual.buyButton;
  const costTxt = fmtStat(250, 0);
  const cw = widthAt(costTxt, BB.costFontPx);
  const L = buyCostLayout(CONFIG, w, cw);

  // cost respects the right inset (the "slight overlap" bug: 250 sat ~12px from the
  // 248px edge, inside the 16px inset)
  assert.ok(L.costRight <= w - BB.costInset,
    `buy cost right ${L.costRight.toFixed(1)} crowds past inset (edge ${w}, inset ${BB.costInset})`);
  // coin sits left of the cost with the configured gap
  const coinRight = L.coinX + L.coinR;
  const costLeft = L.costRight - cw;
  assert.ok(coinRight + BB.coinGap <= costLeft + 0.001,
    `coin right ${coinRight.toFixed(1)} + gap collides with cost left ${costLeft.toFixed(1)}`);
  // coin clears the left tower thumbnail (thumb = h-18 at x+14)
  const thumbRight = 14 + (h - 18);
  assert.ok(L.coinX - L.coinR >= thumbRight,
    `coin left ${(L.coinX - L.coinR).toFixed(1)} overlaps thumbnail right ${thumbRight}`);
});

test('a hypothetical 4-digit buy cost still clears the edge', () => {
  const w = 248, BB = CONFIG.visual.buyButton;
  const costTxt = fmtStat(1250, 0);
  const cw = widthAt(costTxt, BB.costFontPx);
  const L = buyCostLayout(CONFIG, w, cw);
  assert.ok(L.costRight <= w - BB.costInset, '4-digit cost overflows the button edge');
});
