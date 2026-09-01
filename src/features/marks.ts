/** The small marks that turn a face into a person: blush, freckles, worry. */

import { arc, oval } from '../shapes'

import type { FeatureContext, MarkGenome, Weighted } from '../types'

export type MarkFn = (c: FeatureContext, m: MarkGenome) => void

export const marks: Record<string, MarkFn> = {
  blush(c, m) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(0.78 * side, -0.18)
      if (f.facing < 0.06) continue
      const poly = f.poly(oval(0, 0, 0.24, 0.15, c.rng.jitter(0.3), 16))
      if (m.style === 'hatch') {
        c.pen.hatch(poly, { angle: -0.9, gap: c.px * 0.03, color: m.color, alpha: 0.35, weight: 0.35 })
      } else {
        c.pen.blob(poly, { color: m.color, alpha: 0.42, rough: 1.4 })
      }
    }
  },

  freckles(c, m) {
    const count = m.count ?? 6
    for (const side of [-1, 1]) {
      const f = c.head.frame(0.62 * side, -0.05)
      if (f.facing < 0.06) continue
      for (let i = 0; i < count; i++) {
        const p = f.map(c.rng.float(-0.22, 0.22), c.rng.float(-0.14, 0.14))
        c.pen.dot(p[0], p[1], c.px * c.rng.float(0.008, 0.016), { color: m.color, alpha: 0.8 })
      }
    }
  },

  mole(c, m) {
    const f = c.head.frame(m.u ?? 0.6, m.v ?? 0)
    if (f.facing < 0.05) return
    c.pen.dot(...f.map(0, 0), c.px * 0.022, { color: c.pal.ink })
  },

  cheekLines(c) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(0.85 * side, -0.1)
      if (f.facing < 0.08) continue
      for (let i = 0; i < 3; i++) {
        c.pen.stroke(f.poly([[-0.1 + i * 0.09, -0.16], [-0.06 + i * 0.09, 0.16]]),
          { color: c.pal.ink, weight: 0.45, passes: 1, alpha: 0.6 })
      }
    }
  },

  wrinkles(c, m) {
    const count = m.count ?? 2
    const f = c.head.frame(0, 0.62)
    if (f.facing < 0.1) return
    for (let i = 0; i < count; i++) {
      c.pen.stroke(f.poly(arc(0, i * 0.11, 0.42, 0.1, Math.PI + 0.4, Math.PI * 2 - 0.4, 0, 8)),
        { color: c.pal.ink, weight: 0.45, passes: 1, alpha: 0.55 })
    }
  },

  dimples(c) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(0.52 * side, c.g.mouth.v + 0.02)
      if (f.facing < 0.08) continue
      c.pen.stroke(f.poly(arc(0, 0, 0.06, 0.12, -1.2, 1.2, 0, 8)),
        { color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.7 })
    }
  },

  scar(c, m) {
    const f = c.head.frame(m.u ?? 0.6, m.v ?? 0)
    if (f.facing < 0.06) return
    c.pen.stroke(f.poly([[-0.13, -0.13], [0.13, 0.13]]), { color: c.pal.ink, weight: 0.6, passes: 1 })
    c.pen.stroke(f.poly([[0.13, -0.13], [-0.13, 0.13]]), { color: c.pal.ink, weight: 0.6, passes: 1 })
  },

  whiskers(c) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(0.9 * side, -0.05)
      if (f.facing < 0.06) continue
      for (let i = -1; i <= 1; i++) {
        c.pen.stroke(f.poly([[0, i * 0.08], [0.32, i * 0.12]]),
          { color: c.pal.ink, weight: 0.4, passes: 1, alpha: 0.7 })
      }
    }
  },

  noseShade(c) {
    const f = c.head.frame(0.2, -0.12)
    if (f.facing < 0.1) return
    c.pen.hatch(f.poly(oval(0, 0, 0.14, 0.2, 0.2, 14)),
      { angle: 1.2, gap: c.px * 0.026, color: c.pal.ink, alpha: 0.16, weight: 0.3 })
  },

  chinCrease(c) {
    const f = c.head.frame(0, c.g.mouth.v - 0.28)
    if (f.facing < 0.1) return
    c.pen.stroke(f.poly(arc(0, 0, 0.14, 0.07, Math.PI + 0.3, Math.PI * 2 - 0.3, 0, 8)),
      { color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.6 })
  },
}

export const MARK_WEIGHTS: Weighted<string> = [
  ['blush', 14], ['freckles', 6], ['mole', 5], ['cheekLines', 5], ['wrinkles', 5],
  ['dimples', 4], ['scar', 2], ['whiskers', 2], ['noseShade', 1.5], ['chinCrease', 3],
]

export function drawMarks(c: FeatureContext): void {
  for (const m of c.g.marks) {
    const fn = marks[m.type]
    if (fn) fn(c, m)
  }
}
