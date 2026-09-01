/** Mouths, brows and ears -- the supporting cast. */

import type { FeatureContext, Frame, Pt, Weighted } from '../types'
import { arc, curve, oval, zigzag } from '../shapes'

export type AnchoredFn = (c: FeatureContext, f: Frame, s: number) => void

export const mouths: Record<string, AnchoredFn> = {
  line(c, f, s) {
    c.draw(f, [[-s, c.rng.jitter(s * 0.1)], [s, c.rng.jitter(s * 0.1)]], { weight: 1.1, bow: c.rng.jitter(1) })
  },

  dash(c, f, s) {
    c.draw(f, [[-s * 0.45, 0], [s * 0.45, 0]], { weight: 1.5 })
  },

  smile(c, f, s) {
    c.draw(f, arc(0, -s * 0.35, s, s * 0.65, 0.25, Math.PI - 0.25), { weight: 1.1 })
  },

  frown(c, f, s) {
    c.draw(f, arc(0, s * 0.45, s * 0.9, s * 0.55, Math.PI + 0.3, Math.PI * 2 - 0.3), { weight: 1.1 })
  },

  wave(c, f, s) {
    c.draw(f, curve([[-s, 0], [-s * 0.35, -s * 0.28], [s * 0.35, s * 0.22], [s, -s * 0.05]]), { weight: 1.05 })
  },

  smirk(c, f, s) {
    const d = c.rng.sign()
    c.draw(f, curve([[-s * 0.9, s * 0.12 * d], [0, 0], [s * 0.9, -s * 0.3 * d]]), { weight: 1.1 })
  },

  oh(c, f, s) {
    c.oval(f, 0, 0, s * 0.3, s * 0.34, 0, { weight: 1 })
  },

  gasp(c, f, s) {
    c.oval(f, 0, s * 0.08, s * 0.34, s * 0.44, 0, { weight: 1, fill: c.pal.ink, fillAlpha: 0.88 })
  },

  grin(c, f, s) {
    c.draw(f, arc(0, -s * 0.5, s * 1.05, s * 0.9, 0.2, Math.PI - 0.2), { weight: 1.1 })
    c.draw(f, [[-s * 0.95, s * 0.02], [s * 0.95, s * 0.02]], { weight: 0.8 })
  },

  teeth(c, f, s) {
    const w = s * 0.9, h = s * 0.42
    c.draw(f, [[-w, -h], [w, -h], [w, h], [-w, h]], { closed: true, weight: 0.9 })
    for (let i = -2; i <= 2; i++) {
      c.draw(f, [[(i * w) / 2.6, -h], [(i * w) / 2.6, h]], { weight: 0.5, passes: 1, alpha: 0.8 })
    }
  },

  gritted(c, f, s) {
    c.draw(f, zigzag(-s, 0, s, 0, 5, s * 0.22), { weight: 0.9, rough: 0.8 })
  },

  pursed(c, f, s) {
    c.dot(f, 0, 0, s * 0.22)
    c.draw(f, [[-s * 0.5, -s * 0.1], [-s * 0.25, 0]], { weight: 0.6, passes: 1 })
    c.draw(f, [[s * 0.5, -s * 0.1], [s * 0.25, 0]], { weight: 0.6, passes: 1 })
  },

  pout(c, f, s) {
    c.draw(f, arc(0, -s * 0.1, s * 0.5, s * 0.3, Math.PI, Math.PI * 2), { weight: 1 })
    c.draw(f, arc(0, s * 0.05, s * 0.55, s * 0.35, 0, Math.PI), { weight: 1 })
  },

  wideThin(c, f, s) {
    c.draw(f, [[-s * 1.25, 0], [s * 1.25, s * 0.06]], { weight: 1 })
    c.draw(f, [[-s * 1.25, 0], [-s * 1.05, -s * 0.22]], { weight: 0.7, passes: 1 })
    c.draw(f, [[s * 1.25, s * 0.06], [s * 1.05, -s * 0.18]], { weight: 0.7, passes: 1 })
  },

  tongue(c, f, s) {
    c.draw(f, arc(0, -s * 0.3, s * 0.8, s * 0.6, 0.2, Math.PI - 0.2), { weight: 1.1 })
    const t = oval(c.rng.jitter(s * 0.15), s * 0.6, s * 0.22, s * 0.4, 0, 14)
    c.draw(f, t, { closed: true, weight: 0.9, fill: c.pal.accent.pink, fillAlpha: 0.85 })
  },

  cigarette(c, f, s) {
    c.draw(f, [[-s * 0.8, 0], [s * 0.5, s * 0.05]], { weight: 1 })
    const side = c.rng.sign()
    const a = [s * 0.5 * side, s * 0.05]
    const b = [s * 1.9 * side, s * 0.45]
    c.draw(f, [a, b], { weight: 1.3, color: c.pal.ink })
    c.draw(f, [[a[0], a[1] - s * 0.12], [b[0], b[1] - s * 0.12]], { weight: 0.5, passes: 1, alpha: 0.5 })
    c.dot(f, b[0], b[1], s * 0.09, { color: c.pal.accent.red })
    let p: Pt = [b[0], b[1] - s * 0.3]
    const smoke: Pt[] = [p]
    for (let i = 0; i < 5; i++) {
      p = [p[0] + c.rng.float(-0.25, 0.35) * s * side, p[1] - s * 0.45]
      smoke.push(p)
    }
    c.draw(f, curve(smoke), { weight: 0.5, passes: 1, alpha: 0.4 })
  },
}

