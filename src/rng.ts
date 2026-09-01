/**
 * Deterministic, seedable randomness.
 * Every doodle is a pure function of its seed, so a face can be re-created
 * from a short string forever.
 */

import type { Weighted } from './types'

const NORM = 4294967296

export type Seed = string | number

export function hashSeed(seed: Seed): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 0x9e3779b9
  const s = String(seed ?? '')
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13

  return (h >>> 0) || 0x9e3779b9
}

export class Rng {
  seed: number
  state: number

  constructor(seed: Seed = 1) {
    this.seed = hashSeed(seed)
    this.state = this.seed
  }

  /** mulberry32 -- small, fast, good enough for doodles */
  next(): number {
    let t = (this.state += 0x6d2b79f5) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / NORM
  }

  float(a = 0, b = 1): number {
    return a + (b - a) * this.next()
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1))
  }
  bool(p = 0.5): boolean {
    return this.next() < p
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]
  }

  /** entries: [[value, weight], ...] */
  pickWeighted<T>(entries: Weighted<T>): T {
    let total = 0
    for (const e of entries) total += e[1]
    let r = this.next() * total
    for (const e of entries) {
      r -= e[1]
      if (r <= 0) return e[0]
    }

    return entries[entries.length - 1][0]
  }

  gauss(mu = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-12)
    const v = this.next()

    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  jitter(amount: number): number {
    return this.float(-amount, amount)
  }

  shuffle<T>(list: readonly T[]): T[] {
    const a = list.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }

    return a
  }

  /** n distinct members, at most list.length */
  some<T>(list: readonly T[], n: number): T[] {
    return this.shuffle(list).slice(0, Math.min(n, list.length))
  }

  /** A child stream, so adding a feature doesn't reshuffle unrelated ones. */
  fork(tag: string): Rng {
    return new Rng(hashSeed(`${this.seed}~${tag}`))
  }
}

export default Rng
