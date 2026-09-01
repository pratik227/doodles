/**
 * Beards and moustaches. Beards are lower caps -- the region of skull below a
 * line around the jaw -- so they follow the chin round as the head turns.
 */

import { curve, oval } from '../shapes'

import type { BeardGenome, FeatureContext, Pt, Weighted } from '../types'

export type BeardFn = (c: FeatureContext, g: BeardGenome) => void

export const facialHair: Record<string, BeardFn> = {
  none() { },

  moustacheOnly(c, g) {
    facialHair.moustache(c, g)
  },

  full(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, below: true, grow: 0.012 })
    if (g.filled) {
      c.pen.blob(cap.poly, { color: g.color, rough: 1.1 })
      c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.6 })
    } else {
      c.pen.hatch(cap.poly, { angle: g.hatchAngle, gap: c.px * 0.042, color: g.color, alpha: 0.7, weight: 0.5 })
      c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.8, passes: 1, alpha: 0.85 })
    }
    if (!g.deferMoustache) facialHair.moustache(c, g)
  },

  shaggy(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, below: true, grow: 0.02 })
    const centre = c.head.silhouette().center
    const skirt = cap.poly.slice(cap.edgeLen).map((p) => {
      const dx = p[0] - centre[0], dy = p[1] - centre[1]
      const l = Math.hypot(dx, dy) || 1
      const k = c.px * c.rng.float(0.02, 0.13)

      return [p[0] + (dx / l) * k, p[1] + (dy / l) * k * 1.4]
    })
    const poly = cap.poly.slice(0, cap.edgeLen).concat(skirt)
    if (g.filled) c.pen.blob(poly, { color: g.color, rough: 1.4 })
    c.pen.stroke(poly, { closed: true, color: g.filled ? c.pal.ink : g.color, weight: 0.6, passes: 1, rough: 1.6 })
    if (!g.deferMoustache) facialHair.moustache(c, g)
  },

  chinstrap(c, g) {
    const cap = c.head.cap({ v: g.v + 0.12, vAt: g.line, below: true, grow: 0.015 })
    c.pen.stroke(cap.edge, { color: g.color, weight: 1, passes: 2 })
    const inner = c.head.cap({ v: g.v - 0.14, vAt: g.line, below: true, grow: 0.015, edgeOnly: true })
    c.pen.stroke(inner.edge, { color: g.color, weight: 0.8, passes: 1, alpha: 0.9 })
  },

  stubble(c, g) {
    const cap = c.head.cap({ v: g.v + 0.1, vAt: g.line, below: true, grow: 0.01 })
    c.pen.speckle(cap.poly, { count: Math.round(c.px * 1.4), color: g.color, len: c.px * 0.016, alpha: 0.6 })
  },

  goatee(c, g) {
    const f = c.head.frame(0, g.v - 0.35)
    const pts = oval(0, 0, 0.16, 0.26, 0, 14)
    if (g.filled) c.pen.blob(f.poly(pts), { color: g.color, rough: 1.2 })
    else c.pen.hatch(f.poly(pts), { angle: 1.2, gap: c.px * 0.02, color: g.color, alpha: 0.8, weight: 0.4 })
    c.pen.stroke(f.poly(pts), { closed: true, color: c.pal.ink, weight: 0.6, passes: 1, alpha: 0.7 })
    if (!g.deferMoustache) facialHair.moustache(c, g)
  },

  chinTuft(c, g) {
    const f = c.head.frame(0, g.v - 0.42)
    for (let i = -2; i <= 2; i++) {
      c.pen.stroke(f.poly([[i * 0.05, -0.05], [i * 0.055 + c.rng.jitter(0.02), 0.2]]),
        { color: g.color, weight: 0.6, passes: 1 })
    }
  },

  long(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, below: true, grow: 0.012 })
    const chin = c.head.frame(0, -1.15)
    const tipY = c.px * g.length
    const c0 = cap.poly[cap.edgeLen] || cap.poly[0]
    const c1 = cap.poly[cap.poly.length - 1] || cap.poly[0]
    const base = chin.map(0, 0)
    const hang = curve([c0 as Pt, [base[0] - c.px * 0.12, base[1] + tipY * 0.5], [base[0] + c.rng.jitter(c.px * 0.1), base[1] + tipY], [base[0] + c.px * 0.12, base[1] + tipY * 0.5], c1])
    const poly = cap.poly.slice(0, cap.edgeLen).concat(hang)
    if (g.filled) c.pen.blob(poly, { color: g.color, rough: 1.2 })
    else c.pen.hatch(poly, { angle: 1.4, gap: c.px * 0.03, color: g.color, alpha: 0.8, weight: 0.5 })
    c.pen.stroke(poly, { closed: true, color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.8 })
    if (!g.deferMoustache) facialHair.moustache(c, g)
  },

  sideburns(c, g) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(1.15 * side, 0.05)
      if (f.facing < 0.03) continue
      const pts: Pt[] = [[0, -0.2], [0.1, 0.05], [0.02, 0.42], [-0.14, 0.3], [-0.16, -0.15]]
      c.pen.blob(f.poly(pts), { color: g.color, rough: 1.3, alpha: 0.95 })
    }
  },

  moustache(c, g) {
    if (g.moustache === 'none') return
    const f = c.head.frame(0, c.g.mouth.v + 0.14)
    const s = g.moustacheSize
    if (g.moustache === 'pencil') {
      c.pen.stroke(f.poly(curve([[-s, 0], [0, 0.06], [s, 0]])), { color: g.color, weight: 1.3 })
    } else if (g.moustache === 'handlebar') {
      c.pen.stroke(f.poly(curve([[-s * 1.2, -0.12], [-s * 0.5, 0.08], [0, 0.02], [s * 0.5, 0.08], [s * 1.2, -0.12]])),
        { color: g.color, weight: 1.5 })
    } else if (g.moustache === 'bushy') {
      const pts: Pt[] = [[-s * 1.1, -0.06], [-s * 0.4, -0.13], [0, -0.05], [s * 0.4, -0.13], [s * 1.1, -0.06],
      [s * 0.9, 0.14], [0, 0.1], [-s * 0.9, 0.14]]
      if (g.filled) c.pen.blob(f.poly(pts), { color: g.color, rough: 1.1 })
      else c.pen.hatch(f.poly(pts), { angle: 0.2, gap: c.px * 0.018, color: g.color, alpha: 0.9, weight: 0.4 })
      c.pen.stroke(f.poly(pts), { closed: true, color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.6 })
    } else if (g.moustache === 'toothbrush') {
      const pts: Pt[] = [[-s * 0.35, -0.08], [s * 0.35, -0.08], [s * 0.35, 0.1], [-s * 0.35, 0.1]]
      c.pen.blob(f.poly(pts), { color: g.color, rough: 0.9 })
    } else if (g.moustache === 'droopy') {
      c.pen.stroke(f.poly(curve([[-s, -0.05], [-s * 0.3, 0.05], [0, 0], [s * 0.3, 0.05], [s, -0.05]])),
        { color: g.color, weight: 1.2 })
      c.pen.stroke(f.poly([[-s, -0.05], [-s * 1.05, 0.28]]), { color: g.color, weight: 1 })
      c.pen.stroke(f.poly([[s, -0.05], [s * 1.05, 0.28]]), { color: g.color, weight: 1 })
    }
  },
}

export const BEARD_WEIGHTS: Weighted<string> = [
  ['none', 34], ['stubble', 8], ['full', 8], ['goatee', 6], ['chinstrap', 5],
  ['shaggy', 5], ['moustache', 7], ['sideburns', 3], ['chinTuft', 3], ['long', 2.5],
]

export const MOUSTACHE_WEIGHTS: Weighted<string> = [
  ['none', 10], ['bushy', 6], ['pencil', 4], ['handlebar', 3], ['droopy', 3], ['toothbrush', 2],
]

/** The beard mass. The moustache comes later, on top of the mouth. */
export function drawBeard(c: FeatureContext): void {
  const g = c.g.beard
  if (g.type === 'moustacheOnly') return;
  (facialHair[g.type] || facialHair.none)(c, { ...g, deferMoustache: true })
}

export function drawMoustache(c: FeatureContext): void {
  facialHair.moustache(c, c.g.beard)
}

export function drawFacialHair(c: FeatureContext): void {
  const g = c.g.beard;
  (facialHair[g.type] || facialHair.none)(c, g)
}
