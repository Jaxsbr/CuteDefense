# CuteDefense V2.1 — Resume Checkpoint

**Paused at a clean green boundary.** Branch `v2-depth-pass`. Nothing running.

## State at pause
- `npm test` → **140 / 140 pass, 0 fail**.
- `npm run bench` → V2 p95 ~21ms < V1 p95 ~79–84ms (~74% under; hard gate V2<V1 holds with big margin).
- **Landed & verified:** the whole depth pass (P1–P5) + V2.1 **Batch 1** (W5 sound-on-replay bug, W8-ART boss sprite) + V2.1 **Batch 2** (W10 freeze-cap, W6 text-rounding, W4 freeze-ability-UI, W3 fork-legibility, W2 flag-legend, W1 plan-mode skip-valve removal).
- **All work is UNCOMMITTED** in the working tree (55 changed/new paths: depth pass + V2.1 B1–B2 together).

## Remaining work (execution plan: `v2/docs/v2.1/EXECUTION-PLAN.md`)
Forced-sequential from here; the keystone (B4) and rebalance (B6) are single-item batches.

| Batch | Items | Flips terminal tests? |
|-------|-------|-----------------------|
| **B3** | W7 restart (HUD restart button; depends on W5 ✅ + W4 ✅) | no |
| **B4** | W8 boss tower keystone (2×2 placement, full-map range, slow, manual ultimate unlocked by its single upgrade; merges W8-ART) | no |
| **B5** | W9 balance-curve → W11 winnable-summit | no (W11 prep only) |
| **B6** | SINGLE post-merge rebalance + the **with-ultimate WINS / no-ultimate LOSES** gate | **YES** (secret-wave re-flip) |

## How to resume (one step per batch)
1. Edit `v2/docs/v2.1/.v21-impl.js` — set the `BATCH`, `PARALLEL`, `FLIPS`, `NOTES` constants for the next batch (see arrays below).
2. `Workflow({ scriptPath: "/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/docs/v2.1/.v21-impl.js" })`
3. On completion, confirm `npm test` green + bench < V1, then proceed to the next batch.

### B3
```
BATCH = [{ id: 'W7-restart', focus: 'In-game RESTART button (V1 had it): fresh playable state, audio intact (flows through W5-repaired restart()). HUD bottom row 2->3 buttons; InputController dispatch case. Sits between W4 ability button and (later) W8 ultimate button.' }]
PARALLEL = false; FLIPS = false
```
### B4
```
BATCH = [{ id: 'W8-boss-tower', focus: '3rd tower "boss": 2x2 multi-tile placement, full-map range, slow plink, single upgrade unlocking Simulation.castUltimate() (shield-piercing full-map nuke) + EV.ULTIMATE_CAST + _ultimateButton + dynamic N-col tray + harness placeBoss/castUltimate/ultimateReady + summitConqueror policy (ladder bots 1-4 stay boss-unaware) + measure-secret-boss scenario C + boss tower in bench fixture. Merge the W8-ART sprite. Ships the MECHANISM; B6 ships the VALUES.' }]
PARALLEL = false; FLIPS = false
```
### B5
```
BATCH = [
  { id: 'W9-balance-curve', focus: 'computeScaling lateSurge {fromWave,hp,count,speed} + RED balance-curve.test inverting the curve (optimal bleeds lives W11-15). RED until B6 tunes it with W8 offense. Do NOT re-flood reward.' },
  { id: 'W11-winnable-summit', focus: 'SUMMIT_WON terminal (NOT GAME_WON), waveSystem.isSummitComplete, state.summitWon, policies.maybeUltimate behind ultimate flag, secret-wave re-flip prep. After W8 + W10 + W9.' },
]
PARALLEL = false; FLIPS = false   # (W11 lands the structure; the deliberate test FLIP happens in B6 rebalance)
```
### B6 — single rebalance (run once)
```
BATCH = [{ id: 'REBALANCE', focus: 'Tune jointly (named gameConfig keys only): towers.boss.ultimate.{damage,cooldownMs,initialReadyFraction}, towers.boss.{cost,fireRateMs}, boss_split/boss_splitling HP+shield, waves.scaling.lateSurge, freeze.minSpeedFraction. Gate ALL green at once: balance-curve late-tail rises; ladder #4 optimal(no-ult) WINS public 15; ladder #8 boss drain >=4 lives; WINNABLE-SUMMIT separation = optimal({ultimate:true}) WINS wave16 lives>0 AND optimal() (no-ult) LOSES, both maps x seeds [1,7]; summit GAME_WON fires once (SUMMIT_WON is the new terminal); measure-secret-boss A/A2/B no-ult margins unchanged + scenario C wins; full npm test green; bench V2<V1 with boss tower in fixture.' }]
PARALLEL = false; FLIPS = true    # deliberate secret-wave / balance-ladder terminal re-flip
```

## Final verification gate (after B6)
TDD per fix ✅(ongoing) · sim-asserted rising curve · with-ult WINS / no-ult LOSES split boss · captures (boss tower before/after upgrade + ultimate firing; end-game enemies near the goal; maxed run defeating split boss + win overlay) · full `npm test` green · `npm run bench` V2<V1 · local launch smoke.

## Watch-item
Bench self-regression: V2 p95 crept 18.9ms → ~21ms over B1–B2 (a soft self-check straddles its 15%-over-prior alarm on noisy runs). The HARD gate (V2<V1) is safe by ~74%. The boss tower (B4) + fixture will add cost — keep the final V2 p95 comfortably under V1; consider re-baselining `tools/bench/results/v2-prior.json` at the end of V2.1.
