# V2.2 Work Item — V6-catalog-admin

Regenerate `captures/enemy-catalog-preview.png` from its source `enemy-catalog.html`
so the marketing/parent-facing catalog tells the truth after the V2.2 boss-tower
rework and rebalance: **add the boss tower**, **correct stale enemy/tower stats**,
and surface the two systems the catalog never knew about — **enemy effects (flags:
armored / evasive / regen / swarm / buffer)** and **tower variations (forks:
Sniper / Gunner / Bomber / Froster)**.

This item is **data-dependent on the rebalance** — it must run *last*, after the
boss-tower single-target rework, the boss sprite rework, and the B6 rebalance have
all landed and the numbers are final. It is a *parallel fork relative to code*:
the files it touches are disjoint from sim/config, so it never collides; but the
values it prints can't be locked until upstream lands.

---

## 1. Current state (cited)

### The catalog is a hand-transcribed snapshot that has already drifted
`enemy-catalog.html` (repo root, 718 lines) embeds **verbatim copies** of the
config arrays — `ENEMIES` (`enemy-catalog.html:385`), `TOWERS`
(`enemy-catalog.html:447`), `SCHEDULE` (`enemy-catalog.html:425`). It re-implements
the game's `shapes.js`/`faces.js`/`SpriteCache.js` recipes inline to draw portraits.
Because it transcribes rather than imports, it drifts the moment config changes —
and it already has.

### Confirmed drift vs `v2/config/gameConfig.js` (V2.1, pre-V2.2)

| Field | Catalog says | Config says | Source |
|---|---|---|---|
| `boss_split.hp` | 20000 | **24000** | `gameConfig.js:170` |
| `boss_split` wave-16 on-field HP callout | ≈146,600 | **≈580,115** (measured) | `measure-secret-boss.mjs` SUMMARY |
| `strong` tower L2 cost | 60 | **55** | `gameConfig.js:231` |
| `strong` tower L2 bombDamage | 80 | **85** | `gameConfig.js:231` |
| W7 schedule | basic/fast/strong only | **+ 1× disabler** | `gameConfig.js:114` |
| W12 schedule | basic/fast/strong only | **+ 1× disabler** | `gameConfig.js:119` |

I ran `node tools/balance/measure-secret-boss.mjs`: on-field wave-16 HP is
**≈580,115** (base 24000 × scaling × lateSurge 3.30). The catalog's 146,600 is
~4× low.

### Entirely missing from the catalog
- **Boss tower** — header brags "2 towers" (`enemy-catalog.html:177`); `TOWERS`
  only lists `basic` + `strong`. The real `towers.boss` (`gameConfig.js:257`) — the
  late-game 3rd type and the ultimate key to the summit — has no card.
- **`disabler` ("Sleepy")** enemy (`gameConfig.js:184`) — a real spawning type
  (W7, W12), absent from `ENEMIES` and from the legend.
- **`boss_splitling` ("Star Shard")** (`gameConfig.js:178`) — the split children
  are *named* in the Split Boss ability blurb but have no card.
- **Enemy flags / effects** — the whole `enemyFlags` system (`gameConfig.js:337`):
  `armored` (Tough), `evasive` (Quick), `regen` (Healer), `swarm` (Swarm),
  `buffer` (Helper). Each has a kid-legible `label` + `legend`. None shown; the
  schedule prints flagged waves as if they were plain bodies.
- **Tower forks / variations** — `towers.basic.forks` {sniper, gunner}
  (`gameConfig.js:212`) and `towers.strong.forks` {bomber, froster}
  (`gameConfig.js:236`). Each already carries `name` + kid `blurb`. None shown.

### What V2.2 changes (the data this item waits on)
- **Boss-tower special → single-target aimed beam** (was full-map AoE
  shield-piercing nuke `Simulation.castUltimate`). The ultimate's name, `damage`,
  `cooldownMs`, and targeting semantics at `gameConfig.js:272` will change; the
  catalog's boss-tower copy must describe the **aimed beam**, not a blast.
- **Boss sprite rework** — current `shape:'fortress'` + `PALETTE.towers.boss`
  obsidian/crimson is being replaced with a SOFT-palette charming sprite. The
  catalog re-bakes portraits from shape+color, so it must pull the **final**
  `towers.boss.shape` + `PALETTE.towers.boss.body/border` (and likely add a
  `bakeBoss`-style recipe if the new shape isn't one of the existing
  `shapePath` cases: circle/square/diamond/hexagon/octagon/star).
