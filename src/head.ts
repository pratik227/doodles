/**
 * The invisible head.
 *
 * A face is not drawn on a flat canvas. It is drawn on a lumpy ellipsoid that
 * happens to be invisible. Every feature owns a (u, v) coordinate on that
 * surface -- u = longitude (0 is dead ahead, + turns to screen right),
 * v = latitude (+ is up) -- and asks the head where that lands on screen.
 *
 * Rotate the head and the features come along for the ride: they slide, they
 * foreshorten, the far ear disappears behind the cheek, and the nose keeps
 * poking out along the surface normal because it was never flat to begin with.
 */

import type {
  Bounds,
  Cap,
  Frame,
  HeadOptions,
  Lobe,
  Mat3,
  Point2,
  Projection,
  Pt,
  RingOptions,
  RingPoint,
  Silhouette,
  Vec3,
  Wobble,
} from './types'
import {
  basisFor,
  cross,
  dot,
  matApply,
  matMul,
  norm3,
  rotX,
  rotY,
  rotZ,
} from './vec'

const UP: Vec3 = [0, 1, 0]

/** Longest contiguous run of true in a circular flag array. */
function longestRun(flags: boolean[]): number[] {
  const n = flags.length
  if (!flags.some(Boolean)) return []
  if (flags.every(Boolean)) return flags.map((_, i) => i)
  let best: number[] = [], run: number[] = []
  for (let k = 0; k < n * 2; k++) {
    const i = k % n
    if (flags[i]) {
      run.push(i)
      if (run.length > best.length && run.length <= n) best = run.slice()
    } else {
      run = []
    }
  }

  return best
}

export class Head {
  rx: number
  ry: number
  rz: number
  lobes: Lobe[]
  wobble: Wobble[]
  cx: number
  cy: number
  scale: number
  focal: number
  yaw = 0
  pitch = 0
  roll = 0
  R: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  private _cache: Map<string, Silhouette>

  constructor(opts: HeadOptions = {}) {
    this.rx = opts.rx ?? 1          // half-width
    this.ry = opts.ry ?? 1.12       // half-height
    this.rz = opts.rz ?? 0.9        // half-depth
    this.lobes = opts.lobes ?? []   // radial bulges: {dir, amp, power}
    this.wobble = opts.wobble ?? [] // hand-drawn outline drift: {dir, amp, freq, phase}
    this.cx = opts.cx ?? 0
    this.cy = opts.cy ?? 0
    this.scale = opts.scale ?? 100  // pixels per head radius
    this.focal = opts.focal ?? 7    // in head radii; larger = flatter
    this._cache = new Map()
    this.orient(opts.yaw ?? 0, opts.pitch ?? 0, opts.roll ?? 0)
  }

  orient(yaw = 0, pitch = 0, roll = 0): this {
    this.yaw = yaw
    this.pitch = pitch
    this.roll = roll
    this.R = matMul(rotZ(roll), matMul(rotX(pitch), rotY(yaw)))
    this._cache.clear()

    return this
  }

  // ---------------------------------------------------------------- geometry

  /** Unit sphere direction for a longitude/latitude pair. */
  dir(u: number, v: number): Vec3 {
    const cv = Math.cos(v)

    return [cv * Math.sin(u), Math.sin(v), cv * Math.cos(u)]
  }

  /** Radial multiplier from the lobes: this is what makes skulls pear-shaped. */
  bulge(d: Vec3): number {
    let r = 1
    for (const l of this.lobes) {
      const t = dot(d, l.dir)
      if (t > 0) r += l.amp * Math.pow(t, l.power)
    }

    return r
  }

  /** Smooth low-frequency drift, keyed to the *skull* so it rotates with it. */
  drift(d: Vec3): number {
    let w = 0
    for (const t of this.wobble) w += t.amp * Math.sin(t.freq * dot(d, t.dir) * Math.PI + t.phase)

    return w
  }

  /**
   * Surface point in head-local space. `lift` pushes out along the normal.
   * The drift is folded in here, not painted on the outline afterwards --
   * otherwise the ears end up floating half an inch off the head.
   */
  local(d: Vec3, lift = 0, grow = 0): Vec3 {
    const r = this.bulge(d) + this.drift(d) + grow
    const p: Vec3 = [d[0] * this.rx * r, d[1] * this.ry * r, d[2] * this.rz * r]
    if (lift) {
      const n = this.normal(d)
      p[0] += n[0] * lift; p[1] += n[1] * lift; p[2] += n[2] * lift
    }

    return p
  }

