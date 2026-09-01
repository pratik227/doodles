/**
 * The wash behind the head. In the reference plates these are loose
 * watercolour or pencil patches -- circles, torn rectangles, scribbled stars --
 * that sit slightly off-register from the drawing, which is most of the charm.
 */

import { curve, oval } from '../shapes'

import type { BackdropGenome, FeatureContext, Pt, Weighted } from '../types'
import type { Head } from '../head'

export type BackdropFn = (c: FeatureContext, g: BackdropGenome) => void

interface Box {
  cx: number
  cy: number
  rx: number
  ry: number
}

function bbox(head: Head, pad: number): Box {
  const b = head.bounds()
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2

  return { cx, cy, rx: (b.w / 2) * pad, ry: (b.h / 2) * pad }
}

export const backdrops: Record<string, BackdropFn> = {
  none() { },

  circle(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const r = Math.max(rx, ry) * 1.0
    const pts = oval(cx + g.dx, cy + g.dy, r, r * c.rng.float(0.94, 1.06), 0, 26)
    c.pen.blob(pts, { color: g.color, alpha: g.alpha, rough: 1.6, step: 1.6 })
  },

  disc(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const r = Math.max(rx, ry)
    c.pen.blob(oval(cx + g.dx, cy + g.dy, r * 1.04, r * 0.98, 0, 26), { color: g.color, alpha: g.alpha * 0.6, rough: 2 })
    c.pen.blob(oval(cx + g.dx * 1.6, cy + g.dy * 1.6, r * 0.86, r * 0.9, 0, 26), { color: g.color, alpha: g.alpha * 0.7, rough: 2.2 })
  },

  roundSquare(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const k = 0.62
    const pts = curve([
      [cx - rx, cy - ry * k], [cx - rx * k, cy - ry], [cx + rx * k, cy - ry], [cx + rx, cy - ry * k],
      [cx + rx, cy + ry * k], [cx + rx * k, cy + ry], [cx - rx * k, cy + ry], [cx - rx, cy + ry * k],
      [cx - rx, cy - ry * k],
    ], 5).map((p) => [p[0] + g.dx, p[1] + g.dy])
    c.pen.blob(pts, { color: g.color, alpha: g.alpha, rough: 1.4 })
  },

  rect(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad * 0.92)
    const rot = g.rot
    const co = Math.cos(rot), si = Math.sin(rot)
    const corners = [[-rx, -ry * 1.15], [rx, -ry * 1.15], [rx, ry * 1.15], [-rx, ry * 1.15]]
      .map(([x, y]) => [cx + g.dx + x * co - y * si, cy + g.dy + x * si + y * co])
    c.pen.blob(corners, { color: g.color, alpha: g.alpha, rough: 1.1, step: 2 })
  },

  star(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const pts: Pt[] = []
    const spikes = g.spikes
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
      const k = i % 2 ? 0.72 : 1.12
      pts.push([cx + g.dx + Math.cos(a) * rx * k, cy + g.dy + Math.sin(a) * ry * k])
    }
    c.pen.blob(curve(pts.concat([pts[0]]), 4), { color: g.color, alpha: g.alpha, rough: 1.5 })
  },

  ringOutline(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const r = Math.max(rx, ry)
    c.pen.stroke(oval(cx + g.dx, cy + g.dy, r, r * c.rng.float(0.95, 1.05), 0, 30),
      { closed: true, color: g.color, weight: 1.4, passes: 2, alpha: 0.95, rough: 1.3 })
  },

  doubleRing(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const r = Math.max(rx, ry)
    for (let i = 0; i < 2; i++) {
      c.pen.stroke(oval(cx + g.dx + c.rng.jitter(3), cy + g.dy + c.rng.jitter(3), r * (1 - i * 0.07), r * (0.98 - i * 0.07), 0, 30),
        { closed: true, color: g.color, weight: 1, passes: 1, alpha: 0.9, rough: 1.5 })
    }
  },

  hatchPatch(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const pts = oval(cx + g.dx, cy + g.dy, rx * 1.05, ry * 1.05, 0, 24)
    c.pen.hatch(pts, { angle: g.rot, gap: c.px * 0.042, color: g.color, alpha: 0.55, weight: 0.6, jitterGap: 0.6 })
  },

  scribble(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    c.pen.scribble(oval(cx + g.dx, cy + g.dy, rx, ry, 0, 24), { color: g.color, alpha: 0.5, weight: 0.7, loops: 30 })
  },

  torn(c, g) {
    const { cx, cy, rx, ry } = bbox(c.head, g.pad)
    const pts: Pt[] = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const k = 1 + c.rng.jitter(0.09)
      pts.push([cx + g.dx + Math.cos(a) * rx * k, cy + g.dy + Math.sin(a) * ry * k])
    }
    c.pen.blob(pts, { color: g.color, alpha: g.alpha, rough: 0.6, step: 2.4 })
  },
}

export const BACKDROP_WEIGHTS: Weighted<string> = [
  ['none', 16], ['circle', 20], ['disc', 8], ['roundSquare', 7], ['rect', 5],
  ['hatchPatch', 7], ['ringOutline', 6], ['doubleRing', 4], ['torn', 6],
  ['star', 2.5], ['scribble', 3],
]

export function drawBackdrop(c: FeatureContext): void {
  const g = c.g.backdrop;
  (backdrops[g.type] || backdrops.none)(c, g)
}