- **Winnable summit re-derived** — the secret-wave narrative ("needs boss-tower
  upgrades", "≈5 casts") is now ~2 aimed casts/wave + tower support for the 3
  shards. The Split Boss + Star Shard copy and the mystery banner must be reworded
  to match the new win path (and the final `measure-secret-boss.mjs` output).

---

## 2. Concrete change (design-faithful)

### 2a. Kill the drift class: import CONFIG live instead of transcribing
The root cause of every stale number is the verbatim copy. The hard constraints
allow **plain ES modules** and the catalog is already served from repo root by
`tools/harness/staticServer.mjs` (`ROOT` = repo root, `staticServer.mjs:9`).
`gameConfig.js` is a pure ES module (it only imports `maps/index.js` + `palette.js`,
both pure). So the catalog can:

```html
<script type="module">
  import { CONFIG } from './v2/config/gameConfig.js';
  import { PALETTE } from './v2/render/palette.js';
  // derive ENEMIES / TOWERS / SCHEDULE from CONFIG.enemies, CONFIG.towers,
  // CONFIG.waves.patterns, CONFIG.enemyFlags — no transcription.
</script>
```

Only **editorial copy stays hand-written**: `blurb` (flavor text), the prose
`ability` descriptions, and the mystery-banner narrative. Everything numeric
(hp/speed/reward/cost/damage/range/fireRate/livesCost/forks/flags/schedule)
derives from CONFIG at page load, so the catalog **can never drift again** and the
V2.2 rebalance numbers flow in automatically. Fork `blurb`s and flag
`label`/`legend` are *already* in config — reuse them verbatim.

This is the faithful fix for an item whose whole job is "stats final, keep them
true." If a full live-import rework is judged too large for this pass, the
fallback (2b) at minimum corrects + extends the transcribed arrays — but then the
parity test (§4) is mandatory to stop the next drift.

### 2b. Content the regenerated page must contain
1. **Boss tower card** in the Towers grid (`grid-tower`, `enemy-catalog.html:203`).
   Render its portrait from final `towers.boss.shape` + `PALETTE.towers.boss`; show
   the 2-level table (cost/damage/range/fireRate) and a "Special: aimed beam" panel
   describing the single-target ultimate (final name/damage/cooldown). Note "sees
   the whole board" (`fullMap`) and "2×2 footprint". Update header count 2 → 3 towers.
2. **`disabler` ("Sleepy")** card in The Regulars; add to legend; show it in W7/W12.
3. **`boss_splitling` ("Star Shard")** card in The Bosses (or a sub-card under the
   Split Boss) with hp 22000, livesCost 12, the shield burst behavior.
4. **New "Enemy Effects" section** — one row/chip per `enemyFlags.defs` entry using
   its `label` + `legend` (e.g. Tough/"Hard shell — strong towers hit best"). Mark
   which appear in the schedule (armored/evasive/swarm/regen) vs defined-but-unused
   (buffer is in `defs` + `order` but not in any current wave pattern — show it as
   "rare/upcoming" or omit; do not imply it spawns).
5. **Tower forks** — under each forkable tower's level table, a "Level-3 choice"
   row showing both arms with `name`, `icon`, `blurb`, and the stat it changes
   (Sniper far+crit, Gunner faster, Bomber bigger boom, Froster freezes). The boss
   tower does **not** fork (`canFork` gates on L3; boss caps at L2) — say so.
6. **Schedule** — render flag badges per group from `pattern.enemies[].flags`, and
   include the disabler rows. Reword the secret wave-16 / Split Boss narrative to
   the new single-target win path; refresh the HP callout to the **measured** final
   number (do NOT hardcode — see §4).

### 2c. Regenerate the PNG
Add `tools/harness/captureCatalog.mjs` (mirrors `captureAll.mjs`): start
`staticServer`, open `/enemy-catalog.html` over CDP, wait for fonts + one anim
frame, full-page screenshot with `Page.captureScreenshot({ captureBeyondViewport:
true })` (the page is tall and scrolls), write `captures/enemy-catalog-preview.png`.
Optionally wire `"capture:catalog"` in `package.json`. The capture must run with
the **final** config so portraits use the new boss sprite and all numbers are live.

---

## 3. Files touched

| Path | Change |
|---|---|
| `/Users/jacobusbrink/Jaxs/projects/CuteDefense/enemy-catalog.html` | Rework: import CONFIG+PALETTE live (or correct+extend transcribed arrays); add boss-tower card, disabler + Star Shard cards, Enemy Effects section, fork rows; fix boss_split hp + wave-16 callout + strong L2; render flag badges + disabler in schedule; reword secret-wave narrative for single-target win path; header 2→3 towers. |
| `/Users/jacobusbrink/Jaxs/projects/CuteDefense/captures/enemy-catalog-preview.png` | Regenerated full-page screenshot (run after final config). |
| `/Users/jacobusbrink/Jaxs/projects/CuteDefense/tools/tests/catalog-parity.test.mjs` | **NEW** failing-first drift guard (§4). |
| `/Users/jacobusbrink/Jaxs/projects/CuteDefense/tools/harness/captureCatalog.mjs` | **NEW** CDP full-page capture for the catalog. |
| `/Users/jacobusbrink/Jaxs/projects/CuteDefense/package.json` | (optional) add `"capture:catalog"` script. |

No change to `gameConfig.js` for this item — the catalog is a **consumer**. The
config keys it READS (and which must therefore be final before this runs):
`towers.boss.{shape,footprint,fullMap,levels[*].{damage,range,fireRateMs,cost}}`,
`towers.boss.ultimate.{name,damage,cooldownMs,...}`, `PALETTE.towers.boss`,
`towers.strong.levels[1].{cost,bombDamage}`, `towers.{basic,strong}.forks.*`,
`enemies.boss_split.{hp,behavior}`, `enemies.boss_splitling`, `enemies.disabler`,
`enemyFlags.defs`, `waves.patterns` (for the schedule + flags),
`waves.scaling.{bossMult,lateSurge}` (for the wave-16 HP narrative).

---

## 4. Tests (failing-first)

**`tools/tests/catalog-parity.test.mjs` (unit) — the backstop.** Reads
`enemy-catalog.html` as text and asserts the rendered/embedded data matches
`CONFIG`:
- every `CONFIG.enemies` id (incl. `disabler`, `boss_split`, `boss_splitling`)
  appears in the catalog with matching hp/speed/reward;
- every `CONFIG.towers` id (incl. **`boss`**) appears with matching per-level
  cost/damage/range/fireRate;
- every `towers.*.forks` arm name + blurb appears;
- every `enemyFlags.defs` label + legend appears;
- the wave schedule (count of `waves.patterns`, incl. the secret wave + each
  group's `flags`) is reflected.

If the catalog goes live-import, the test asserts the page imports
`gameConfig.js`/`palette.js` (no transcribed numeric literals for the audited
fields). It **fails today** (missing boss tower, disabler, splitling, forks, flags;
stale 20000/146600/60/80) and passes only after the regen — this is the
failing-first proof.

**`captureCatalog.mjs` (render-capture) — visual proof.** Run the harness; assert
zero console errors/exceptions on the page and that
`captures/enemy-catalog-preview.png` is written non-empty. Manually eyeball the
PNG for the new boss sprite (SOFT palette, on-brand) and the new sections.

The wave-16 HP callout number must be sourced from `node
tools/balance/measure-secret-boss.mjs` SUMMARY (currently ≈580,115; will change
post-rebalance), **not hardcoded** — the parity test should compute the expected
value from `CONFIG.enemies.boss_split.hp × scaling` rather than pin a literal.

---

## 5. Balance impact

**None.** This is pure documentation/marketing output. It touches no file under
`v2/sim/`, no `gameConfig.js`, no policy/bot. It cannot move V2 p95 — the capture
harness runs on demand only and is not part of `npm test`/`npm run bench`. The
165-test suite and the bench budget are unaffected. The new parity + capture tests
add coverage without exercising the sim hot path.

---

## 6. Dependencies & parallel-safety

**dependsOn (data, hard sequencing):**
- Boss-tower ultimate → single-target aimed-beam rework (changes
  `towers.boss.ultimate` semantics/values + copy).
- Boss sprite rework (changes `towers.boss.shape` + `PALETTE.towers.boss`; the
  catalog re-bakes the portrait and may need a new `bakeBoss` recipe).
- B6 rebalance (final boss/strong/secret-wave numbers).
- `measure-secret-boss.mjs` update (final wave-16 HP + winnable-summit narrative
  ≈2 casts/wave + tower support for 3 shards).

This item **must run last** — it is the "stats are now final, make the catalog
true" step.

**parallelSafe:** File-disjoint from all gameplay code (`enemy-catalog.html`,
`captures/enemy-catalog-preview.png`, new test, new harness, `package.json`), so
it never *collides* with the rebalance/sprite/ultimate items and can be drafted in
parallel. But its *content* (numbers + boss portrait) can't be finalized until
those land, so the **commit/capture is sequenced after** them. The recommended
live-import rework (§2a) makes this trivial: once upstream is merged, the only
manual work is editorial copy + (if the new boss shape is novel) one bake recipe,
then re-run the capture.
