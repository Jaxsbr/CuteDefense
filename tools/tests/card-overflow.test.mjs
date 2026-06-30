/**
 * W6 — render-capture: no tower-card stat line may overflow the card.
 *
 * Drives a real Simulation to a forked-Sniper L3 tower, pulls the pure
 * towerCardLines() composition the renderer consumes, and measures each line
 * with a stub measureText (avg-glyph) against the card's text budget. Fails on
 * the raw-float build (the ~50-char "Range 4.800000000000001" line), passes once
 * fmtStat() rounds it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { Simulation } from '../../v2/sim/Simulation.js';
import { towerCardLines } from '../../v2/sim/systems/towerSystem.js';
import { fmtStat } from '../../v2/render/format.js';

const SHORT_MAP = {
  name: 'TestLine',
  grid: [
    '......................', '......................', '......................',
    '......................', '......................', '......................',
    'S####################E', '......................', '......................',
    '......................', '......................', '......................',
  ],
};
function cfg() {
  const c = structuredClone(CONFIG);
  c.maps = [SHORT_MAP];
  c.economy.startingCoins = 1e9;
  return c;
}
function placeAt(sim, gx, gy, type, level = 1) {
  sim.state.placement = { gx, gy, towerType: type };
  assert.ok(sim.placementPlace(), 'tower placed');
  const t = sim.towerAt(gx, gy);
  sim.state.selected = { kind: 'tower', id: t.id };
  for (let l = 1; l < level; l++) assert.ok(sim.upgradeSelected(), `upgraded to L${l + 1}`);
  return t;
}

// Card geometry (Renderer.js): hudWidth 400, pad 24 => card 352 wide; stat text
// starts at x+110 with a 16px right inset. Budget = 352 - 110 - 16.
const CARD_W = CONFIG.layout.hudWidth - 24 * 2;
const TEXT_BUDGET = CARD_W - 110 - 16;
const AVG_GLYPH = 0.47; // avg glyph fraction of the font px for the stat font

function widthAt(s, px) { return s.length * px * AVG_GLYPH; }
// Model Renderer._statLine: shrink the font from base down to statMinFontPx until
// the line fits, then report the rendered width. This captures what the renderer
// actually draws on the canvas.
function renderedWidth(s, basePx) {
  let px = basePx;
  while (px > CONFIG.visual.statMinFontPx && widthAt(s, px) > TEXT_BUDGET) px -= 1;
  return widthAt(s, px);
}
const fmt = (n) => fmtStat(n, CONFIG.visual.statDecimals);

test('forked-Sniper L3 card stat lines fit inside the card', () => {
  const sim = new Simulation(cfg(), { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 3);
  assert.equal(sim.forkSelected('sniper'), true);
  const { statLines, power } = towerCardLines(sim.state, t, fmt);
  for (const line of statLines) {
    // independent of width: no unrounded float may reach the card text
    assert.ok(!/\d\.\d{4,}/.test(line), `raw float leaked into "${line}"`);
    assert.ok(renderedWidth(line, 17) <= TEXT_BUDGET, `line "${line}" overflows budget ${TEXT_BUDGET}px`);
  }
  assert.ok(!/\d\.\d{4,}/.test(power), `raw float leaked into "${power}"`);
  assert.ok(renderedWidth(power, 18) <= TEXT_BUDGET, `power "${power}" overflows budget ${TEXT_BUDGET}px`);
});

test('upgradeable basic L1 card stat lines fit inside the card', () => {
  const sim = new Simulation(cfg(), { seed: 1, mapIndex: 0 }); sim.startGame();
  const t = placeAt(sim, 3, 4, 'basic', 1);
  const { statLines, power } = towerCardLines(sim.state, t, fmt);
  for (const line of statLines) assert.ok(renderedWidth(line, 17) <= TEXT_BUDGET, `line "${line}" overflows budget ${TEXT_BUDGET}px`);
  assert.ok(renderedWidth(power, 18) <= TEXT_BUDGET, `power "${power}" overflows budget ${TEXT_BUDGET}px`);
});
