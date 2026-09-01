/**
 * Headwear. Same trick as hair: everything is a band or cap wrapped around the
 * skull, so a beanie's brim stays level with the head when it tilts and the
 * pom-pom sits on the crown from any angle.
 */

import type { FeatureContext, HatGenome, Point2, Vec3, Weighted } from '../types'

export type HatFn = (c: FeatureContext, g: HatGenome) => void

interface Band {
  poly: Point2[]
  lower: Point2[]
  upper: Point2[]
}

interface BandOptions {
  v0: number
  v1: number
  grow?: number
  axis?: Vec3
  segments?: number
}

/** A filled band between two latitudes -- brims, headbands, bandanas. */
function band(c: FeatureContext, { v0, v1, grow = 0.03, axis = [0, 1, 0], segments = 72 }: BandOptions): Band | null {
  const lo = c.head.ring({ v: v0, grow, axis, segments })
  const hi = c.head.ring({ v: v1, grow, axis, segments })
  const vis: number[] = []
  for (let i = 0; i < lo.length; i++) if (lo[i].facing > 0.01 || hi[i].facing > 0.01) vis.push(i)
  if (vis.length < 3) return null
  // Contiguous forward-facing run, in order.
  let start = 0
  for (let i = 1; i < vis.length; i++) if (vis[i] !== vis[i - 1] + 1) {
    start = i; break
  }
  const ord = vis.slice(start).concat(vis.slice(0, start))
  const lower = ord.map((i) => lo[i].p)
  const upper = ord.map((i) => hi[i].p)

  return { poly: lower.concat(upper.reverse()), lower, upper: ord.map((i) => hi[i].p) }
}

