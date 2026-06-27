import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../../v2/config/maps/index.js';
import { parseMap } from '../../v2/sim/mapParser.js';

test('both maps parse into one contiguous orthogonal path', () => {
  for (const map of MAPS) {
    const parsed = parseMap(map);
    assert.equal(parsed.cols, 22, `${map.name} cols`);
    assert.equal(parsed.rows, 12, `${map.name} rows`);
    assert.ok(parsed.path.length > 10, `${map.name} path long enough (${parsed.path.length})`);

    // S first, E last.
    assert.deepEqual(parsed.path[0], parsed.start, `${map.name} path starts at S`);
    assert.deepEqual(parsed.path[parsed.path.length - 1], parsed.end, `${map.name} path ends at E`);

    // Each consecutive pair is orthogonally adjacent (distance exactly 1).
    for (let i = 1; i < parsed.path.length; i++) {
      const a = parsed.path[i - 1], b = parsed.path[i];
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      assert.equal(d, 1, `${map.name} step ${i} is orthogonally adjacent`);
    }

    // No path cell is also marked buildable.
    for (const p of parsed.path) {
      assert.equal(parsed.buildable[p.y][p.x], false, `${map.name} path cell ${p.x},${p.y} not buildable`);
    }
  }
});

test('a branching map is rejected', () => {
  assert.throws(() => parseMap({
    name: 'Bad', grid: [
      'S##...................',
      '..#...................',
      '..####...............E', // disconnected E + branch
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
    ],
  }));
});
