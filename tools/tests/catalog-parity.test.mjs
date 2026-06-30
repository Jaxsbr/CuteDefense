// CATALOG PARITY GATE
// ---------------------------------------------------------------------------
// Parses the human-facing enemy/tower CATALOG (enemy-catalog.html at the repo
// root) and asserts every stat it advertises still matches the FROZEN live
// balance in v2/config/gameConfig.js. The catalog re-types its numbers as plain
// JS data literals (ENEMIES / TOWERS / FLAGS) so a kid-facing doc cannot
// silently drift away from the game it claims to describe.
//
// Strategy: read the html as text, lift each `const NAME = [ ... ]` literal with
// a string-aware bracket matcher, eval it in an isolated Function scope (the
// literals reference no external symbols), then diff against CONFIG.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG } from '../../v2/config/gameConfig.js';
import { computeScaling } from '../../v2/sim/systems/waveSystem.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = readFileSync(path.join(ROOT, 'enemy-catalog.html'), 'utf8');

// Lift `const NAME = [ ... ]` from the html via a quote-aware bracket scan, then
// evaluate the literal (pure data — numbers/strings/objects, no free variables).
function extractArray(name) {
  const marker = `const ${name} = `;
  const at = HTML.indexOf(marker);
  assert.ok(at >= 0, `catalog must define "${name}"`);
  let i = HTML.indexOf('[', at);
  const begin = i;
  let depth = 0, quote = null, end = -1;
  for (; i < HTML.length; i++) {
    const ch = HTML[i], prev = HTML[i - 1];
    if (quote) { if (ch === quote && prev !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  assert.ok(end > begin, `could not bracket-match the "${name}" literal`);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${HTML.slice(begin, end)};`)();
}

const ENEMIES = extractArray('ENEMIES');
const TOWERS = extractArray('TOWERS');
const FLAGS = extractArray('FLAGS');
const byId = (arr, id) => arr.find((e) => e.id === id);

test('catalog ENEMIES stats match gameConfig.enemies', () => {
  for (const [id, cfg] of Object.entries(CONFIG.enemies)) {
    // catalog roster is the 3 regulars + 4 bosses; splitling/disabler are covered
    // by the effect/ability copy, not as standalone stat cards.
    const cat = byId(ENEMIES, id);
    if (!cat) continue;
    for (const k of ['hp', 'speed', 'size', 'reward', 'livesCost', 'animSpeed']) {
      assert.equal(cat[k], cfg[k], `enemy ${id}.${k}: catalog ${cat[k]} != config ${cfg[k]}`);
    }
  }
  // the 7 advertised cuties must all exist
  for (const id of ['basic', 'fast', 'strong', 'boss_shield', 'boss_speed', 'boss_regenerate', 'boss_split']) {
    assert.ok(byId(ENEMIES, id), `catalog missing enemy "${id}"`);
  }
});

test('catalog Split-Boss wave-16 on-field HP is the real scaled number', () => {
  const cat = byId(ENEMIES, 'boss_split');
  const sc = computeScaling(CONFIG, 16, true);
  const onField = Math.round(CONFIG.enemies.boss_split.hp * sc.hpMult);
  assert.equal(cat.hpWave16, onField, `boss_split.hpWave16: catalog ${cat.hpWave16} != computed ${onField}`);
});

test('catalog basic + strong tower per-level stats match gameConfig', () => {
  for (const id of ['basic', 'strong']) {
    const cat = byId(TOWERS, id);
    assert.ok(cat, `catalog missing tower "${id}"`);
    const cfg = CONFIG.towers[id];
    assert.equal(cat.levels.length, cfg.levels.length, `${id} level count`);
    cfg.levels.forEach((lvl, n) => {
      const c = cat.levels[n];
      for (const k of ['damage', 'range', 'fireRateMs', 'cost']) {
        assert.equal(c[k], lvl[k], `tower ${id} L${n + 1}.${k}: catalog ${c[k]} != config ${lvl[k]}`);
      }
      if (lvl.bombDamage != null) {
        assert.equal(c.bombDamage, lvl.bombDamage, `tower ${id} L${n + 1}.bombDamage`);
      }
    });
    assert.equal(cat.projectile.size, cfg.projectile.size, `tower ${id} projectile.size`);
  }
});

test('catalog BOSS tower matches gameConfig.towers.boss (range/cost/beam)', () => {
  const cat = byId(TOWERS, 'boss');
  assert.ok(cat, 'catalog missing the BOSS tower');
  const cfg = CONFIG.towers.boss;

  assert.equal(cat.fullMap, cfg.fullMap, 'boss fullMap flag');
  assert.equal(cat.footprint, cfg.footprint, 'boss footprint');
  assert.equal(cat.projectile.size, cfg.projectile.size, 'boss projectile.size');

  assert.equal(cat.levels.length, cfg.levels.length, 'boss has exactly 2 levels');
  cfg.levels.forEach((lvl, n) => {
    const c = cat.levels[n];
    for (const k of ['damage', 'range', 'fireRateMs', 'cost']) {
      assert.equal(c[k], lvl[k], `boss L${n + 1}.${k}: catalog ${c[k]} != config ${lvl[k]}`);
    }
    assert.equal(!!c.ultimate, !!lvl.ultimate, `boss L${n + 1} ultimate-unlocked flag`);
  });
  // explicit cost spotcheck (the headline 750 / 500)
  assert.equal(cat.levels[0].cost, 750, 'boss L1 cost == 750');
  assert.equal(cat.levels[1].cost, 500, 'boss L2 cost == 500');

  // the single-target BEAM ultimate (renamed off "Blast")
  const u = cat.ultimate, cu = cfg.ultimate;
  assert.equal(u.name, cu.name, 'beam name');
  assert.equal(u.name, 'Boss Beam', 'beam is named "Boss Beam"');
  assert.equal(u.cooldownMs, cu.cooldownMs, 'beam cooldownMs');
  assert.equal(u.beamTotalDamage, cu.beam.totalDamage, 'beam totalDamage');
  assert.equal(u.beamDurationMs, cu.beam.durationMs, 'beam durationMs');
  assert.equal(u.beamTickMs, cu.beam.tickMs, 'beam tickMs');
});

test('catalog tower FORKS match gameConfig.towers[*].forks', () => {
  const sniper = byId(TOWERS, 'basic').forks.find((f) => f.id === 'sniper');
  const gunner = byId(TOWERS, 'basic').forks.find((f) => f.id === 'gunner');
  const bomber = byId(TOWERS, 'strong').forks.find((f) => f.id === 'bomber');
  const froster = byId(TOWERS, 'strong').forks.find((f) => f.id === 'froster');

  const cBasic = CONFIG.towers.basic.forks;
  const cStrong = CONFIG.towers.strong.forks;

  assert.equal(sniper.name, cBasic.sniper.name);
  assert.equal(sniper.rangeMult, cBasic.sniper.rangeMult, 'sniper rangeMult');
  assert.equal(sniper.critChance, cBasic.sniper.critChance, 'sniper critChance');
  assert.equal(sniper.critMult, cBasic.sniper.critMult, 'sniper critMult');

  assert.equal(gunner.name, cBasic.gunner.name);
  assert.equal(gunner.fireRateMult, cBasic.gunner.fireRateMult, 'gunner fireRateMult');

  assert.equal(bomber.name, cStrong.bomber.name);
  assert.equal(bomber.aoeRadiusMult, cStrong.bomber.aoeRadiusMult, 'bomber aoeRadiusMult');
  assert.equal(bomber.bombDamageMult, cStrong.bomber.bombDamageMult, 'bomber bombDamageMult');

  assert.equal(froster.name, cStrong.froster.name);
  assert.equal(froster.slowFactor, cStrong.froster.slow.factor, 'froster slow factor');
  assert.equal(froster.slowDurationMs, cStrong.froster.slow.durationMs, 'froster slow durationMs');
});

test('catalog enemy EFFECT flags match gameConfig.enemyFlags.defs', () => {
  const defs = CONFIG.enemyFlags.defs;
  for (const [id, cfg] of Object.entries(defs)) {
    const cat = byId(FLAGS, id);
    assert.ok(cat, `catalog missing effect flag "${id}"`);
    assert.equal(cat.label, cfg.label, `flag ${id} label`);
    assert.equal(cat.legend, cfg.legend, `flag ${id} legend`);
    if (cfg.behavior && cfg.behavior.type === 'regen') {
      assert.equal(cat.regenHpPerSec, cfg.behavior.hpPerSec, `flag ${id} regen hpPerSec`);
    }
    if (cfg.behavior && cfg.behavior.type === 'buff') {
      assert.equal(cat.buffRadius, cfg.behavior.buffRadius, `flag ${id} buffRadius`);
      assert.equal(cat.buffMult, cfg.behavior.buffMult, `flag ${id} buffMult`);
    }
  }
});
