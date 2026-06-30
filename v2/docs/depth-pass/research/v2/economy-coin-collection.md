# Depth Pass — Area Analysis: Economy & Coin Collection

Scope: how the player earns, holds, and spends coins in CuteDefense V2 today, what
genuine decisions that creates, and where it falls short — both against the grownup
playthrough feedback (esp. #4 "too much money" and #5 "did upgrades help?") and
against tower-defense genre norms.

Primary sources read:
- `v2/sim/systems/economySystem.js`
- `v2/config/gameConfig.js` (`economy`, `towers`, `enemies`, `waves.scaling`)
- `v2/sim/systems/enemySystem.js` (kill → reward)
- `v2/sim/systems/waveSystem.js` (reward scaling + end-of-wave bonus)
- `v2/sim/systems/towerSystem.js` (place / upgrade / sell costs)
- `v2/input/InputController.js`, `v2/app/GameApp.js`, `v2/render/Renderer.js`
- `v2/docs/BALANCE.md` (the economy retune + its own admitted gaps)

---

## 0. Ground-truth correction (important)

The project brief says: *"Killed enemies DROP coins that the player must MANUALLY tap
to collect (15s lifetime)."* **That is no longer true in the code.** The live game
**auto-credits** the kill reward straight to the wallet:

- `enemySystem.killEnemy` → `creditCoins(state, e.reward)` (`enemySystem.js:162`).
- `creditCoins` just does `state.coins += n` + a HUD pulse (`economySystem.js:16-19`).
- The input layer has no coin-tap path: *"Coins are auto-collected now, so there is
  no coin tap to handle."* (`InputController.js:46-47`).
- The economy module says so explicitly: *"coins are no longer collected manually…
  spawnCoin/update remain only so the locked benchmark fixture can render its 30-coin
  stress scene."* (`economySystem.js:55-57`).

So the entire on-board coin object system — `spawnCoin` (`economySystem.js:21-31`),
lifetime/warning/expire/collect animation (`economySystem.js:33-53`), and the
`economy.coin` config block (`lifetimeMs: 15000`, `warningMs: 5000`,
`collectRadius: 60`, `expireAnimMs`, `collectAnimMs` — `gameConfig.js:36-42`) — is
**dead code in the live path**, exercised only by the benchmark stress fixture
(`GameApp.js:168-172`). "Coin collection" as a player-facing mechanic does not exist
anymore; it has been collapsed into instant income.

This matters for a depth pass: any plan that wants a collection loop is *re-adding*
one, not tuning an existing one — and a whole config block is currently vestigial.

---

## 1. Current mechanics (what actually runs)

### Income (the faucet)
- **Starting coins: 60** (`gameConfig.js:34`).
- **Per-kill reward, auto-credited** (`enemySystem.js:160-162`): base `basic 3`,
  `fast 5`, `strong 8`; bosses `boss_shield 25`, `boss_speed 20`, `boss_regenerate
  30` (`gameConfig.js:91-99`).
- **Reward scaling per wave** (`waveSystem.js:29`, applied at `:52`):
  `rewardMult = reward^(w-1) * bossMult * coinReduction^(w-1)`
  = `1.08^(w-1) * (1.5 on boss waves) * 0.95^(w-1)`. Net non-boss growth ≈
  `1.026^(w-1)` (slightly rising), capped at wave 15 for the `eff` exponent but
  `coinReduction` uses the raw index. Floored at 1 coin (`Math.max(1, …)`).
- **End-of-wave bonus: 25% of coins earned that wave** (`waveSystem.js:157-164`),
  credited with a pulse + a floating "+Nc" (`state.bonusFloat`). The 25% rule is
  never shown to the player.
- HUD feedback only: `coinPulseEnd` total-pulse on every credit
  (`economySystem.js:18`, `state.js:49`) and the bonus float (`state.js:50`).

### Sinks (where coins go)
- **Place tower** — L1 cost `basic 5`, `strong 15` (`gameConfig.js:125,137`;
  `towerSystem.placeTower:27-28`).
- **Upgrade** — `basic 50 → 100`, `strong 60 → 120` (`gameConfig.js:126-127,
  138-139`; `towerSystem.upgradeTower:61-62`). Max level 3.
- **Sell** — refund `floor(invested * 0.7)` (`gameConfig.js:35`;
  `towerSystem.sellRefund:71-72`, `sellTower:75-84`). `invested` accumulates place +
  all upgrade costs (`towerSystem.js:34,64`).
- That is the **complete** list of sinks: 2 towers × 3 levels, plus sell. No
  abilities, consumables, global upgrades, interest, or unlocks.

### Spend gating in UI
- Buy popup shows the L1 cost + affordability tint (`Renderer.js:340-342, 376-395`).
- Selected-tower card shows `Damage … Range …` and `Fire …s` for the **current**
  level and an `Upgrade {cost}c` / `Sell +{refund}c` button (`Renderer.js:586-595`).

---

## 2. What genuine strategic decisions this area offers

Honest read: the **spending** side carries real, proven depth; the **earning /
collecting** side carries almost none.

**Real decisions (spend side):**
- **Spread vs save-and-upgrade vs optimal.** This is the game's central decision and
  the economy is its throttle. `BALANCE.md` proves with seeded bots that, after the
  range nerf (basic 2/2.5/3, strong 1.5/2/2.5) made coverage *local*, you must spend
  coins on **breadth first, then upgrade chokepoints** — pure spread under-performs
  save-and-upgrade, which under-performs optimal, monotonically across seeds/maps.
- **"Always a little short" reinvestment cadence.** `startingCoins 60` + `count`
  scaling `1.20` + `coinReduction 0.95` are tuned so the player is placing/upgrading
  nearly every round through ~wave 13 (`BALANCE.md` §1, §4). That cadence is a genuine
  recurring decision.
- **Sell-and-reposition.** Sell at 0.7 refund is a real lever the Optimal bot uses to
  recycle redundant L1 towers (`BALANCE.md` §3).

**Non-decisions (earn / collect side):**
- **Collection is automatic** — zero agency, zero risk, no timing, no spatial choice
  (§0). The "collection" half of this area is strategically empty.
- **Income is deterministic** — reward is fixed per enemy type; the only variance is
  whether a tower kills before the enemy reaches the goal. There is no last-hit
  bounty contest, no income gamble, no banking choice.
- **The end-of-wave bonus is passive** — 25% just appears; the player makes no
  decision to earn or grow it.

So: the economy is a meaningful *budget under which the placement game is played*,
but as a self-contained "earn & collect" loop it offers the player essentially one
decision (spend now vs spend slightly later) and no collection decision at all.

---

## 3. Gaps vs the grownup feedback

### Feedback #4 — "Why do I have so much money?" (HIGH)
- **Acknowledged structural ceiling.** `BALANCE.md` §5 admits it directly: *"once the
  path is fully covered with L3 towers, there is nothing left to buy (3 levels, finite
  tiles), so a perfect Comb run does accumulate surplus coins in the last 1–2 waves…
  the final couple of waves on the easy map are a solved wall."* The retune fixed the
  *opening/mid* but the **endgame still floods**. With only 2 towers × 3 levels + sell,
  the sink ladder is finite and shallow — surplus has nowhere to go.
- **Auto-credit amplifies the feeling.** Money now *appears* with no player action
  (§0). A growing pile you didn't work for and can't spend reads as especially
  pointless. The invisible +25% bonus (`waveSystem.js:157`) inflates that pile further
  with math the player never sees.
- **Cheap opening compounds it.** L1 costs are tiny (basic 5, strong 15) against 60
  starting coins — you can plant ~12 basic / 4 strong immediately, then income keeps
  arriving faster than the 2×3 sink ladder can absorb late.
- Maps to: needs more / deeper sinks, or an income mechanic that scales spend with
  earn (interest, scaling upgrades, abilities), or visible scarcity.

### Feedback #5 — "Did I spend all that money on upgrades — did it actually help?" (HIGH)
- **No before/after on the upgrade.** The Upgrade button is just `Upgrade 50c`
  (`Renderer.js:593`). It does not preview what you get — no `Damage 8→12`, no range
  increase, no fire-rate change, no range-ring preview. The card shows only the
  *current* level's `Damage / Range / Fire` (`Renderer.js:586-589`), so you cannot
  evaluate the purchase before or confirm its effect after.
- **No DPS, and the shown stats are kid-hostile.** It shows raw `Damage` and
  `Fire 1.80s` separately (`Renderer.js:588-589`); a 5–10-year-old cannot mentally
  compute DPS = damage ÷ fire interval. There is no single "power" number to watch go
  up.
- **No attribution.** `state.stats` tracks `coinsEarned`, `towersBuilt`,
  `enemiesKilled` (`state.js`), but none are surfaced per-tower or during play. There
  is no "this tower got N kills / earned N coins," so a spend can never be judged.
- Maps to: upgrade value-communication is fundamentally an economy-feedback gap —
  show the delta, a power number, and (ideally) per-tower contribution.

---

## 4. Gaps vs the genre (tower-defense economy norms)

- **No banking / interest mechanic.** Bloons-style "save for interest" or Kingdom-Rush
  pacing rewards *holding* coins. Here holding does nothing — the economy is a pure
  faucet → fixed-sink pipe with no reason to ever delay a spend (which also means the
  surplus in #4 is pure waste, not a strategic reserve).
- **No risk/reward on income.** Genre staples — last-hit bounties, leak-linked
  economy, "send early for a bonus" — are all absent. Income variance is nil, so there
  is no income *decision*.
- **Shallow, finite sink ladder.** Only 2 towers × 3 levels + sell. No targeting-mode
  purchases, no consumable abilities (bomb/freeze/heal), no global/meta upgrades, no
  map or tower unlocks. This finiteness is the literal root cause of feedback #4.
- **Removed collection agency.** Tap-to-collect coins (present in V1 and in this
  game's own brief) is a classic kid-TD engagement loop; V2 deleted it (§0). Removing
  it helped click-load (feedback #6/#7) but left the economy with **no player-facing
  action at all** — and left a dead config block + dead system behind. Whatever the
  decision, "coin collection" is currently a non-feature.
- **Opaque denominations / no goal affordance.** Rewards 3/5/8 vs costs 5/50/100/120
  mean ~10–30 kills per upgrade with no progress meter toward "the next thing you can
  afford." Nothing tells a child "almost enough for an upgrade" — the wallet is a bare
  number that pulses.
- **Invisible bonus math.** The 25% end-of-wave bonus is a genre-fine idea executed
  invisibly (`waveSystem.js:157-164`): it shows as a float but the rule is never
  taught, so it reads as random free money and feeds the "too much money, no idea why"
  perception.

---

## 5. Summary

The **spend** side of the economy is genuinely the spine of the game and is well
tuned for the opening and mid-game (proven by the `BALANCE.md` ladder). The **earn**
side is fully automatic and the **collect** side has been removed entirely — so as a
standalone "Economy & coin collection" area it currently offers the player one real
lever (spread vs save/upgrade vs reposition under a tight budget) and nothing else.

The two named feedback symptoms are both real and partly self-acknowledged in the
codebase: #4 (too much money) is a structural consequence of a finite 2×3 sink ladder
plus auto-income with no banking, worst in the late/easy-map endgame; #5 (did upgrades
help?) is an economy-feedback gap — the UI never shows the upgrade delta, a power/DPS
number, or per-tower contribution, so spends can't be evaluated.
