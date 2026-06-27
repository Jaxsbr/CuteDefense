/**
 * Seedable PRNG (mulberry32). Deterministic so headless tests and the benchmark
 * are reproducible, and so fireRate jitter can exist without breaking replays.
 * The sim never calls Math.random — all randomness flows through an Rng instance
 * held in state.
 */
export class Rng {
  constructor(seed = 1) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }
  // float in [0,1)
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // float in [min,max)
  range(min, max) { return min + this.next() * (max - min); }
  // int in [min,max] inclusive
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  bool(p = 0.5) { return this.next() < p; }
}

export default Rng;
