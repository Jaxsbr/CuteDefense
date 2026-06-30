export const meta = {
  name: 'cutedefense-depth-glue',
  description: 'Final integration: bounded summit-tuning attempt (split boss beatable through skill, with fallback), full composed verification, before/after captures',
  phases: [
    { title: 'Tune', detail: 'make the split boss beatable via the executed freeze+fork+affinity combo (or honor fallback)' },
    { title: 'Verify', detail: 'composed game: full npm test + bench + 4-tier ladder + measure-secret-boss' },
    { title: 'Captures', detail: 'regenerate before/after composed-game captures' },
  ],
}

const REPO = '/Users/jacobusbrink/Jaxs/projects/CuteDefense'
const DOCS = REPO + '/v2/docs/depth-pass'

const CTX = `
PROJECT: CuteDefense V2 — kid-friendly static-hosted 2D TD. Repo: ${REPO}. Branch: v2-depth-pass (do NOT touch main/V1). Run all shell from the repo: 'cd ${REPO} && ...'.
STATE: P1-P5 have all landed. npm test = 106/106 green. bench V2 p95 ~17.6ms < V1 ~74ms. The public game is now WON at wave 15 by the freeze+fork+affinity optimal bot (ladder: unfocused loses <=W4, spread <W15, saveUpgrade >=W10 & loses, optimal WINS@15). The wave-16 secret SPLIT boss is currently an UNBEATABLE wall: measure-secret-boss reports the executed combo lands ~32k vs ~175k on-field HP (margin 5.4x), so P5 took the sanctioned FALLBACK (summit aspirational, public win ships standalone).
HARD CONSTRAINTS: static GitHub Pages (no backend/build step, plain ES modules); pure seeded sim; ALL constants in gameConfig.js; V2 p95 must stay < V1 p95; charming + kid-legible. Never weaken/skip a test to make it pass.
`

const VERDICT_SCHEMA = { type: 'object', additionalProperties: false, required: ['pass', 'summitOutcome', 'suiteResult', 'benchResult', 'ladderResult', 'issues', 'summary'], properties: {
  pass: { type: 'boolean', description: 'true if composed game is healthy: full suite green, bench V2<V1, public win intact, AND summit is in one of the two sanctioned states (beatable-with-clean-separation OR documented-fallback)' },
  summitOutcome: { type: 'string', enum: ['beatable-through-skill', 'fallback-unbeatable', 'broken'], description: 'beatable-through-skill = freeze+fork+affinity optimal WINS summit while no-freeze/fork-only/naive LOSE; fallback-unbeatable = wall kept, public win intact; broken = neither / regressed' },
  suiteResult: { type: 'string' },
  benchResult: { type: 'string', description: 'V1 p95 vs V2 p95' },
  ladderResult: { type: 'string', description: 'the 4-tier ladder outcomes + (if applicable) summit separation' },
  issues: { type: 'array', items: { type: 'string' } },
  summary: { type: 'string' },
} }

// ---------- Phase 1: Tune (decide-first, then implement or fallback) ----------
phase('Tune')
const tune = await agent(
  `${CTX}\n\nYou are doing the FINAL SUMMIT TUNING. GOAL: make the secret wave-16 SPLIT boss genuinely BEATABLE THROUGH SKILL — not buy-the-win, not trivial — honoring the design's win path: kill the parent -> it splits into 3 shards -> FREEZE pins all 3 shards in the AoE kill zone -> Bomber/AoE bursts them.\n\nKEY INSIGHT to investigate first: measure-secret-boss.mjs currently measures damage to the PARENT crossing the map, where Freeze barely helps (5.4x vs 5.7x) — the parent never dies, so the designed shard-fight + freeze-pin never happens. The real skill test is the SHARD phase. So the unlock is: lower parent boss_split HP into a band where a STRONG EXECUTED build kills the parent (triggering the split), then tune the 3 shards (hp/speed/count/livesCost) so they are beatable ONLY with Freeze-pin + AoE/Bomber, and leaking a shard loses.\n\nDECIDE FIRST (spike before touching tests): can you tune wave-16 so that, driven through the summit path via the public command API: (A) the freeze+fork+affinity-EXECUTING optimal bot WINS the summit (clears wave 16, lives>0), AND (B) an optimal bot with FREEZE DISABLED loses the summit (shards leak), AND (C) fork-only and naive also lose? If YES -> implement it:\n- Tune ONLY wave-16 config (boss_split / boss_splitling in gameConfig.js + summit params); do NOT touch the public game (waves 1-15) balance.\n- Write the failing-test-first SUMMIT-WINNABILITY test asserting separation (A wins, B/C lose) — in a new tools/tests/summit-balance.test.mjs or extend secret-wave.test.mjs.\n- DELIBERATELY flip the existing secret-wave.test.mjs assertions from 'boss unbeatable / not killed' to the new correct intent (beatable via the executed combo; weaker builds still lose; shard fail-safe still uncheeseable). Keep the force-kill fail-safe test.\n- Update measure-secret-boss.mjs to drive the summit path and report whether the executed combo WINS (not just parent damage).\n- Add a freeze-disabled optimal variant to policies.mjs for the separation test.\nIf NO (cannot cleanly separate freeze-wins from no-freeze-wins after genuine effort) -> HONOR THE FALLBACK: change NOTHING about the boss (leave the wall + public win as-is), and just document in v2/docs/SECRET-WAVE.md why the summit stays aspirational. Do not leave tests half-flipped.\n\nEITHER WAY: keep the public win intact, run the FULL 'cd ${REPO} && npm test' to zero failures, and 'cd ${REPO} && npm run bench' V2<V1. Reply with a plain-text report: which path you took, the final ladder + summit numbers, the test + bench results, and what you changed.`,
  { label: 'summit-tune', phase: 'Tune', effort: 'high' }
)
log(`Tune done (${tune ? tune.length : 0} chars)`)