  normal(d: Vec3): Vec3 {
    return norm3([d[0] / this.rx, d[1] / this.ry, d[2] / this.rz])
  }

  /** Local point -> screen, with a gentle perspective divide. */
  project(p: Vec3): Projection {
    const P = matApply(this.R, p)
    const s = this.focal / Math.max(0.25, this.focal - P[2])

    return {
      x: this.cx + P[0] * s * this.scale,
      y: this.cy - P[1] * s * this.scale,
      z: P[2],
      s,
    }
  }

  // ------------------------------------------------------------------ frames

  /**
   * A local drawing frame glued to the skull at (u, v).
   *
   * `map(a, b, c)` takes feature-space coordinates -- a across the face,
   * b down the face, c out of the face -- and returns screen pixels. Draw a
   * feature once in that space and it behaves correctly from every angle.
   */
  frame(u: number, v: number, lift = 0): Frame {
    const d = this.dir(u, v)
    const pr = this.project(this.local(d, lift))

    const cv = Math.cos(v), sv = Math.sin(v), su = Math.sin(u), cu = Math.cos(u)
    // Tangents of the base ellipsoid: east (increasing u) and north (increasing v).
    const east = norm3([this.rx * cv * cu, 0, -this.rz * cv * su])
    const north = Math.abs(cv) < 1e-4
      ? norm3(cross(this.normal(d), east))
      : norm3([-this.rx * sv * su, this.ry * cv, -this.rz * sv * cu])

    const E = matApply(this.R, east)
    const N = matApply(this.R, north)
    const Nrm = matApply(this.R, this.normal(d))

    const k = this.scale * pr.s
    const o: Point2 = [pr.x, pr.y]
    const ex: Point2 = [E[0] * k, -E[1] * k]        // feature +x  (across, to screen right)
    const ey: Point2 = [-N[0] * k, N[1] * k]        // feature +y  (down the face)
    const ez: Point2 = [Nrm[0] * k, -Nrm[1] * k]    // feature +z  (out of the skin)

    const map = (a: number, b: number, c = 0): Point2 => [
      o[0] + a * ex[0] + b * ey[0] + c * ez[0],
      o[1] + a * ex[1] + b * ey[1] + c * ez[1],
    ]

    return {
      u, v, o, ex, ey, ez, map,
      poly: (pts: Pt[]) => pts.map((p) => map(p[0], p[1], p[2] || 0)),
      facing: Nrm[2],          // >0 means this patch of skin faces the viewer
      depth: pr.z,
      scale: k,
      /** How much horizontal room is left after foreshortening (0..1). */
      squash: Math.hypot(ex[0], ex[1]) / (this.scale * pr.s || 1),
    }
  }

  // -------------------------------------------------------------- silhouette

  /**
   * The occluding contour.
   *
   * The screen shadow of an ellipsoid is the image of the unit circle lying in
   * the plane perpendicular to the view-null direction, so the outline is exact
   * rather than sampled -- and because every contour point remembers which
   * skull direction produced it, the hand-drawn wobble stays welded to the
   * skull instead of swimming across the screen as the head turns.
   */
  silhouette(segments = 108, grow = 0): Silhouette {
    const key = `s${segments}:${grow}`
    const hit = this._cache.get(key)
    if (hit) return hit

    const S = [this.rx, this.ry, this.rz]
    const R = this.R
    // B = R * diag(S); rows 0 and 1 are what reaches the screen.
    const row0: Vec3 = [R[0] * S[0], R[1] * S[1], R[2] * S[2]]
    const row1: Vec3 = [R[3] * S[0], R[4] * S[1], R[5] * S[2]]
    const nullDir = norm3(cross(row0, row1))
    const [t1, t2] = basisFor(nullDir)

    const pts: Pt[] = [], dirs: Vec3[] = []
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      const ca = Math.cos(a), sa = Math.sin(a)
      const d = norm3([
        t1[0] * ca + t2[0] * sa,
        t1[1] * ca + t2[1] * sa,
        t1[2] * ca + t2[2] * sa,
      ])
      dirs.push(d)
      const pr = this.project(this.local(d, 0, grow))
      pts.push([pr.x, pr.y])
    }

