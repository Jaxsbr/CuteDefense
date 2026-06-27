# V1 ↔ V2 Parity & Gap Analysis + Deliberate Divergences

> Phase 2 deliverable (revisited at Phase 5). Every V1 feature is marked
> **ported / changed / dropped**, with unintended gaps flagged. Section B lists
> where V2 deliberately diverges from V1 and why.

## A. Parity table

| V1 feature | Status in V2 | Note |
|---|---|---|
| Static-host, no-build delivery | **ported** | V2 = native ES modules, same constraint |
| Fixed 2514×1154 backing store, 22×12 @96px, 400px left HUD | **ported** | identical coordinate model |
| visualViewport fit / safe-area / fullscreen btn | **ported** | reuse V1's proven approach; do not regress |
| Two maps, randomly chosen at start | **ported (changed format)** | human-editable ASCII (see B1) |
| Path: start → contiguous orthogonal path → end | **ported** | strict, validated |
| Enemy types BASIC/FAST/STRONG + shape language | **ported** | circle/diamond/square + faces kept |
| Boss enemies (shield/speed/regen/split) | **ported (changed)** | uniform Enemy + behavior, not subclass (see B2); split/regen/shield/speed behaviors kept as data |
| Boss costs more lives + drops more coins | **ported** | `livesCost`/`reward` per entity |
| Waves: prep countdown → spawn → active → complete → gap | **ported** | timings in config |
| Countdown thuds last 5s; wave_start/complete announcements | **ported** | cheap polish kept |
| Difficulty scaling (hp/speed/count/reward, boss ×1.5, cap@15) | **ported** | exact formulas in config |
| 15 wave patterns, bosses at 5/10/15, formations | **ported** | data in config |
| Towers BASIC (ranged) / STRONG (AoE bomb) | **ported** | stats in config |
| Tower levels 1–3: size + visual change | **ported (balance changed)** | absolute per-level stats, not V1's additive math (see B3) |
| Projectiles (homing) + bombs (predictive lead, AoE) | **ported** | |
| 1% crit ×2 on single-target hits | **ported** | now config-driven, applied via one damage path (see B4) |
| Targeting score (dist/health/type weights) | **ported** | weights in config |
| Coins drop on kill, manual click-collect, 15s life, 5s warning, expire | **changed → auto-credit** | post-playtest: rewards go straight to the wallet, no drops/collection (see B12) |
| End-of-wave bonus (25% of wave earnings) | **new** | post-playtest addition (see B12) |
| Coin reward per-wave scaling | **ported** | exact formula, applied at the kill |
| Starting coins by difficulty | **ported (changed)** | single default difficulty (see B5) |
| Tower placement popup (place/cycle/cancel + range circle) | **ported** | modelled on V1; hit-rect registry |
| Left HUD: Lives / Wave / Coins, portrait, Pause/Sound/Upgrade/Sell | **ported (improved)** | redesigned inner layout (see B6) |
| **Upgrade** (enabled with enough coins) | **ported** | |
| **Sell** (enabled when tower selected) | **changed → implemented** | V1's was a no-op TODO; V2 builds it for real (see B7) |
| Start menu | **changed** | Play + Sound only, decorated with game visuals (spec) (see B5) |
| Win/lose overlay + Play Again | **ported (enriched)** | adds run stats (see B8) |
| Pause overlay + continue | **ported** | |
| Win = last wave cleared alive; Lose = lives ≤ 0 | **ported** | |
| 15 wired SFX (exact .ogg assets) | **ported** | via event bus |
| Background music | **dropped (intentional)** | disabled & broken in V1 (see B9) |
| Day/night tile tint/dim/flash | **dropped (required by spec)** | see B10 |
| Debug keys (D coins, G/P/C overlays, N/L/W) | **changed** | minimal debug kept behind a flag; the "+2000 coins on D" cheat dropped |
| Effects (projectile/enemy/coin/tower) | **ported (budget-gated)** | added only if bench shows headroom (spec §6) |
| Click-on-press input | **changed** | pointer events; keep audio-unlock on first gesture (see B11) |
| Two hardcoded 400/0 world transforms | **dropped (bug)** | one shared transform |
| `getCurrentColors` per-entity, per-frame gradients, shadowBlur | **dropped (perf)** | sprite cache + flat fills |

### Unintended gaps to watch (verified absent at Phase 5)
- None known yet. Candidates to re-check before sign-off: enemy hit-flash/squint feedback, dramatic death effect, tower idle-pulse/firing-pop, coin warning/expired visual states, rank badge/L3 sparkles, range-circle on placement. Each is listed because losing it silently would erode the recognisable charm.

