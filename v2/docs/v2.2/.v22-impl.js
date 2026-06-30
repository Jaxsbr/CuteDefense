export const meta = {
  name: 'cutedefense-v22-batch',
  description: 'Implement a V2.2 batch (TDD per item, sequential or parallel), then independently verify (npm test + bench + parity/winnable gate) with up to 2 fix rounds',
  phases: [
    { title: 'Implement', detail: 'per item: failing tests first -> implement -> full npm test green + bench < V1' },
    { title: 'Verify', detail: 'independent: re-run suite + bench + parity/gate + per-item criteria' },
    { title: 'Fix', detail: 'resolve verifier issues (<=2 rounds)' },
  ],
}

const REPO = '/Users/jacobusbrink/Jaxs/projects/CuteDefense'
const DOCS = REPO + '/v2/docs/v2.2'
const RES = DOCS + '/research'

// ===== EDIT PER RUN =====
const BATCH = [
  { id: 'V2-V3-V7-combat-keystone', focus: 'The combat keystone — collapses V2 (offense) + V3 (economy) + V7 (winnable re-derivation) + the SINGLE joint rebalance into ONE green-to-green transition (the single-target beam DELETES the old full-map-AoE win, so intermediate red is expected; finish only when the FULL suite is green with the two-sided gate). Read briefs V2-offense-redesign.md, V3-economy-nerf.md, V7-winnable-rederivation.md AND EXECUTION-PLAN.md sections 3 (levers) + 4 (two-sided gate).\n\n(V2 OFFENSE) Convert the L2 ultimate from full-map AoE to SINGLE-TARGET AIMED BEAM: Simulation.castUltimate(target) REQUIRES an enemy target (no target -> no fire); a new beamSystem.js applies DAMAGE-OVER-TIME over durationMs (enormous total, NOT an instant-kill on the on-field parent ~580k HP). Aim-confirm in InputController: clicking the ability arms a contrasting CROSSHAIR cursor and it fires only when an ENEMY is clicked; if an enemy is already selected, clicking the ability button also fires (no accidental casts). Renderer draws the streaming beam/laser + the crosshair cursor. RENAME "Blast"/"Boss Blast" -> a beam/laser-themed name everywhere (config + HUD + events). Basic attack: projectile ~2x larger + slightly faster fireRateMs.\n\n(V3 ECONOMY) Boss tower L1 cost ~750, L2 upgrade ~500 (total ~1250, ~2.3x), with the PAIRED waves.scaling.lateSurge income lift (cost hike is non-shippable alone — the reserving bot peaks ~840-857 today). Multiples viable late-game.\n\n(V7 WIN RE-DERIVATION) Re-derive the summit win for the BEAM: beam.totalDamage < parent on-field HP so ~2 casts crack the parent; durationMs/cooldownMs/initialReadyFraction so ~2-3 casts fit a crossing; buffed basic + freeze for the 3 shards; tune enemies.boss_split.behavior.childHp + boss_splitling shield. Update summitConqueror/maybeUltimate bot to AIM the beam (target the parent then shards), harness castUltimate(target)/ultimateReady, measure-secret-boss Scenario C. DELIBERATELY re-flip secret-wave/summit tests from the old AoE-win contract to the new beam-win contract; keep GAME_WON firing exactly once (public win@15 intact) and the no-ultimate kit STILL losing the summit.\n\n(JOINT REBALANCE + TWO-SIDED GATE) Tune ALL named gameConfig levers until BOTH hold at once: (1) STILL WINNABLE — secret-wave WITH-win lives>0 + WITHOUT-loss on maps[0,1]xseeds[1,7], measure-secret-boss Scenario C separation guard passes, win lives in ~6-10 band; (2) NOT A FACEROLL — single-target (one enemy per cast, no swarm clear), aim-confirm required (no accidental cast), long cooldown ~1-2 casts/wave, cannot one-shot the parent or trivially clear waves (win needs the full kit). Plus: balance-ladder #4 optimal still WINS public waves 1-15; full npm test green; npm run bench V2 p95 < V1 p95 (boss tower already in fixture). Update SECRET-WAVE.md with the new beam-win contract + final margins.' },
]
const PARALLEL = false       // shared tree: only run parallel when items are FULLY file-disjoint
const FLIPS = true           // the winnable-summit mechanic changes (AoE -> single-target beam): secret-wave/summit terminal contract is deliberately re-flipped
const NOTES = 'Batch 2 — the COMBAT KEYSTONE (V2+V3+V7+rebalance collapsed into one). The single-target beam removes the old AoE win, so the secret-wave/summit winnable tests are red mid-flight and can only go green after the joint rebalance re-derives the win with the beam — hence one atomic batch. Build on Batch 1 (new sprite, Pause, fixed HUD already landed; 180/180 green). Keep the public win@15 intact (GAME_WON once), keep the no-ultimate kit losing the summit (separation), keep quick-place + the cast-freeze ability. This is the big reversal of the win MECHANISM (AoE->beam) while keeping the game winnable AND not a faceroll.'
// ========================

