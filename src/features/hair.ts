/**
 * Hair, in the round.
 *
 * A hairstyle is a cap region on the skull: a hairline drawn around the head
 * at some latitude, closed off by the skull's own outline. That means the
 * parting, the fringe and the crown all stay put when the head turns, and
 * volume (afros, spikes, buns) can push outside the silhouette.
 */

import { curve, loops, oval } from '../shapes'

import type { FeatureContext, Hairline, HairGenome, Point2, Pt, Vec3, Weighted } from '../types'

export type HairFn = (c: FeatureContext, g: HairGenome) => void

/** Outward unit vector at a screen point, relative to the head centre. */
function outward(p: Pt, centre: Pt): Point2 {
  const dx = p[0] - centre[0], dy = p[1] - centre[1]
  const l = Math.hypot(dx, dy) || 1

  return [dx / l, dy / l]
}

/**
 * Hairline shapes. theta runs around the skull with 0 at the *back*, so
 * `front` is what you want when you mean "over the brow".
 */
const front = (t: number): number => -Math.cos(t)

/** Combed to one side. Named because `sidePart` reaches for it directly. */
const tilted = (a: number): Hairline => (t, v) => v + a * Math.sin(t)

const LINE: Record<string, ((amp: number) => Hairline) | null> = {
  /** A level hairline projects to a dead-straight line head-on, so it is rare. */
  level: null,
  /** Dips under the jaw at the front, rides up onto the cheeks at the sides. */
  jaw: (a: number): Hairline => (t, v) => v - a * Math.max(0, front(t)),
  peak: (a: number): Hairline => (t, v) => v - a * front(t),                    // dips to a point over the brow
  receding: (a: number): Hairline => (t, v) => v + a * Math.max(0, front(t)),   // climbing the forehead
  m: (a: number): Hairline => (t, v) => v - a * Math.cos(2 * t),                // low centre, high temples
  tilted,               // combed to one side
  wavy: (a: number): Hairline => (t, v) => v + a * Math.sin(3 * t + 1),
}