export const MOUTH_WEIGHTS: Weighted<string> = [
  ['line', 11], ['smile', 9], ['wave', 7], ['smirk', 7], ['dash', 6],
  ['frown', 6], ['oh', 5], ['grin', 5], ['wideThin', 5], ['pursed', 4],
  ['teeth', 3], ['gasp', 3], ['pout', 3], ['gritted', 2.5], ['tongue', 2.5],
  ['cigarette', 2.5],
]

export function drawMouth(c: FeatureContext): void {
  const g = c.g.mouth
  const f = c.head.frame(g.u, g.v)
  if (f.facing < -0.1) return
  const b = c.g.beard
  if (b.filled && b.v > g.v && ['full', 'shaggy', 'long'].includes(b.type)) {
    c.fill(f, oval(0, 0, g.size * 1.15, g.size * 0.62, 0, 16),
      { color: c.pal.skin || c.pal.paper, rough: 1.5 })
  }
  (mouths[g.type] || mouths.line)(c, f, g.size)
}

// ------------------------------------------------------------------- brows

export const brows: Record<string, AnchoredFn> = {
  bar(c, f, s) {
    c.draw(f, [[-s, 0], [s, c.rng.jitter(s * 0.12)]], { weight: 1.6 })
  },
  thin(c, f, s) {
    c.draw(f, [[-s, 0], [s, 0]], { weight: 0.7, passes: 1 })
  },
  arch(c, f, s) {
    c.draw(f, arc(0, s * 0.35, s, s * 0.5, Math.PI + 0.15, Math.PI * 2 - 0.15), { weight: 1.2 })
  },
  angry(c, f, s) {
    c.draw(f, [[-s, -s * 0.3], [s, s * 0.3]], { weight: 1.7 })
  },
  sad(c, f, s) {
    c.draw(f, [[-s, s * 0.3], [s, -s * 0.28]], { weight: 1.4 })
  },
  wavy(c, f, s) {
    c.draw(f, curve([[-s, 0], [-s * 0.3, -s * 0.3], [s * 0.3, s * 0.15], [s, -s * 0.1]]), { weight: 1.1 })
  },
  thick(c, f, s) {
    const pts: Pt[] = [[-s, -s * 0.07], [0, -s * 0.15], [s, -s * 0.02], [s, s * 0.09], [0, s * 0.02], [-s, s * 0.1]]
    c.draw(f, pts, { closed: true, weight: 0.7, fill: c.pal.hair, fillAlpha: 0.95 })
  },
  bushy(c, f, s) {
    const pts: Pt[] = [[-s, -s * 0.09], [0, -s * 0.2], [s, -s * 0.05], [s * 0.9, s * 0.14], [0, s * 0.04], [-s, s * 0.14]]
    c.hatch(f, pts, { angle: -1.1, gap: c.px * 0.028, alpha: 0.85 })
    c.draw(f, pts, { closed: true, weight: 0.6, passes: 1, alpha: 0.7 })
  },
  tufts(c, f, s) {
    for (let i = 0; i < 6; i++) {
      const x = -s + (2 * s * i) / 5
      c.draw(f, [[x, s * 0.15], [x + c.rng.jitter(0.2) * s, -s * 0.45]], { weight: 0.6, passes: 1 })
    }
  },
}