const CTX = `
PROJECT: CuteDefense V2.2 boss-tower rework on branch v2-depth-pass (V2.1 landed: 165 tests green, bench V2 ~23ms < V1 ~80ms). Repo: ${REPO}. Do NOT touch V1 or main. Run all shell from the repo: 'cd ${REPO} && ...'.
HARD CONSTRAINTS: static GitHub Pages (no backend/build step, plain ES modules); pure seeded sim under v2/sim/; ALL constants in v2/config/gameConfig.js (no magic numbers); V2 p95 must stay < V1 p95 ('npm run bench'); charming + kid-legible (SOFT palette); NO hover/tooltips (mobile); minimal renderer.
PLAN: ${DOCS}/EXECUTION-PLAN.md ; per-item briefs under ${RES}/. Read your item's brief (${RES}/<id>.md) before implementing.
RECONCILE-FIRST: the boss tower already exists (towers.boss in gameConfig ~L257; ultimate L272; dark "fortress" sprite; "Blast" full-map AoE ultimate; relocated cast-freeze ability; plan-mode freeze+place). Read current code, reconcile, never duplicate.
PARITY GATE: ${FLIPS
  ? 'This batch intentionally flips win/lose terminal expectations (winnable-summit re-derivation with the new single-target beam). Update affected suites (secret-wave, summit, balance-ladder, measure-secret-boss) to the NEW correct contract deliberately; do not weaken any non-terminal assertion.'
  : 'This batch must NOT change win/lose terminal behavior. Existing suites (balance-ladder, secret-wave, summit, playthrough) MUST stay green with current expectations (optimal wins public @15; secret split boss winnable via the CURRENT ultimate). Do NOT alter the ultimate mechanic or balance numbers in this batch. If a change shifts balance, stop and reconsider — these forks are balance-neutral.'}
CHAIN CONTEXT: ${NOTES}
`

const TDD = `Strict TDD per item: (1) write the brief's failing-first tests in tools/tests/, run them, confirm RED for the right reason; (2) implement the minimum to pass; (3) 'cd ${REPO} && npm test' to ZERO failures (honor PARITY GATE); (4) 'cd ${REPO} && npm run bench' V2 p95 < V1 p95, fix regressions before finishing; (5) update tools/balance/* + bench fixture if the brief lists a balance-parity deliverable. Keep constants in gameConfig.js, renderer minimal. Do not claim done unless npm test is truly zero-fail.`

function implOne(it) {
  return agent(
    `${CTX}\n\nIMPLEMENT V2.2 item "${it.id}". Read ${RES}/${it.id}.md (and EXECUTION-PLAN.md for context). Reconcile against current code.\nFOCUS: ${it.focus}\n\n${TDD}\n\nReply with a concise plain-text report: files changed, tests added, final npm test result, bench numbers (V1 vs V2 p95), anything reconciled as already-present.`,
    { label: `impl:${it.id}`, phase: 'Implement', effort: 'high' }
  )
}

phase('Implement')
if (PARALLEL && BATCH.length > 1) {
  await parallel(BATCH.map(it => () => implOne(it)))
} else {
  for (const it of BATCH) await implOne(it)
}
log(`Implemented ${BATCH.length} item(s): ${BATCH.map(b => b.id).join(', ')}`)

const VERDICT_SCHEMA = { type: 'object', additionalProperties: false, required: ['pass', 'suiteResult', 'benchResult', 'issues', 'summary'], properties: {
  pass: { type: 'boolean', description: 'true ONLY if full suite green AND bench V2<V1 AND parity/gate held AND every batch item complete' },
  suiteResult: { type: 'string' }, benchResult: { type: 'string' }, issues: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' },
} }
const idList = BATCH.map(b => b.id).join(', ')
async function verify(round) {
  try {
    return await agent(
      `${CTX}\n\nINDEPENDENT VERIFIER for V2.2 batch [${idList}] (fresh eyes, re-run everything). Read each item's brief under ${RES}/.\nDo: (a) 'cd ${REPO} && npm test' exact pass/fail; (b) 'cd ${REPO} && npm run bench' V1 vs V2 p95; (c) 'cd ${REPO} && git diff --stat' for scope creep / weakened-or-skipped tests; (d) confirm each batch item's brief deliverables + failing-first tests are present and green; (e) confirm the PARITY GATE.\npass=true ONLY if suite fully green, bench V2<V1, parity/gate held, every item done. Else list concrete actionable issues. Keep output small + valid.`,
      { label: round === 0 ? 'verify' : `verify#${round}`, phase: round === 0 ? 'Verify' : 'Fix', schema: VERDICT_SCHEMA, effort: 'high' }
    )
  } catch (e) { log(`verify ${round} threw: ${String(e).slice(0, 70)}`); return null }
}
let verdict = null
for (let round = 0; round < 3; round++) {
  phase(round === 0 ? 'Verify' : 'Fix')
  verdict = await verify(round)
  log(`verify ${round}: pass=${verdict ? verdict.pass : 'null'}${verdict && verdict.issues && verdict.issues.length ? ' — ' + verdict.issues.length + ' issue(s)' : ''}`)
  if (verdict && verdict.pass) break
  if (round === 2) break
  const issues = verdict && verdict.issues && verdict.issues.length ? verdict.issues : ['Verifier could not confirm pass; independently run npm test + bench, find what is red/regressed across the batch, fix at the root.']
  await agent(
    `${CTX}\n\nFIX V2.2 batch [${idList}]. Verifier blockers:\n${JSON.stringify(issues)}\nResolve every issue at the root (never weaken/skip a test). Re-run 'cd ${REPO} && npm test' (zero fail) + 'cd ${REPO} && npm run bench' (V2<V1). Honor PARITY GATE. Short report back.`,
    { label: `fix#${round + 1}`, phase: 'Fix', effort: 'high' }
  )
}

return { batch: BATCH.map(b => b.id), pass: !!(verdict && verdict.pass), suiteResult: verdict ? verdict.suiteResult : null, benchResult: verdict ? verdict.benchResult : null, issues: verdict ? verdict.issues : null, summary: verdict ? verdict.summary : null }
