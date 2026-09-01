/**
 * Point generators in *feature space* -- the little 2.5D coordinate system
 * each feature gets handed. x runs across the face, y down it, z out of it.
 * Nothing here knows about pixels; the frame does that translation.
 */

import type { Pt } from './types'
import type { Rng } from './rng'

export function oval(cx: number, cy: number, rx: number, ry: number,
  rot = 0, segments = 20, z = 0): Pt[] {
  const c = Math.cos(rot), s = Math.sin(rot)
  const pts: Pt[] = []
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const x = Math.cos(t) * rx, y = Math.sin(t) * ry
    pts.push([cx + x * c - y * s, cy + x * s + y * c, z])
  }

  return pts
}

export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number,
  rot = 0, segments = 14, z = 0): Pt[] {
  const c = Math.cos(rot), s = Math.sin(rot)
  const pts: Pt[] = []
  for (let i = 0; i <= segments; i++) {
    const t = a0 + ((a1 - a0) * i) / segments
    const x = Math.cos(t) * rx, y = Math.sin(t) * ry
    pts.push([cx + x * c - y * s, cy + x * s + y * c, z])
  }

  return pts
}

/** Catmull-Rom through control points, so a few keypoints become a curve. */
export function curve(ctrl: Pt[], samples = 6): Pt[] {
  if (ctrl.length < 3) return ctrl.slice()
  const pad = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]]
  const out: Pt[] = []
  for (let i = 1; i < pad.length - 2; i++) {
    const p0 = pad[i - 1], p1 = pad[i], p2 = pad[i + 1], p3 = pad[i + 2]
    for (let j = 0; j < samples; j++) {
      const t = j / samples, t2 = t * t, t3 = t2 * t
      const at = (a: number, b: number, c: number, d: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([
        at(p0[0], p1[0], p2[0], p3[0]),
        at(p0[1], p1[1], p2[1], p3[1]),
        at(p0[2] || 0, p1[2] || 0, p2[2] || 0, p3[2] || 0),
      ])
    }
  }
  out.push(ctrl[ctrl.length - 1])

  return out
}

export function spiral(cx: number, cy: number, r: number,
  turns = 2.4, segments = 40, z = 0): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const a = t * turns * Math.PI * 2
    const rr = r * (0.08 + 0.92 * t)
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z])
  }

  return pts
}

export function zigzag(x0: number, y0: number, x1: number, y1: number,
  teeth = 5, amp = 0.03): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= teeth * 2; i++) {
    const t = i / (teeth * 2)
    const s = i % 2 ? 1 : -1
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + s * amp])
  }

  return pts
}

/** Scalloped loop-de-loop edge -- curls, wool, cauliflower hair. */
export function loops(pts: Pt[], radius: number, rng: Rng | null, inward = -1): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    let tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    tx /= l; ty /= l
    const nx = ty * inward, ny = -tx * inward
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
    const r = radius * (rng ? rng.float(0.7, 1.3) : 1)
    out.push(a)
    for (let k = 1; k < 6; k++) {
      const t = (k / 6) * Math.PI
      out.push([
        mx + Math.cos(Math.PI - t) * (l / 2) + nx * Math.sin(t) * r,
        my + ny * Math.sin(t) * r,
      ])
    }
  }
  out.push(pts[pts.length - 1])

  return out
}

/** Reflect feature-space points across the face's midline. */
export function mirror(pts: Pt[]): Pt[] {
  return pts.map((p) => [-p[0], p[1], p[2] || 0])
}

export function offset(pts: Pt[], dx: number, dy: number, dz = 0): Pt[] {
  return pts.map((p) => [p[0] + dx, p[1] + dy, (p[2] || 0) + dz])
}

export function scalePts(pts: Pt[], sx: number, sy = sx, sz = 1): Pt[] {
  return pts.map((p) => [p[0] * sx, p[1] * sy, (p[2] || 0) * sz])
}