export const hats: Record<string, HatFn> = {
  none() { },

  beanie(c, g) {
    const cap = c.head.cap({ v: g.v, grow: g.grow })
    c.pen.blob(cap.poly, { color: g.color, rough: 0.9 })
    c.pen.stroke(cap.poly, { closed: true, color: c.pal.ink, weight: 0.8, passes: 1 })
    // Ribbing: short strokes climbing away from the brim.
    const rib = c.head.cap({ v: g.v + 0.12, grow: g.grow, edgeOnly: true })
    c.pen.stroke(rib.edge, { color: c.pal.ink, weight: 0.7, passes: 1, alpha: 0.7 })
    if (g.ribs) {
      const e = cap.edge
      for (let i = 0; i < e.length; i += 3) {
        const a = e[i]
        const b = rib.edge[Math.min(rib.edge.length - 1, Math.round((i / e.length) * rib.edge.length))]
        if (b) c.pen.stroke([a, b], { color: c.pal.ink, weight: 0.45, passes: 1, alpha: 0.45 })
      }
    }
  },

  pom(c, g) {
    hats.beanie(c, g)
    const f = c.head.frame(0, 1.3, 0.12 + g.grow)
    const p = f.map(0, 0)
    const r = c.px * 0.11
    c.pen.ellipse(p[0], p[1] - r * 0.5, r, r * 0.95, 0, { fill: g.pomColor, weight: 0.7, rough: 1.6, segments: 14 })
  },

  headband(c, g) {
    const b = band(c, { v0: g.v, v1: g.v + g.width, grow: 0.035 })
    if (!b) return
    c.pen.blob(b.poly, { color: g.color, rough: 0.7 })
    c.pen.stroke(b.lower, { color: c.pal.ink, weight: 0.9, passes: 1 })
    c.pen.stroke(b.upper, { color: c.pal.ink, weight: 0.9, passes: 1 })
    if (g.pattern === 'stripe') {
      const mid = band(c, { v0: g.v + g.width * 0.5, v1: g.v + g.width * 0.55, grow: 0.04 })
      if (mid) c.pen.stroke(mid.lower, { color: c.pal.ink, weight: 0.6, passes: 1, alpha: 0.7 })
    } else if (g.pattern === 'zigzag') {
      const z = band(c, { v0: g.v + g.width * 0.5, v1: g.v + g.width * 0.5, grow: 0.045 })
      if (z) {
        const pts = z.lower.map((p, i) => [p[0], p[1] + (i % 2 ? -1 : 1) * c.px * 0.018])
        c.pen.stroke(pts, { color: c.pal.ink, weight: 0.5, passes: 1, alpha: 0.8, rough: 0.4 })
      }
    } else if (g.pattern === 'hatch') {
      c.pen.hatch(b.poly, { angle: 1.3, gap: c.px * 0.024, color: c.pal.ink, alpha: 0.4, weight: 0.4 })
    }
  },

  bandana(c, g) {
    hats.headband(c, g)
    const side = g.knotSide
    const f = c.head.frame(1.35 * side, g.v + g.width * 0.4)
    if (f.facing > -0.1) {
      const p = f.map(0, 0)
      c.pen.ellipse(p[0], p[1], c.px * 0.05, c.px * 0.045, 0, { fill: g.color, weight: 0.6, segments: 10 })
      for (let i = 0; i < 2; i++) {
        const t = [p[0] + side * c.px * c.rng.float(0.12, 0.22), p[1] + c.px * c.rng.float(0.1, 0.28)]
        c.pen.stroke([p, t], { color: g.color, weight: 1.4 })
        c.pen.stroke([p, t], { color: c.pal.ink, weight: 0.4, passes: 1, alpha: 0.5 })
      }
    }
  },

  flatCap(c, g) {
    const cap = c.head.cap({ v: g.v + 0.12, grow: g.grow })
    c.pen.blob(cap.poly, { color: g.color, rough: 0.8 })
    c.pen.hatch(cap.poly, { angle: -0.9, gap: c.px * 0.035, color: c.pal.ink, alpha: 0.28, weight: 0.4 })
    c.pen.stroke(cap.poly, { closed: true, color: c.pal.ink, weight: 0.8, passes: 1 })
    // Peak: a wedge sticking forward off the front of the band.
    const side = g.knotSide
    const a = c.head.frame(0.5 * side, g.v + 0.1, g.grow).map(0, 0)
    const b = c.head.frame(1.15 * side, g.v + 0.05, g.grow).map(0, 0)
    const tip = c.head.frame(0.95 * side, g.v - 0.02, g.grow + 0.3).map(0, 0)
    c.pen.stroke([a, tip, b], { closed: true, color: c.pal.ink, weight: 0.8, fill: g.color })
  },

  cone(c, g) {
    const baseRing = c.head.ring({ v: g.v, grow: 0.03 })
    const vis = baseRing.filter((r) => r.facing > 0)
    if (vis.length < 2) return
    const apex = c.head.frame(0, 1.35, g.height).map(0, 0)
    const lower = vis.map((r) => r.p)
    const poly = [apex].concat(lower)
    c.pen.blob(poly, { color: g.color, rough: 0.6 })
    c.pen.stroke([lower[0], apex, lower[lower.length - 1]], { color: c.pal.ink, weight: 0.9 })
    c.pen.stroke(lower, { color: c.pal.ink, weight: 0.8, passes: 1 })
    if (g.pomColor) c.pen.dot(apex[0], apex[1], c.px * 0.035, { color: g.pomColor })
  },

  bucket(c, g) {
    const cap = c.head.cap({ v: g.v + 0.2, grow: g.grow })
    c.pen.blob(cap.poly, { color: g.color, rough: 0.8 })
    c.pen.stroke(cap.poly, { closed: true, color: c.pal.ink, weight: 0.8, passes: 1 })
    const brim = band(c, { v0: g.v + 0.1, v1: g.v + 0.2, grow: g.grow + 0.16 })
    if (brim) {
      c.pen.blob(brim.poly, { color: g.color, rough: 0.6 })
      c.pen.stroke(brim.poly, { closed: true, color: c.pal.ink, weight: 0.8, passes: 1 })
    }
  },

  halo(c, g) {
    const r = c.head.ring({ v: 1.15, grow: 0.42, lift: 0.28 })
    c.pen.stroke(r.map((x) => x.p), {
      closed: true, color: g.color, weight: 0.8, passes: 2, alpha: 0.9,
    })
  },

  horns(c, g) {
    for (const side of [-1, 1]) {
      const f = c.head.frame(0.62 * side, 1.02)
      if (f.facing < 0.02) continue
      const b0 = f.map(-0.13, 0.05), b1 = f.map(0.13, 0.05)
      const tip = c.head.frame(0.72 * side, 1.1, 0.3).map(0, 0)
      c.pen.stroke([b0, tip, b1], { closed: true, color: c.pal.ink, weight: 0.7, fill: g.color })
    }
  },

  crown(c, g) {
    const b = band(c, { v0: g.v + 0.05, v1: g.v + 0.22, grow: 0.05 })
    if (!b) return
    const spikes: Point2[] = []
    const up = b.upper
    for (let i = 0; i < up.length - 1; i += 3) {
      spikes.push(up[i])
      const mid: Point2 = [(up[i][0] + up[Math.min(i + 2, up.length - 1)][0]) / 2, up[i][1] - c.px * 0.1]
      spikes.push(mid)
    }
    c.pen.stroke(b.lower.concat(spikes.reverse()), { closed: true, color: c.pal.ink, weight: 0.8, fill: g.color })
  },
}

export const HAT_WEIGHTS: Weighted<string> = [
  ['none', 30], ['headband', 12], ['beanie', 9], ['pom', 5], ['bandana', 5],
  ['flatCap', 5], ['cone', 1.6], ['bucket', 3], ['halo', 2], ['horns', 1.5],
  ['crown', 1],
]

export function drawHat(c: FeatureContext): void {
  const g = c.g.hat;
  (hats[g.type] || hats.none)(c, g)
}

export { band }
