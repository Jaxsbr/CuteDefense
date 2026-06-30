export const meta = {
  name: 'cutedefense-impl-spec',
  description: 'Implement ONE depth-pass spec TDD-first, then independently verify (npm test + bench + parity gate), with up to 2 adversarial fix rounds',
  phases: [
    { title: 'Implement', detail: 'TDD: failing tests first -> implement -> full npm test green + bench < V1' },
    { title: 'Verify', detail: 'independent agent re-runs suite + bench + checks parity gate & completion criteria' },
    { title: 'Fix', detail: 'address verifier issues until green (<=2 rounds)' },
  ],
}

const REPO = '/Users/jacobusbrink/Jaxs/projects/CuteDefense'
const DOCS = REPO + '/v2/docs/depth-pass'
const SPECS = DOCS + '/specs'
// NOTE: args does not propagate via scriptPath in this runtime, so the spec
// is hardcoded here and edited per invocation.
const ID = 'P5'
const FLIPS = true        // does this spec intentionally flip win/lose terminal expectations? (only P5)
const NOTES = 'P1+P2+P3+P4 have ALL landed; suite is 93/93 green; the freeze+fork-aware optimal bot exists in policies.mjs; measure-secret-boss currently reports ~5.4x (freeze+fork) / 5.7x (fork-only) margin — boss still unbeatable. P5 is the CAPSTONE and is the ONE spec that flips terminal expectations.\n\nHALF A (standalone, must ship unconditionally): (1) REAL PUBLIC WIN — flip the last-wave gate / waves.isFinalWaveComplete from patternCount(=16) to publicWaveCount(=15) so clearing the wave-15 boss_regenerate fires status=won + a full celebration; a distinct banner for beating EACH boss along the way. (2) quality-weighted STARS (1-3) scored on decision quality (fast clears, low coin-waste, no-leak boss handling), not just leftover lives. (3) L3 SPRITE-FIT (#8) — decouple visual scale from grid footprint (clamp effective sizeScale / clamp the grid blit to the tile; pull glow/rings/puff inside the cell; express level via crown/pips/glow not raw body size).\n\nHALF B (depends on P2+P3+P4): opt-in SUMMIT — only AFTER the public win is banked, offer an explicit "try the SUPER boss?" dare; a continue path into wave 16 that does NOT latch status=won prematurely. TUNE the wave-16 split boss (re-measured via measure-secret-boss with the freeze+fork+affinity bot driving through the summit path) so the EXECUTED composition (P3 freeze to pin the 3 shards + P2 AoE affinity + P4 Bomber/Froster fork) is a real beatable path — NOT raw buy-the-win, NOT trivial. FALLBACK (must honor): if the margin cannot tune cleanly between "still a wall" and "buy-the-win", leave the summit an aspirational endless hook and ship the public win anyway — the public win must NEVER depend on the summit tuning.\n\nPARITY FLIP: deliberately update balance-ladder #4, secret-wave, and playthrough DoD expectations from lost@16 -> won@15 (public win), keeping the summit/secret-boss assertions separate and correct. Do not weaken any non-terminal assertion. Update the bot/harness so it takes the summit dare to still exercise wave 16. Keep bench V2 < V1.'

const CTX = `
PROJECT: CuteDefense V2 — kid-friendly (~5-10yo) static-hosted 2D tower-defense game. Repo: ${REPO}. Branch: v2-depth-pass (already checked out; do NOT touch main/V1).
RUN ALL COMMANDS FROM THE REPO: prefix shell with 'cd ${REPO} && ...'.
HARD CONSTRAINTS: static GitHub Pages (no backend, no build step, plain browser ES modules); pure seeded headless sim under v2/sim/; ALL constants in v2/config/gameConfig.js (no magic numbers in logic); V2 p95 frame time must stay < V1 p95 (npm run bench gate); charming + legible for young kids; minimal renderer.
TEST/BENCH:
- 'cd ${REPO} && npm test'  -> node:test over tools/tests/*.test.mjs (existing suites: sim, economy, balance-ladder, secret-wave, playthrough, replay-reset, maps, cute-soul, plan-mode).
- 'cd ${REPO} && npm run bench' -> tools/bench/run-bench.mjs; reads/writes tools/bench/results/*.json; V2 p95 must be < V1 p95 baseline.
- Balance harness: tools/balance/harness.mjs + policies.mjs (4-tier bot ladder driven via PUBLIC command API only) + measure-secret-boss.mjs.
RECONCILE-FIRST RULE: parts of a spec may ALREADY exist in the current code (e.g. coins ALREADY auto-credit on kill via economySystem.creditCoins; P1 already shipped plan-mode/tray/ready valve). Before implementing, READ the current code, confirm what already exists, and ADAPT the spec to reality — never duplicate or fight existing behavior.
PARITY GATE: ${FLIPS
  ? 'THIS spec (P5) intentionally flips win/lose terminal expectations (lost@16 -> won@15). Update the affected existing suites (balance-ladder #4, secret-wave, playthrough DoD) to the NEW correct expectations — deliberately and cleanly — and explain each change. Do NOT weaken any other assertion.'
  : 'This spec must NOT change win/lose terminal behavior. The existing suites (balance-ladder, secret-wave, playthrough) MUST stay green with their CURRENT expectations (optimal still wins waves 1-15 then loses to the secret boss @16; boss stays unbeatable). If your change shifts balance, update the harness/bot (tools/balance/*) so the ladder still holds — never weaken or skip a test to make it pass.'}
${NOTES ? '\nCHAIN CONTEXT: ' + NOTES : ''}
`

