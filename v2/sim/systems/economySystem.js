/**
 * Economy system — coins. Coins drop on enemy death (grid-space position), live
 * for a fixed lifetime, warn before expiring, must be manually collected, and
 * expire (with feedback) if missed. Single place for coin add/spend.
 */
import { EV } from '../events.js';
import { genId } from '../state.js';

const COIN_PULSE_MS = 500;

export function addCoins(state, n) { state.coins += n; }
export function canAfford(state, n) { return state.coins >= n; }
export function spend(state, n) { if (state.coins < n) return false; state.coins -= n; return true; }

// Credit coins straight to the wallet AND pulse the HUD total (kills, sell, bonus).
export function creditCoins(state, n) {
  state.coins += n;
  state.coinPulseEnd = state.clock + COIN_PULSE_MS;
}

export function spawnCoin(state, x, y, value) {
  state.coinsList.push({
    id: genId(state),
    x, y,                         // grid-space (continuous) coords
    value,
    age: 0,
    phase: 'normal',             // normal | warning | expired | collected
    anim: 0,                     // collect/expire animation clock
    bounceSeed: state.rng.next() * Math.PI * 2,
  });
}

export function update(state, dt) {
  const c = state.config.economy.coin;
  for (const coin of state.coinsList) {
    if (coin.phase === 'collected' || coin.phase === 'expired') { coin.anim += dt; continue; }
    coin.age += dt;
    const remaining = c.lifetimeMs - coin.age;
    if (remaining <= 0) {
      coin.phase = 'expired'; coin.anim = 0;
      state.bus.emit(EV.COIN_EXPIRE, { id: coin.id });
      state.frameEvents.push({ type: EV.COIN_EXPIRE, id: coin.id });
    } else if (remaining < c.warningMs) {
      coin.phase = 'warning';
    }
  }
  // Remove coins whose collect/expire animation has finished.
  state.coinsList = state.coinsList.filter(coin => {
    if (coin.phase === 'collected') return coin.anim < c.collectAnimMs;
    if (coin.phase === 'expired') return coin.anim < c.expireAnimMs;
    return true;
  });
}

// NOTE: coins are no longer collected manually. Enemy kills credit the wallet
// directly (see enemySystem.killEnemy -> creditCoins). spawnCoin/update remain
// only so the locked benchmark fixture can render its 30-coin stress scene.