export const BROW_WEIGHTS: Weighted<string> = [
  ['bar', 10], ['thin', 7], ['arch', 7], ['thick', 7], ['angry', 6],
  ['wavy', 5], ['sad', 4], ['bushy', 4], ['tufts', 3], ['none', 5],
]

export function drawBrows(c: FeatureContext): void {
  const g = c.g.brow
  if (g.type === 'none') return
  if (g.uni) {
    const f = c.head.frame(0, g.v)
    const s = g.size * 2.3
    c.draw(f, curve([[-s, g.size * 0.1], [0, -g.size * 0.25], [s, g.size * 0.05]]), { weight: 1.8 })

    return
  }
  for (const side of [-1, 1]) {
    const f = c.head.frame(c.g.eyes.u * side, g.v + (side < 0 ? g.lift : -g.lift))
    if (f.facing < -0.05) continue
    const bf = side < 0 ? c.mirrorFrame(f) : f;
    (brows[g.type] || brows.bar)(c, bf, g.size * (side < 0 ? g.asym : 1))
  }
}

// -------------------------------------------------------------------- ears

export const ears: Record<string, AnchoredFn> = {
  c(c, f, s) {
    c.draw(f, arc(0, 0, s * 0.55, s, -Math.PI * 0.42, Math.PI * 0.42, 0, 12, s * 0.12), { weight: 0.9 })
  },
  jug(c, f, s) {
    c.draw(f, arc(0, 0, s * 0.95, s * 1.15, -Math.PI * 0.5, Math.PI * 0.5, 0, 14, s * 0.2), { weight: 1 })
  },
  dot(c, f, s) {
    c.dot(f, 0, 0, s * 0.3, { z: s * 0.1 })
  },
  pointy(c, f, s) {
    c.draw(f, [[0, -s], [s * 0.8, -s * 0.2, s * 0.15], [0, s * 0.7]], { weight: 0.9 })
  },
  curl(c, f, s) {
    c.draw(f, arc(0, 0, s * 0.7, s * 1.05, -Math.PI * 0.45, Math.PI * 0.45, 0, 12, s * 0.14), { weight: 0.9 })
    c.draw(f, arc(0, 0, s * 0.3, s * 0.5, -Math.PI * 0.4, Math.PI * 0.5, 0, 8, s * 0.08), { weight: 0.5, passes: 1 })
  },
}

export const EAR_WEIGHTS: Weighted<string> = [['c', 10], ['jug', 6], ['dot', 4], ['curl', 5], ['pointy', 2], ['none', 3.5]]

export function drawEars(c: FeatureContext): void {
  const g = c.g.ears
  if (g.type === 'none') return
  for (const side of [-1, 1]) {
    const f = c.head.frame(g.u * side, g.v)
    if (f.facing < 0.06) continue                 // behind the cheek now
    const eb = c.earFrame(f)
    const ef = side < 0 ? c.mirrorFrame(eb) : eb;
    (ears[g.type] || ears.c)(c, ef, g.size)
    if (g.earring) {
      c.dot(ef, 0, g.size * 1.05, g.size * 0.16, { color: g.earringColor })
    }
  }
}