// Minimal, robust verdict schema (the only structured output in the workflow).
const VERDICT_SCHEMA = { type: 'object', additionalProperties: false, required: ['pass', 'suiteResult', 'benchResult', 'issues', 'summary'], properties: {
  pass: { type: 'boolean', description: 'true ONLY if full suite green AND bench V2<V1 AND parity gate held AND spec completion criteria met' },
  suiteResult: { type: 'string', description: 'pass/fail counts from a fresh npm test' },
  benchResult: { type: 'string', description: 'V1 p95 vs V2 p95 from a fresh npm run bench' },
  issues: { type: 'array', items: { type: 'string' }, description: 'concrete actionable defects for the fixer (empty if pass)' },
  summary: { type: 'string', description: 'one-paragraph verdict incl. parity-gate + completion-criteria check' },
} }

const TDD = `Follow strict TDD:
1) Write the spec's failing-test-first tests in tools/tests/ (real node:test, real command/harness API). Run them; confirm they FAIL for the right reason.
2) Implement the minimum to make them pass; keep constants in gameConfig.js, renderer minimal, sim pure/seeded.
3) Run the FULL suite 'cd ${REPO} && npm test' and iterate until ZERO failures (honor the PARITY GATE).
4) Run 'cd ${REPO} && npm run bench'; confirm V2 p95 < V1 p95; fix any regression (bake static art into SpriteCache, avoid per-frame allocations) before finishing.
5) Update tools/balance/{harness,policies}.mjs + the bench fixture as the spec's balance-parity deliverable requires, so the bot ladder + locked fixture exercise the new levers and still hold.
Work incrementally and run tests frequently. Do NOT claim done unless 'npm test' truly shows zero failures.`

// ---------- Implement (prose return — no heavy schema to choke on) ----------
phase('Implement')
const impl = await agent(
  `${CTX}\n\nYou are IMPLEMENTING spec ${ID}. Read ${SPECS}/SPEC-${ID}.md IN FULL and the "### ${ID} —" section of ${DOCS}/PROPOSALS.md. Read every file the spec touches and reconcile against current behavior (RECONCILE-FIRST RULE).\n\n${TDD}\n\nWhen finished, reply with a concise plain-text report: what you changed (files), the tests you added, the final 'npm test' result, the bench numbers (V1 vs V2 p95), and anything you reconciled as already-implemented.`,
  { label: `impl:${ID}`, phase: 'Implement', effort: 'high' }
)
log(`${ID} implement done (${impl ? impl.length : 0} chars report)`)

// ---------- Verify + Fix loop (verifier is the structured gate; guarded) ----------
async function verify(round) {
  try {
    return await agent(
      `${CTX}\n\nYou are an INDEPENDENT VERIFIER for spec ${ID} (fresh eyes — trust nothing, re-run everything). Read ${SPECS}/SPEC-${ID}.md (completion criteria).\nDo: (a) run 'cd ${REPO} && npm test' and record exact pass/fail; (b) run 'cd ${REPO} && npm run bench' and record V1 vs V2 p95; (c) 'cd ${REPO} && git diff --stat' and skim the diff for scope creep / weakened or skipped tests; (d) check EVERY completion criterion in the spec is met; (e) confirm the PARITY GATE held.\nSet pass=true ONLY if: suite fully green, bench V2<V1, parity held, and all completion criteria met. Otherwise list concrete, actionable issues. Keep the structured output SMALL and valid.`,
      { label: round === 0 ? `verify:${ID}` : `verify:${ID}#${round}`, phase: round === 0 ? 'Verify' : 'Fix', schema: VERDICT_SCHEMA, effort: 'high' }
    )
  } catch (e) {
    log(`${ID} verify round ${round} threw (${String(e).slice(0, 80)}) — treating as not-pass`)
    return null
  }
}

let verdict = null
for (let round = 0; round < 3; round++) {
  phase(round === 0 ? 'Verify' : 'Fix')
  verdict = await verify(round)
  log(`${ID} verify round ${round}: pass=${verdict ? verdict.pass : 'null(threw)'}${verdict && verdict.issues && verdict.issues.length ? ' — ' + verdict.issues.length + ' issue(s)' : ''}`)
  if (verdict && verdict.pass) break
  if (round === 2) break
  const issues = verdict && verdict.issues && verdict.issues.length ? verdict.issues : ['Verifier could not confirm pass (it may have failed to run or emit a verdict). Independently run npm test + npm run bench, find what is red or regressed, and fix it.']
  const fix = await agent(
    `${CTX}\n\nYou are FIXING spec ${ID}. An independent verifier reported these blockers:\n${JSON.stringify(issues)}\n\nRead ${SPECS}/SPEC-${ID}.md, resolve EVERY issue at the root (never by weakening/skipping a test), then re-run 'cd ${REPO} && npm test' (zero failures) and 'cd ${REPO} && npm run bench' (V2<V1). Honor the PARITY GATE. Reply with a short plain-text report of what you fixed and the final test + bench results.`,
    { label: `fix:${ID}#${round + 1}`, phase: 'Fix', effort: 'high' }
  )
  if (fix) log(`${ID} fix #${round + 1} done`)
}

return {
  id: ID,
  pass: !!(verdict && verdict.pass),
  suiteResult: verdict ? verdict.suiteResult : null,
  benchResult: verdict ? verdict.benchResult : null,
  issues: verdict ? verdict.issues : null,
  verdictSummary: verdict ? verdict.summary : null,
  implReport: impl ? impl.slice(0, 4000) : null,
}
