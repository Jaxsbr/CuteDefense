export const meta = {
  name: 'cutedefense-v21-batch',
  description: 'Implement a V2.1 batch (TDD per item, sequential or parallel), then independently verify (npm test + bench + parity/winnable gate) with up to 2 fix rounds',
  phases: [
    { title: 'Implement', detail: 'per item: failing tests first -> implement -> full npm test green + bench < V1' },
    { title: 'Verify', detail: 'independent: re-run suite + bench + parity/gate + per-item criteria' },
    { title: 'Fix', detail: 'resolve verifier issues (<=2 rounds)' },
  ],
}

const REPO = '/Users/jacobusbrink/Jaxs/projects/CuteDefense'
const DOCS = REPO + '/v2/docs/v2.1'
const RES = DOCS + '/research'

// ===== EDIT PER RUN =====
const BATCH = [
  { id: 'W9-W11-rebalance', focus: 'The BALANCE + WINNABLE-SUMMIT keystone (collapses plan B5+B6 into the single post-merge rebalance). Read BOTH briefs (v2/docs/v2.1/research/W9-balance-curve.md and W11-winnable-summit.md) AND EXECUTION-PLAN.md sections 3 (rebalance levers) and 4 (winnable-summit gate). Do all of this so the FULL suite ends GREEN at once (intermediate red while tuning is fine; finish only when green):\n(1) W9 — add waves.scaling.lateSurge {fromWave,hp,count,speed} in computeScaling so the LATE curve rises (optimal bleeds lives in ~W11-15; enemies reach/near the end tile late-game) WITHOUT re-flooding reward; encode it as balance-curve.test assertions.\n(2) W11 — add the SUMMIT_WON terminal (a new _checkWinLose branch, NOT GAME_WON which still fires exactly once for the public win@15), waveSystem.isSummitComplete, state.summitWon, and policies.maybeUltimate behind an {ultimate} flag; DELIBERATELY re-flip secret-wave.test.mjs into KEEP (no-ultimate still loses) + NEW (with-ultimate WINS the summit with lives>0). Update measure-secret-boss.mjs scenario C to assert separation.\n(3) THE SINGLE JOINT REBALANCE — tune ONLY named gameConfig keys (no magic numbers): towers.boss.ultimate.{damage,cooldownMs,initialReadyFraction}, towers.boss.{cost,fireRateMs}, enemies.boss_split.behavior.childHp, boss_splitling shield, waves.scaling.lateSurge, freeze.minSpeedFraction. Tune until ALL gates pass simultaneously: balance-curve late-tail RED tests go GREEN; balance-ladder #4 optimal() (NO ultimate) still WINS public waves 1-15; ladder #8 boss drain >=4 lives; WINNABLE-SUMMIT SEPARATION — optimal({ultimate:true}) WINS wave-16 with lives>0 AND optimal() (no ultimate) LOSES, on BOTH maps x seeds [1,7]; summit.test GAME_WON fires exactly once; measure-secret-boss A/A2/B no-ultimate margins unchanged (>=5x freeze+fork, >=3x fork-only) AND scenario C (with ultimate) wins+separates; full npm test green; npm run bench V2 p95 < V1 p95 (boss tower already in fixture). The reversal works because the ultimate is a flat, full-map, shield-piercing nuke (map-agnostic), so the win band is non-empty on both Ribbon and Comb. Update v2/docs/SECRET-WAVE.md to record the new winnable contract + final margins.' },
]
const PARALLEL = false       // implement agents concurrently (ONLY when items touch disjoint files)
const FLIPS = true           // batch intentionally flips win/lose terminal expectations (the winnable-summit reversal)
const NOTES = 'Batch 5+6 collapsed — the balance + winnable-summit keystone, run as ONE joint rebalance (W9 curve RED tests can only green once tuned against W8 offense, so they cannot be a standalone green batch). This is the pass big reversal: the secret split boss flips from unbeatable-wall to skill-gated win via the boss-tower ultimate. The public win@15 must remain intact and GAME_WON must still fire exactly once (the summit uses a separate SUMMIT_WON terminal). The no-ultimate kit must STILL lose the summit (separation), so this is not buy-the-win. Keep all 160 existing non-terminal tests green; only the secret-wave/summit terminal assertions are deliberately re-flipped.'
// ========================