## B. Deliberate divergences (researched, not accidental)

- **B1 — Map format → human-editable ASCII.** V1 paths are long hand-coded `{x,y}` arrays inside `GridSystem`. V2 uses an ASCII grid (`S`=start, `#`=path, `.`=open/buildable, `E`=end) a non-coder can edit, parsed + validated (contiguous, orthogonal, single start/end) at load. *Why:* the spec requires a human-editable format; ASCII is the lowest-friction option and makes validation trivial.
- **B2 — Bosses are data on a uniform `Enemy`, not a subclass.** *Why:* V1's `BossEnemySystem extends EnemySystem` with a shared, under-reset counter is the exact cause of the instant-loss bug. Composition removes the bug class.
- **B3 — Tower per-level stats are ABSOLUTE (intended values), not V1's additive runtime math.** In V1 `damage/range` were *added* on upgrade while `fireRate/bombDamage` were *set*, so the actual stats (e.g. BASIC L3 ended at 38 dmg / range 18 — nearly the whole 22-wide board) diverged from the data file's per-level comments, and the giant ranges trivialised tower placement. V2 reads each level's stats as absolute values straight from `config.towers[*].levels` (BASIC 8/12/18 dmg, range 5/6/7; STRONG 20/35/55 dmg + bomb 40/80/120, range 2/3/4), matching the data file's documented *intent* with sane, placement-relevant ranges. Costs are unchanged (BASIC 5/50/100, STRONG 15/60/120). Deliberate balance fix, stated in config so it is intentional.
- **B4 — One damage path for single-target AND AoE.** V1 bombs bypass the boss shield/boss system (`handleBombExplosion` damages by id only). V2 routes all damage through one function so bosses/shields behave consistently. This is a *correctness* change vs V1.
- **B5 — Single difficulty + Play/Sound-only start menu.** Spec mandates a 2-button start menu. V2 defaults to V1's "easy" (long winding paths, 25 lives) and drops the Easy/Hard selector and its keybindings.
- **B6 — HUD inner layout redesigned.** V1 splits the column into rigid 1/5–3/5–1/5 blocks with a cramped center and hit-rects computed by a `+200` guess. V2 uses a content-flow docked panel: compact **info card** (Lives bar, Wave, Coins) on top; a **selection card** (portrait + stats + Upgrade/Sell, only when something is selected) in the middle; a **control row** (Pause/Sound) at the bottom. Every button registers its real rect in one hit-test registry — no guessed geometry. *Why:* removes the #1 maintainability smell and the dead-button drift; reclaims vertical breathing room.
- **B7 — Sell implemented.** Tracks cumulative invested coins per tower; refunds `sellRefundFraction` (default 0.7) of the investment; enabled whenever a tower is selected (incl. max level); removes the tower and refunds. V1 shipped a drawn-but-dead button.
- **B8 — Win/lose overlay shows run stats** (waves cleared, towers built, enemies defeated, coins earned, time). V1 showed only `reached/max` on loss.
- **B9 — No background music.** It is disabled and broken in V1 (`toggleMute` references a missing `.wav`). Re-enabling is out of scope; SFX are fully ported.
- **B10 — No day/night system.** Required by spec ("No day/night system that alters tile look"). Also deletes V1's dead `STARTS IN` branch and a large chunk of render cost.
- **B11 — Pointer events, click-on-release.** Reduces accidental taps/drags; first gesture still unlocks audio. Behavioural change vs V1's press-fire, chosen for touch feel on the tablet.
- **B12 — Coins are auto-credited; no manual collection; +25% end-of-wave bonus** *(post-playtest change, owner-directed).* Enemy kills add the reward **straight to the wallet** (the HUD coin total pulses on each credit) — coins are never dropped on the board and there is nothing to tap. At the end of every wave the player is paid a **bonus of 25% of that wave's kill earnings**, which pulses the coin total and plays the `coin_collect` SFX. *Why:* playtesting showed manual tapping was fiddly and the loose-coin lifecycle was the source of a render crash; direct credit is simpler and kid-friendlier, and the wave bonus rewards clearing efficiently. This supersedes the original spec's "player actively collects (manual tap)" line. The collectable-coin sprite + render path are retained **only** so the locked benchmark fixture can keep its 30-coin render-stress scene for an apples-to-apples comparison with V1 (real V2 gameplay renders zero loose coins, so its true per-frame cost is even lower than the benchmark reports).
