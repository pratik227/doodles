/**
 * Eyes. The single biggest source of personality, so there are a lot of them,
 * and the genome is free to give each side a different one -- the reference
 * plates are full of faces with one saucer and one pinhole.
 */

import type { EyeSpec, FeatureContext, Frame, Weighted } from '../types'
import { arc, curve, spiral } from '../shapes'

/** Every eye is drawn in its own frame, at a radius `s`. */
export type EyeFn = (c: FeatureContext, f: Frame, s: number) => void

export const eyes: Record<string, EyeFn> = {
  dot(c, f, s) {
    c.dot(f, 0, 0, s * 0.52)
  },

  bead(c, f, s) {
    c.dot(f, 0, s * 0.1, s * 0.34)
    c.draw(f, arc(0, s * 0.1, s * 0.85, s * 0.7, Math.PI * 1.15, Math.PI * 1.9), { weight: 0.8, passes: 1 })
  },

  ring(c, f, s) {
    c.oval(f, 0, 0, s, s * c.rng.float(0.85, 1.1), c.rng.jitter(0.4), { weight: 0.9 })
    c.dot(f, s * c.rng.jitter(0.3), s * c.rng.jitter(0.3), s * 0.36)
  },

  saucer(c, f, s) {
    c.oval(f, 0, 0, s * 1.2, s * 1.15, 0, { weight: 1 })
    c.dot(f, s * c.rng.float(-0.4, 0.4), s * c.rng.float(-0.35, 0.3), s * 0.3)
  },

  pinhole(c, f, s) {
    c.oval(f, 0, 0, s * 1.15, s * 1.1, 0, { weight: 1, passes: 2 })
    c.oval(f, 0, 0, s * 0.92, s * 0.88, 0, { weight: 0.5, passes: 1, alpha: 0.6 })
    c.dot(f, 0, 0, s * 0.16)
  },

  blank(c, f, s) {
    c.oval(f, 0, 0, s * 1.1, s * 1.05, 0, { weight: 0.9 })
  },

  almond(c, f, s) {
    const up = arc(0, 0, s * 1.25, s * 0.8, Math.PI, Math.PI * 2, 0, 12)
    const dn = arc(0, 0, s * 1.25, s * 0.55, 0, Math.PI, 0, 12)
    c.draw(f, up.concat(dn.slice(1)), { closed: true, weight: 0.9 })
    c.dot(f, s * 0.05, 0, s * 0.33)
  },

  spiral(c, f, s) {
    c.draw(f, spiral(0, 0, s * 1.15, c.rng.float(1.9, 2.8), 44), { weight: 0.7, passes: 1, rough: 0.7 })
  },

  wink(c, f, s) {
    c.draw(f, arc(0, s * 0.3, s * 1.1, s * 0.75, Math.PI * 1.1, Math.PI * 1.95), { weight: 1.1 })
    if (c.rng.bool(0.5)) c.draw(f, [[-s * 1.2, s * 0.1], [-s * 1.5, s * -0.15]], { weight: 0.7, passes: 1 })
  },

  sleepy(c, f, s) {
    c.draw(f, arc(0, s * 0.15, s * 1.15, s * 0.55, Math.PI, Math.PI * 2, 0, 10), { weight: 1 })
    c.draw(f, arc(0, s * 0.15, s * 1.0, s * 0.5, 0.15, Math.PI - 0.15, 0, 8), { weight: 0.6, passes: 1 })
    c.dot(f, 0, s * 0.05, s * 0.22)
  },

  hooded(c, f, s) {
    c.oval(f, 0, s * 0.15, s, s * 0.9, 0, { weight: 0.9 })
    c.dot(f, 0, s * 0.25, s * 0.34)
    c.draw(f, arc(0, s * 0.1, s * 1.25, s * 1.0, Math.PI * 1.05, Math.PI * 1.95), { weight: 1.4 })
  },

  cross(c, f, s) {
    c.draw(f, [[-s, -s * 0.9], [s, s * 0.9]], { weight: 1.2 })
    c.draw(f, [[s, -s * 0.9], [-s, s * 0.9]], { weight: 1.2 })
  },

  lashes(c, f, s) {
    c.oval(f, 0, 0, s, s * 0.95, 0, { weight: 0.9 })
    c.dot(f, 0, 0, s * 0.4)
    for (let i = -1; i <= 1; i++) {
      const a = -Math.PI / 2 + i * 0.55
      c.draw(f, [
        [Math.cos(a) * s, Math.sin(a) * s * 0.95],
        [Math.cos(a) * s * 1.75, Math.sin(a) * s * 1.7],
      ], { weight: 0.6, passes: 1 })
    }
  },

  slit(c, f, s) {
    c.draw(f, curve([[-s * 1.3, s * 0.1], [0, -s * 0.15], [s * 1.3, s * 0.05]]), { weight: 1.1 })
    if (c.rng.bool(0.6)) c.dot(f, 0, -s * 0.02, s * 0.2)
  },

  bulge(c, f, s) {
    c.oval(f, 0, 0, s * 0.8, s * 1.35, c.rng.jitter(0.2), { weight: 0.9 })
    c.dot(f, 0, s * 0.55, s * 0.3)
  },

  boxy(c, f, s) {
    const w = s * 1.1, h = s * 0.85
    c.draw(f, [[-w, -h], [w, -h], [w, h], [-w, h]], { closed: true, weight: 0.9, rough: 1.3 })
    c.dot(f, s * c.rng.jitter(0.3), 0, s * 0.3)
  },

  spectacleEye(c, f, s) {
    c.oval(f, 0, 0, s * 0.55, s * 0.55, 0, { weight: 0.8 })
    c.dot(f, 0, 0, s * 0.2)
  },
}

export const EYE_TYPES = Object.keys(eyes)

/** Weighted so the plate stays readable but still surprises. */
export const EYE_WEIGHTS: Weighted<string> = [
  ['ring', 12], ['dot', 9], ['saucer', 7], ['almond', 6], ['bead', 6],
  ['pinhole', 5], ['blank', 4], ['sleepy', 4], ['hooded', 4], ['slit', 4],
  ['wink', 3], ['lashes', 3], ['bulge', 3], ['spiral', 2], ['cross', 1.2],
  ['boxy', 1.5], ['spectacleEye', 2],
]

export function drawEyes(c: FeatureContext): void {
  const g = c.g.eyes
  for (const side of [-1, 1]) {
    const spec: EyeSpec = side < 0 ? g.left : g.right
    const u = (g.u + g.skewU) * side
    const v = g.v + side * g.skewV
    const f = c.head.frame(u, v)
    if (f.facing < -0.12) continue               // gone round the back of the cheek
    // Mirror feature space on the left so asymmetric eyes read as a pair.
    const ef = side < 0 ? c.mirrorFrame(f) : f;
    (eyes[spec.type] || eyes.ring)(c, ef, spec.size)
    if (spec.bag) {
      c.draw(ef, arc(0, spec.size * 1.15, spec.size * 1.1, spec.size * 0.5, 0.25, Math.PI - 0.25),
        { weight: 0.5, passes: 1, alpha: 0.75 })
    }
  }
}