const CTX = `
PROJECT: CuteDefense V2.1 pass on branch v2-depth-pass (depth pass already landed: 106 tests green, bench V2 p95 ~18ms < V1 ~74ms). Repo: ${REPO}. Do NOT touch V1 or main. Run all shell from the repo: 'cd ${REPO} && ...'.
HARD CONSTRAINTS: static GitHub Pages (no backend/build step, plain ES modules); pure seeded sim under v2/sim/; ALL constants in v2/config/gameConfig.js (no magic numbers); V2 p95 must stay < V1 p95 ('npm run bench'); charming + kid-legible; NO hover/tooltips (mobile); minimal renderer.
PLAN: the full execution plan is ${DOCS}/EXECUTION-PLAN.md and per-item briefs are under ${RES}/. Read your item's brief (${RES}/<id>.md) before implementing.
RECONCILE-FIRST: the depth pass already shipped plan-mode/tray, affinity+flags+Recon banner, nap+freeze (single slow term in enemySystem.effectiveSpeed(state,e)), economy+identity fork, public win@15 + stars + summit continue path. Read the current code, reconcile, never duplicate.
PARITY GATE: ${FLIPS
  ? 'This batch intentionally flips win/lose terminal expectations (the winnable-summit reversal). Update affected suites (secret-wave, balance-ladder, summit, measure-secret-boss) to the NEW correct contract deliberately; do not weaken any non-terminal assertion.'
  : 'This batch must NOT change win/lose terminal behavior. Existing suites (balance-ladder, secret-wave, summit, playthrough) MUST stay green with current expectations (optimal wins public game @15; secret split boss still UNBEATABLE by the standard kit). If a change shifts balance, update the harness/bot so the ladder still holds — never weaken/skip a test.'}
CHAIN CONTEXT: ${NOTES}
`

const TDD = `Strict TDD per item: (1) write the brief's failing-first tests in tools/tests/, run them, confirm RED for the right reason; (2) implement the minimum to pass; (3) 'cd ${REPO} && npm test' to ZERO failures (honor PARITY GATE); (4) 'cd ${REPO} && npm run bench' V2 p95 < V1 p95, fix regressions before finishing; (5) update tools/balance/* + bench fixture if the item's brief lists a balance-parity deliverable. Keep constants in gameConfig.js, renderer minimal. Do not claim done unless npm test is truly zero-fail.`

function implOne(it) {
  return agent(
    `${CTX}\n\nIMPLEMENT V2.1 item "${it.id}". Read ${RES}/${it.id}.md (and EXECUTION-PLAN.md for context). Reconcile against current code.\nFOCUS: ${it.focus}\n\n${TDD}\n\nReply with a concise plain-text report: files changed, tests added, final npm test result, bench numbers (V1 vs V2 p95), anything reconciled as already-present.`,
    { label: `impl:${it.id}`, phase: 'Implement', effort: 'high' }
  )
}

// ---------- Implement ----------
phase('Implement')
if (PARALLEL && BATCH.length > 1) {
  await parallel(BATCH.map(it => () => implOne(it)))
} else {
  for (const it of BATCH) await implOne(it)
}
log(`Implemented ${BATCH.length} item(s): ${BATCH.map(b => b.id).join(', ')}`)

// ---------- Verify + Fix ----------
const VERDICT_SCHEMA = { type: 'object', additionalProperties: false, required: ['pass', 'suiteResult', 'benchResult', 'issues', 'summary'], properties: {
  pass: { type: 'boolean', description: 'true ONLY if full suite green AND bench V2<V1 AND parity/gate held AND every batch item complete' },
  suiteResult: { type: 'string' },
  benchResult: { type: 'string' },
  issues: { type: 'array', items: { type: 'string' } },
  summary: { type: 'string' },
} }
const idList = BATCH.map(b => b.id).join(', ')
async function verify(round) {
  try {
    return await agent(
      `${CTX}\n\nINDEPENDENT VERIFIER for V2.1 batch [${idList}] (fresh eyes, re-run everything). Read each item's brief under ${RES}/.\nDo: (a) 'cd ${REPO} && npm test' exact pass/fail; (b) 'cd ${REPO} && npm run bench' V1 vs V2 p95; (c) 'cd ${REPO} && git diff --stat' for scope creep / weakened-or-skipped tests; (d) confirm each batch item's brief deliverables + failing-first tests are present and green; (e) confirm the PARITY GATE.\npass=true ONLY if suite fully green, bench V2<V1, parity/gate held, every item done. Else list concrete actionable issues. Keep output small + valid.`,
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
    `${CTX}\n\nFIX V2.1 batch [${idList}]. Verifier blockers:\n${JSON.stringify(issues)}\nResolve every issue at the root (never weaken/skip a test). Re-run 'cd ${REPO} && npm test' (zero fail) + 'cd ${REPO} && npm run bench' (V2<V1). Honor PARITY GATE. Short report back.`,
    { label: `fix#${round + 1}`, phase: 'Fix', effort: 'high' }
  )
}

return { batch: BATCH.map(b => b.id), pass: !!(verdict && verdict.pass), suiteResult: verdict ? verdict.suiteResult : null, benchResult: verdict ? verdict.benchResult : null, issues: verdict ? verdict.issues : null, summary: verdict ? verdict.summary : null }
