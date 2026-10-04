/** mulberry32. Advances `holder.rng` and returns a number in [0, 1). */
export function random(holder: { rng: number }): number {
  holder.rng = (holder.rng + 0x6d2b79f5) | 0
  let t = holder.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** An integer in [0, n). */
export function randomInt(holder: { rng: number }, n: number): number {
  return Math.floor(random(holder) * n)
}