export const hair: Record<string, HairFn> = {
  none() { },

  solid(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.008 })
    c.pen.blob(cap.poly, { color: g.color, rough: 1.1 })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.8, passes: 1, alpha: 0.8 })
  },

  helmet(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.02 })
    c.pen.blob(cap.poly, { color: g.color, rough: 1.2 })
    c.pen.stroke(cap.poly, { closed: true, color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.55 })
    const hi = c.head.cap({ v: g.v + 0.35, vAt: g.line, grow: 0.03, edgeOnly: true })
    c.pen.stroke(hi.edge, { color: '#ffffff', weight: 0.8, passes: 1, alpha: 0.16 })
  },

  hatched(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.008 })
    c.pen.hatch(cap.poly, { angle: g.hatchAngle, gap: c.px * 0.038, color: g.color, alpha: 0.9, weight: 0.6 })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.9, passes: 1 })
    c.pen.stroke(cap.crown, { color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.5 })
  },

  buzz(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.008 })
    c.pen.speckle(cap.poly, { count: Math.round(c.px * 1.1), color: g.color, len: c.px * 0.022, alpha: 0.85 })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.8, passes: 1, alpha: 0.85 })
  },

  bowl(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: null, grow: 0.01 })
    c.pen.blob(cap.poly, { color: g.color, rough: 0.7 })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 1.1, passes: 1, rough: 0.5 })
  },

  sidePart(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: tilted(0.13 * g.flip), grow: 0.01 })
    c.pen.hatch(cap.poly, { angle: 1.15 * g.flip, gap: c.px * 0.03, color: g.color, alpha: 0.95, weight: 0.55 })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.9, passes: 1 })
    // The parting itself: a meridian running back over the crown.
    const part: Point2[] = []
    for (let i = 0; i <= 8; i++) {
      const f = c.head.frame(0.55 * g.flip, g.v + 0.05 + (i / 8) * (1.35 - g.v))
      part.push(f.map(0, 0))
    }
    c.pen.stroke(part, { color: c.pal.ink, weight: 0.6, passes: 1, alpha: 0.7 })
  },

  fringe(c, g) {
    const cap = c.head.cap({ v: g.v + 0.1, vAt: g.line, grow: 0.01 })
    c.pen.blob(cap.poly, { color: g.color, rough: 1 })
    const edge = c.head.cap({ v: g.v + 0.1, vAt: g.line, grow: 0.02, edgeOnly: true })
    const n = edge.edge.length
    for (let i = 1; i < n - 1; i += 2) {
      const p = edge.edge[i]
      const o = outward(p, c.head.silhouette().center)
      const l = c.px * c.rng.float(0.1, 0.22)
      c.pen.stroke([p, [p[0] + o[0] * l * 0.3, p[1] + l]], { color: g.color, weight: 1.1, passes: 1 })
    }
    c.pen.stroke(edge.edge, { color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.6 })
  },

  curls(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.03 })
    const curly = loops(cap.poly.slice(cap.edgeLen), c.px * 0.075, c.rng, -1)
    const poly = cap.poly.slice(0, cap.edgeLen).concat(curly)
    if (g.filled) c.pen.blob(poly, { color: g.color, rough: 0.8 })
    c.pen.stroke(poly, { closed: true, color: g.filled ? c.pal.ink : g.color, weight: 0.7, passes: 1, rough: 0.8 })
    if (!g.filled) {
      for (let i = 0; i < 7; i++) {
        const f = c.head.frame(c.rng.float(-0.8, 0.8), g.v + c.rng.float(0.15, 0.75))
        if (f.facing < 0.1) continue
        const p = f.map(0, 0)
        c.pen.stroke(oval(p[0], p[1], c.px * 0.05, c.px * 0.04, c.rng.float(0, 3), 10),
          { closed: true, color: g.color, weight: 0.5, passes: 1, alpha: 0.9 })
      }
    }
  },

  afro(c, g) {
    const cap = c.head.cap({ v: g.v - 0.12, vAt: g.line, grow: g.volume })
    const centre = c.head.silhouette().center
    const puffed = cap.poly.slice(cap.edgeLen).map((p) => {
      const o = outward(p, centre)
      const k = c.px * c.rng.float(0.0, 0.09)

      return [p[0] + o[0] * k, p[1] + o[1] * k]
    })
    const poly = cap.poly.slice(0, cap.edgeLen).concat(loops(puffed, c.px * 0.06, c.rng, -1))
    if (g.filled) c.pen.blob(poly, { color: g.color, rough: 1.2 })
    c.pen.stroke(poly, { closed: true, color: g.filled ? c.pal.ink : g.color, weight: 0.6, passes: 1, alpha: 0.9, rough: 1.3 })
  },

  spikes(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.01 })
    if (g.filled) c.pen.blob(cap.poly, { color: g.color, rough: 1 })
    const centre = c.head.silhouette().center
    const crown = cap.poly.slice(cap.edgeLen)
    for (let i = 0; i < crown.length; i += 2) {
      const p = crown[i]
      const o = outward(p, centre)
      const l = c.px * c.rng.float(0.07, 0.2)
      const tilt = c.rng.jitter(0.4)
      c.pen.stroke([p, [p[0] + (o[0] + tilt) * l, p[1] + (o[1] - 0.2) * l]],
        { color: g.color, weight: 0.7, passes: 1 })
    }
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.8, passes: 1, alpha: 0.8 })
  },

  mohawk(c, g) {
    // A crest standing on the sagittal plane: sample the front-to-back
    // meridian and push it outward.
    const inner: Point2[] = [], outerPts: Point2[] = []
    const steps = 16
    for (let i = 0; i <= steps; i++) {
      const phi = 0.45 + (i / steps) * 2.1
      const d: Vec3 = [0, Math.sin(phi), Math.cos(phi)]
      const pin = c.head.project(c.head.local(d, 0, 0.01))
      const h = g.volume * (0.35 + 0.65 * Math.sin((i / steps) * Math.PI) ** 0.6)
      const pout = c.head.project(c.head.local(d, 0, h))
      inner.push([pin.x, pin.y])
      outerPts.push([pout.x, pout.y])
    }
    const poly = inner.concat(outerPts.slice().reverse())
    c.pen.blob(poly, { color: g.color, rough: 1.1 })
    c.pen.stroke(loops(outerPts, c.px * 0.03, c.rng, 1), { color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.6 })
    const cap = c.head.cap({ v: g.v + 0.15, edgeOnly: true })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.6, passes: 1, alpha: 0.5 })
  },

  bun(c, g) {
    const cap = c.head.cap({ v: g.v, vAt: g.line, grow: 0.008 })
    c.pen.blob(cap.poly, { color: g.color, rough: 1 })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.8, passes: 1, alpha: 0.8 })
    const f = c.head.frame(g.bunU, 1.15, 0.32)
    const p = f.map(0, 0)
    const r = c.px * g.bunSize
    c.pen.ellipse(p[0], p[1], r, r * 0.9, 0, { fill: g.color, weight: 0.7, rough: 1.4, segments: 14 })
    if (g.hatchBun) c.pen.hatch(oval(p[0], p[1], r, r * 0.9, 0, 14), { angle: 0.7, gap: c.px * 0.02, color: c.pal.ink, alpha: 0.35 })
  },

  topknot(c, g) {
    const f = c.head.frame(0, 1.25, 0.05)
    const base = f.map(0, 0)
    const tip = c.head.frame(0, 1.25, 0.45).map(0, 0)
    c.pen.stroke([base, tip], { color: g.color, weight: 1.6 })
    const r = c.px * g.bunSize * 0.85
    c.pen.ellipse(tip[0], tip[1] - r * 0.4, r, r * 0.8, 0, { fill: g.color, weight: 0.6, rough: 1.5, segments: 12 })
    const cap = c.head.cap({ v: g.v + 0.2, edgeOnly: true })
    c.pen.stroke(cap.edge, { color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.7 })
  },

  antenna(c, g) {
    const base = c.head.frame(g.bunU * 0.4, 1.2).map(0, 0)
    const pts: Pt[] = [base]
    let p: Pt = base
    for (let i = 0; i < 4; i++) {
      p = [p[0] + c.rng.jitter(c.px * 0.05), p[1] - c.px * 0.09]
      pts.push(p)
    }
    c.pen.stroke(curve(pts), { color: c.pal.ink, weight: 0.7, passes: 1 })
    c.pen.dot(p[0], p[1] - c.px * 0.02, c.px * 0.022, { color: c.pal.ink })
  },

  wisps(c, g) {
    const edge = c.head.cap({ v: g.v, vAt: g.line, grow: 0.01, edgeOnly: true })
    const centre = c.head.silhouette().center
    for (let i = 0; i < edge.edge.length; i += 2) {
      const p = edge.edge[i]
      const o = outward(p, centre)
      const l = c.px * c.rng.float(0.05, 0.16)
      c.pen.stroke([p, [p[0] + o[0] * l + c.rng.jitter(c.px * 0.03), p[1] + o[1] * l]],
        { color: g.color, weight: 0.55, passes: 1, alpha: 0.9 })
    }
  },

  sideTufts(c, g) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(1.05 * side, g.v - 0.25)
      if (f.facing < 0.05) continue
      const p = f.map(0, 0)
      for (let i = 0; i < 5; i++) {
        c.pen.stroke([
          [p[0], p[1] + i * c.px * 0.035],
          [p[0] + side * c.px * c.rng.float(0.08, 0.16), p[1] + i * c.px * 0.035 - c.px * 0.03],
        ], { color: g.color, weight: 0.6, passes: 1 })
      }
    }
  },
}

export const HAIR_WEIGHTS: Weighted<string> = [
  ['solid', 14], ['bowl', 9], ['hatched', 9], ['buzz', 7], ['helmet', 6],
  ['sidePart', 6], ['curls', 6], ['spikes', 5], ['fringe', 5], ['afro', 4],
  ['mohawk', 3.5], ['bun', 4], ['topknot', 3], ['wisps', 3], ['sideTufts', 2],
  ['antenna', 2], ['none', 5],
]

export { LINE as HAIRLINES }

export function drawHair(c: FeatureContext): void {
  const g = c.g.hair;
  (hair[g.type] || hair.solid)(c, g)
}
