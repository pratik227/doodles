/**
 * Debug overlay: draw the invisible head, visibly.
 *
 * Latitude rings, meridians and every feature anchor, with the far side of the
 * skull dashed. Handy when a feature lands somewhere surprising, and the
 * fastest way to explain what this library actually does.
 */

import type { Genome, PathCmd, PathStyle, Point2, RingPoint, Surface, Vec3 } from './types'
import type { Head } from './head'

export interface RigOptions {
  rings?: number
  meridians?: number
  anchors?: boolean
}

const FRONT: PathStyle = { stroke: '#3f6f8f', width: 0.8, alpha: 0.5, cap: 'round' }
const BACK: PathStyle = { stroke: '#3f6f8f', width: 0.6, alpha: 0.18, cap: 'round', dash: '3 3' }

function runs(items: RingPoint[], test: (r: RingPoint) => boolean): Point2[][] {
  const out: Point2[][] = []
  let cur: Point2[] | null = null
  for (const it of items) {
    if (test(it)) {
      if (!cur) {
 cur = []; out.push(cur) 
}
      cur.push(it.p)
    } else cur = null
  }
  
return out
}

function poly(surface: Surface, pts: Point2[], style: PathStyle): void {
  if (pts.length < 2) return
  const cmds: PathCmd[] = [['M', pts[0][0], pts[0][1]]]
  for (let i = 1; i < pts.length; i++) cmds.push(['L', pts[i][0], pts[i][1]])
  surface.path(cmds, style)
}

export function drawRig(surface: Surface, head: Head, genome: Genome | null = null,
  opts: RigOptions = {}): void {
  const { rings = 7, meridians = 9, anchors = true } = opts

  // Latitude rings.
  for (let i = 1; i < rings; i++) {
    const v = -Math.PI / 2 + (i / rings) * Math.PI
    const ring = head.ring({ v, segments: 64 })
    for (const seg of runs(ring, (r) => r.facing > 0)) poly(surface, seg, FRONT)
    for (const seg of runs(ring, (r) => r.facing <= 0)) poly(surface, seg, BACK)
  }

  // Meridians, as rings about a sideways axis.
  for (let i = 0; i < meridians; i++) {
    const a = (i / meridians) * Math.PI
    const axis: Vec3 = [Math.cos(a), 0, Math.sin(a)]
    const ring = head.ring({ v: 0, axis, segments: 64 })
    for (const seg of runs(ring, (r) => r.facing > 0)) poly(surface, seg, FRONT)
    for (const seg of runs(ring, (r) => r.facing <= 0)) poly(surface, seg, BACK)
  }

  if (!anchors || !genome) return

  const g = genome
  const spots: [string, number, number][] = [
    ['eye', (g.eyes.u + g.eyes.skewU), g.eyes.v + g.eyes.skewV],
    ['eye', -(g.eyes.u + g.eyes.skewU), g.eyes.v - g.eyes.skewV],
    ['brow', g.eyes.u, g.brow.v],
    ['brow', -g.eyes.u, g.brow.v],
    ['nose', g.nose.u, g.nose.v],
    ['mouth', g.mouth.u, g.mouth.v],
    ['ear', g.ears.u, g.ears.v],
    ['ear', -g.ears.u, g.ears.v],
  ]

  for (const [, u, v] of spots) {
    const f = head.frame(u, v)
    const r = 2.6
    const front = f.facing > 0
    surface.path([
      ['M', f.o[0] - r, f.o[1]], ['L', f.o[0] + r, f.o[1]],
      ['M', f.o[0], f.o[1] - r], ['L', f.o[0], f.o[1] + r],
    ], { stroke: '#b4483f', width: 1, alpha: front ? 0.85 : 0.22, cap: 'round' })
    // The outward normal at that anchor -- this is the direction a nose grows.
    const tip = f.map(0, 0, 0.16)
    poly(surface, [f.o, tip], { stroke: '#b4483f', width: 0.7, alpha: front ? 0.5 : 0.12 })
  }

  // The hairline, as the ring it really is.
  const hair = head.ring({ v: g.hair.v, vAt: g.hair.line, segments: 64 })
  for (const seg of runs(hair, (r) => r.facing > 0)) poly(surface, seg, { stroke: '#6f8a5c', width: 1.2, alpha: 0.7 })
  for (const seg of runs(hair, (r) => r.facing <= 0)) poly(surface, seg, { stroke: '#6f8a5c', width: 0.8, alpha: 0.2, dash: '3 3' })
}

export default drawRig
