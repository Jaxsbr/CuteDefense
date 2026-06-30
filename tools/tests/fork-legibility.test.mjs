/**
 * W3 — fork legibility. At L3 a kid picks one of two fork arms from picture-only
 * buttons; nothing told them what each DOES before the tap. This pass adds a plain
 * kid-words `blurb` per arm (in gameConfig.js) and a pure `forkLabel(cfg,type,arm)`
 * helper the renderer paints beside each fork icon. These tests pin the pure data
 * contract (the canvas itself is exercised by tools/harness/captureP4.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { forkLabel, forkArmsFor, towerTypeIds } from '../../v2/sim/systems/towerSystem.js';

// Every arm of every tower TYPE yields a legible {name, blurb}.
test('forkLabel returns a legible {name, blurb} for every fork arm', () => {
  const c = CONFIG;
  const typesWithForks = towerTypeIds(c).filter(t => forkArmsFor(c, t).length > 0);
  assert.ok(typesWithForks.length >= 2, 'at least basic + strong fork');
  for (const typeId of typesWithForks) {
    for (const arm of forkArmsFor(c, typeId)) {
      const lab = forkLabel(c, typeId, arm);
      assert.ok(lab, `${typeId}.${arm} has a label`);
      assert.equal(typeof lab.name, 'string');
      assert.ok(lab.name.length > 0, `${typeId}.${arm} name non-empty`);
      assert.equal(typeof lab.blurb, 'string', `${typeId}.${arm} blurb is a string`);
      assert.ok(lab.blurb.length > 0, `${typeId}.${arm} blurb non-empty`);
      assert.notEqual(lab.blurb, lab.name, `${typeId}.${arm} blurb differs from name`);
      // short enough to fit beside the icon on the fork button
      assert.ok(lab.blurb.length <= 16, `${typeId}.${arm} blurb "${lab.blurb}" is short (<=16)`);
    }
  }
});

// An arm that does not belong to a type returns null (mirrors fork.test invalid-arm).
test('forkLabel returns null for an arm not valid for the type', () => {
  const c = CONFIG;
  assert.equal(forkLabel(c, 'basic', 'bomber'), null, 'bomber is a strong-only arm');
  assert.equal(forkLabel(c, 'strong', 'sniper'), null, 'sniper is a basic-only arm');
  assert.equal(forkLabel(c, 'basic', 'nope'), null, 'unknown arm');
  assert.equal(forkLabel(c, 'nosuchtype', 'sniper'), null, 'unknown type');
});

// The four named arms carry the kid-words from the brief.
test('each fork arm carries a plain-words blurb in config', () => {
  const c = CONFIG;
  assert.ok(c.towers.basic.forks.sniper.blurb, 'sniper blurb');
  assert.ok(c.towers.basic.forks.gunner.blurb, 'gunner blurb');
  assert.ok(c.towers.strong.forks.bomber.blurb, 'bomber blurb');
  assert.ok(c.towers.strong.forks.froster.blurb, 'froster blurb');
});