    // Wind counter-clockwise in screen space so callers can trust the order.
    let area = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      area += a[0] * b[1] - b[0] * a[1]
    }
    if (area < 0) {
      pts.reverse(); dirs.reverse()
    }

    let cxs = 0, cys = 0
    for (const p of pts) {
      cxs += p[0]; cys += p[1]
    }
    cxs /= pts.length; cys /= pts.length

    const res: Silhouette = { pts, dirs, center: [cxs, cys], segments }
    this._cache.set(key, res)

    return res
  }

  /** Screen-space bounding box of the outline. */
  bounds(grow = 0): Bounds {
    const { pts } = this.silhouette(72, grow)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of pts) {
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }

    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
  }

  // --------------------------------------------------------------- lat rings

  /**
   * A latitude ring around the skull -- a hairline, a hatband, an eyepatch
   * strap. Only the forward-facing part is real; the rest is behind the head.
   * `vAt(theta)` lets a hairline dip and peak instead of running dead level.
   */
  ring({ v = 0.4, axis = UP, grow = 0, lift = 0, segments = 72, vAt = null }: RingOptions): RingPoint[] {
    const a = norm3(axis)
    const [t1, t2] = basisFor(a)
    const out: RingPoint[] = []
    for (let i = 0; i < segments; i++) {
      const th = (i / segments) * Math.PI * 2
      const vv = vAt ? vAt(th, v) : v
      const c = Math.sin(vv)
      const r = Math.sqrt(Math.max(0, 1 - c * c))
      const ct = Math.cos(th) * r, st = Math.sin(th) * r
      const d = norm3([
        a[0] * c + t1[0] * ct + t2[0] * st,
        a[1] * c + t1[1] * ct + t2[1] * st,
        a[2] * c + t1[2] * ct + t2[2] * st,
      ])
      const pr = this.project(this.local(d, lift, grow))
      const n = matApply(this.R, this.normal(d))
      out.push({ d, p: [pr.x, pr.y], facing: n[2], theta: th, z: pr.z })
    }

    return out
  }

  /**
   * A cap region: everything above (or below) a line drawn around the skull,
   * closed off by the skull's own outline. This is how hair, hats, beards and
   * masks get built -- front edge from the visible arc of the ring, back edge
   * from the silhouette -- so they wrap the head correctly at any angle.
   */
  cap(opts: RingOptions = {}): Cap {
    const { axis = UP, grow = 0, below = false, segments = 84 } = opts
    const a = norm3(axis)
    // `v` is signed: negative is below the equator. `below` only says which
    // side of that line to keep, so a beard at v = -0.3 keeps the chin.
    const v = opts.v ?? 0.4
    const ring = this.ring({ ...opts, v, axis: a, grow, segments })
    const visible = longestRun(ring.map((r) => r.facing > 0.015))
    const edge: Pt[] = visible.map((i) => ring[i].p)
    const dirs = visible.map((i) => ring[i].d)
    if (opts.edgeOnly) return { edge, dirs, ring, visible, edgeLen: edge.length, crown: [], poly: edge }

    const sil = this.silhouette(Math.max(96, segments), grow)
    if (edge.length < 2) {
      const keep = sil.dirs.map((d) => (below
        ? dot(d, a) < Math.sin(v)
        : dot(d, a) > Math.sin(v)))
      const idx = longestRun(keep)
      const crown = idx.length > 2 ? idx.map((i) => sil.pts[i]) : sil.pts

      return { edge, dirs, ring, visible, edgeLen: edge.length, crown, poly: crown }
    }

    // Walk the outline from the end of the hairline back to its start, taking
    // whichever way round goes over the crown (or under the chin).
    const nearest = (q: Pt) => {
      let best = 0, bd = Infinity
      for (let i = 0; i < sil.pts.length; i++) {
        const d2 = (sil.pts[i][0] - q[0]) ** 2 + (sil.pts[i][1] - q[1]) ** 2
        if (d2 < bd) {
          bd = d2; best = i
        }
      }

      return best
    }
    const i0 = nearest(edge[0])
    const i1 = nearest(edge[edge.length - 1])
    const n = sil.pts.length
    const walk = (from: number, to: number) => {
      const idx: number[] = []
      for (let k = 0; k <= n; k++) {
        const i = (from + k) % n
        idx.push(i)
        if (i === to) break
      }

      return idx
    }
    const A = walk(i1, i0), B = walk(i0, i1).slice().reverse()
    const score = (idx: number[]) => idx.reduce((acc, i) => acc + dot(sil.dirs[i], a), 0) / (idx.length || 1)
    const pick = (below ? score(A) < score(B) : score(A) > score(B)) ? A : B

    const crown = pick.map((i) => sil.pts[i])

    return { edge, dirs, ring, visible, edgeLen: edge.length, crown, poly: edge.concat(crown) }
  }

  /** Convenience: is a feature at (u,v) worth drawing at all? */
  visibleAt(u: number, v: number, threshold = 0.02): boolean {
    return this.frame(u, v).facing > threshold
  }
}

export default Head