// ---------- Phase 2: Verify (guarded) ----------
async function verify(round) {
  try {
    return await agent(
      `${CTX}\n\nYou are the INDEPENDENT COMPOSED-GAME VERIFIER (fresh eyes, re-run everything).\nDo: (a) 'cd ${REPO} && npm test' — exact pass/fail; (b) 'cd ${REPO} && npm run bench' — V1 vs V2 p95; (c) 'cd ${REPO} && node tools/balance/measure-secret-boss.mjs' and read the 4-tier ladder test output to confirm the public win + (if claimed) the summit separation (freeze-optimal wins summit; no-freeze/fork-only/naive lose); (d) 'cd ${REPO} && git diff --stat' for scope creep / weakened-or-skipped tests.\nSet pass=true ONLY if: full suite green, bench V2<V1, public win intact (optimal wins@15, weaker policies lose), and the summit is in a sanctioned state (beatable-through-skill WITH proven separation, OR documented fallback). Set summitOutcome accordingly. Otherwise list concrete issues. Keep the structured output small and valid.`,
      { label: round === 0 ? 'verify' : `verify#${round}`, phase: round === 0 ? 'Verify' : 'Tune', schema: VERDICT_SCHEMA, effort: 'high' }
    )
  } catch (e) {
    log(`verify round ${round} threw (${String(e).slice(0, 80)}) — not-pass`)
    return null
  }
}

let verdict = null
for (let round = 0; round < 3; round++) {
  phase(round === 0 ? 'Verify' : 'Tune')
  verdict = await verify(round)
  log(`verify round ${round}: pass=${verdict ? verdict.pass : 'null'} summit=${verdict ? verdict.summitOutcome : '?'}`)
  if (verdict && verdict.pass) break
  if (round === 2) break
  const issues = verdict && verdict.issues && verdict.issues.length ? verdict.issues : ['Verifier could not confirm pass; independently run npm test + bench + measure-secret-boss, find what is red/regressed, and fix at the root. If the summit tuning is the blocker and cannot cleanly separate, revert cleanly to the documented fallback (public win intact, boss wall kept, tests consistent).']
  await agent(
    `${CTX}\n\nYou are FIXING the composed game. The verifier reported:\n${JSON.stringify(issues)}\n\nResolve every issue at the root (never weaken/skip a test). If the summit cannot be cleanly tuned, REVERT to the documented fallback so the suite is internally consistent and the public win is intact. Re-run 'cd ${REPO} && npm test' (zero failures) + 'cd ${REPO} && npm run bench' (V2<V1). Reply with a short report.`,
    { label: `fix#${round + 1}`, phase: 'Tune', effort: 'high' }
  )
}

// ---------- Phase 3: Captures ----------
phase('Captures')
const caps = await agent(
  `${CTX}\n\nRegenerate the before/after composed-game CAPTURE ARTIFACTS for the depth pass. Use the existing capture harnesses (tools/harness/captureAll.mjs, captureAnim.mjs, and the per-spec capturers captureP2/P3/P4 if present, plus visualCheck.mjs) over the static server + system Chrome (CDP). Produce after-captures under v2/captures/ that show the observable new mechanics: plan-frame + tray + 'I'm ready!' valve (P1); affinity tell (splat vs tink) + flag glyphs + Tactical Recon banner + reverse-entry wave (P2); tower nap zzz + wake countdown + freeze field + HUD freeze button (P3); fork card with before->after + Power number + the 4 fork sprites + Froster slow (P4); win+stars card + L3 sprite-fit + summit dare + wave-16 board (P5). If a capturer errors in this environment, note which and continue — do not fail the whole phase. Reply with the list of capture files produced (paths under v2/captures/) and any that could not be generated.`,
  { label: 'captures', phase: 'Captures', effort: 'medium' }
)

return {
  summitOutcome: verdict ? verdict.summitOutcome : 'unknown',
  pass: !!(verdict && verdict.pass),
  suiteResult: verdict ? verdict.suiteResult : null,
  benchResult: verdict ? verdict.benchResult : null,
  ladderResult: verdict ? verdict.ladderResult : null,
  issues: verdict ? verdict.issues : null,
  verdictSummary: verdict ? verdict.summary : null,
  tuneReport: tune ? tune.slice(0, 3500) : null,
  capturesReport: caps ? caps.slice(0, 1500) : null,
}
