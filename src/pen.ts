/**
 * The hand.
 *
 * Everything here exists to stop lines looking like they came out of a
 * computer: strokes are resampled, pushed around by a smooth random walk,
 * bowed slightly the way a wrist bows, drawn twice with different pressure,
 * and overshot at the ends.
 */

import type {
  BlobOptions,
  DotOptions,
  EllipseOptions,
  HatchOptions,
  PathCmd,
  Point2,
  Pt,
  ScribbleOptions,
  SpeckleOptions,
  StrokeOptions,
  Surface,
} from './types'

import type { Rng } from './rng'

export interface PenOptions {
  /** Pixels per head radius. */
  px?: number
  ink?: string
  rough?: number
  width?: number
}

function mid(a: Pt, b: Pt): Point2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function resample(pts: Pt[], step: number): Pt[] {
  const clean: Pt[] = []
  for (const p of pts) {
    const last = clean[clean.length - 1]
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-7) clean.push(p)
  }
  if (clean.length < 2) return clean
  const out: Pt[] = [clean[0].slice()]
  let acc = 0
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1], b = clean[i]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 1e-9) continue
    let t = step - acc
    while (t <= L) {
      out.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L])
      t += step
    }
    acc = (acc + L) % step
  }
  const last = clean[clean.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.35) out.push(last.slice())

  return out
}

/** Quadratic through midpoints: smooth, no visible corners. */
function smooth(pts: Pt[], closed = false): PathCmd[] {
  const n = pts.length
  if (n === 0) return []
  if (n === 1) return [['M', pts[0][0], pts[0][1]]]
  if (n === 2) return [['M', pts[0][0], pts[0][1]], ['L', pts[1][0], pts[1][1]]]
  const cmds: PathCmd[] = []
  if (closed) {
    const m0 = mid(pts[n - 1], pts[0])
    cmds.push(['M', m0[0], m0[1]])
    for (let i = 0; i < n; i++) {
      const p = pts[i], m = mid(p, pts[(i + 1) % n])
      cmds.push(['Q', p[0], p[1], m[0], m[1]])
    }
    cmds.push(['Z'])
  } else {
    cmds.push(['M', pts[0][0], pts[0][1]])
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1])
      cmds.push(['Q', pts[i][0], pts[i][1], m[0], m[1]])
    }
    cmds.push(['L', pts[n - 1][0], pts[n - 1][1]])
  }

  return cmds
}

export class Pen {
  s: Surface
  rng: Rng
  px: number
  ink: string
  rough: number
  width: number
  step: number

  constructor(surface: Surface, rng: Rng, opts: PenOptions = {}) {
    this.s = surface
    this.rng = rng
    this.px = opts.px ?? 100               // pixels per head radius
    this.ink = opts.ink ?? '#2a2622'
    this.rough = opts.rough ?? 1
    this.width = opts.width ?? (0.55 + this.px * 0.014)
    this.step = Math.max(2.5, this.px * 0.055)
  }

  /** Ink width for a relative weight, never thinner than a real nib. */
  w(mult = 1): number {
    return Math.max(0.55, this.width * mult)
  }

  // ---------------------------------------------------------------- shaping

  /**
   * Push a polyline around: a smooth AR(1) walk perpendicular to the line,
   * plus a single slow bow across the whole stroke.
   */
  private _waver(pts: Pt[], amp: number, bow = 0): Pt[] {
    const n = pts.length
    if (n < 2) return pts
    const r = this.rng
    const out: Pt[] = new Array(n)
    let w = r.gauss(0, 0.4)
    for (let i = 0; i < n; i++) {
      w = w * 0.68 + r.gauss(0, 0.55)
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)]
      let tx = next[0] - prev[0], ty = next[1] - prev[1]
      const l = Math.hypot(tx, ty) || 1
      tx /= l; ty /= l
      const t = n > 1 ? i / (n - 1) : 0
      const d = w * amp + Math.sin(t * Math.PI) * bow
      out[i] = [pts[i][0] - ty * d, pts[i][1] + tx * d]
    }

    return out
  }

  /** Let an open stroke run past its endpoints, like a real pen does. */
  private _overshoot(pts: Pt[], amount: number): Pt[] {
    if (pts.length < 2 || amount <= 0) return pts
    const ext = (a: Pt, b: Pt, k: number): Point2 => {
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const l = Math.hypot(dx, dy) || 1

      return [b[0] + (dx / l) * k, b[1] + (dy / l) * k]
    }
    const out = pts.slice()
    const r = this.rng
    if (r.bool(0.7)) out.unshift(ext(pts[1], pts[0], amount * r.float(0.2, 1)))
    if (r.bool(0.7)) out.push(ext(pts[pts.length - 2], pts[pts.length - 1], amount * r.float(0.2, 1)))

    return out
  }

  // ----------------------------------------------------------------- strokes

  /**
   * The workhorse. Draws a sketchy line through `pts`.
   * passes: 2 gives the doubled-over ink look; 1 is a light single trace.
   */
  stroke(pts: Pt[] | null | undefined, o: StrokeOptions = {}): void {
    if (!pts || pts.length < 2) return
    const {
      closed = false, color = this.ink, alpha = 1, weight = 1,
      passes = 2, rough = 1, bow = 0, overshoot = closed ? 0 : 0.7, fill = null,
      fillAlpha = 1, dash = null,
    } = o
    const amp = this.px * 0.011 * this.rough * rough
    let base = resample(pts, this.step * (o.step ?? 1))
    if (base.length < 2) return
    if (!closed) base = this._overshoot(base, this.px * 0.02 * overshoot)

    if (fill) {
      this.s.path(smooth(this._waver(base, amp * 0.6), closed), {
        fill, alpha: fillAlpha, fillRule: o.fillRule,
      })
    }
    for (let p = 0; p < passes; p++) {
      const bowed = this._waver(base, amp * (p ? 1.35 : 1), p ? bow * 0.4 : bow * this.px * 0.01)
      this.s.path(smooth(bowed, closed), {
        stroke: color,
        width: this.w(weight * (p ? 0.72 : 1)),
        alpha: alpha * (p ? 0.42 : 1),
        cap: 'round',
        join: 'round',
        dash,
      })
    }
  }

  line(a: Pt, b: Pt, o: StrokeOptions = {}): void {
    this.stroke([a, b], o)
  }

  /**
   * Many small strokes as ONE path. Hatching a beard is fifty lines; fifty
   * <path> elements is fifty times the file for no visual gain.
   */
  strokeMany(paths: Pt[][], o: StrokeOptions = {}): void {
    const { color = this.ink, alpha = 1, weight = 0.5, rough = 1, closed = false } = o
    const amp = this.px * 0.011 * this.rough * rough
    const cmds: PathCmd[] = []
    for (const pts of paths) {
      if (!pts || pts.length < 2) continue
      const base = pts.length > 2 || o.detail
        ? resample(pts, this.step * (o.step ?? 1.6))
        : this._twitch(pts, amp)
      const c = smooth(this._waver(base, amp * 0.8), closed)
      for (const cm of c) cmds.push(cm)
    }
    this.s.path(cmds, { stroke: color, width: this.w(weight), alpha, cap: 'round', join: 'round' })
  }

  /** Cheap roughening for two-point strokes: just shove the ends about. */
  private _twitch(pts: Pt[], amp: number): Pt[] {
    const r = this.rng
    const a = pts[0], b = pts[pts.length - 1]
    const mx = (a[0] + b[0]) / 2 + r.gauss(0, amp * 0.9)
    const my = (a[1] + b[1]) / 2 + r.gauss(0, amp * 0.9)

    return [
      [a[0] + r.gauss(0, amp * 0.6), a[1] + r.gauss(0, amp * 0.6)],
      [mx, my],
      [b[0] + r.gauss(0, amp * 0.6), b[1] + r.gauss(0, amp * 0.6)],
    ]
  }

  /** Filled shape with a wobbly edge, optionally outlined. */
  blob(pts: Pt[] | null | undefined, o: BlobOptions = {}): void {
    if (!pts || pts.length < 3) return
    const { color = this.ink, alpha = 1, rough = 1, outline = null } = o
    const amp = this.px * 0.009 * this.rough * rough
    const base = resample(pts, this.step * (o.step ?? 1.2))
    this.s.path(smooth(this._waver(base, amp), true), { fill: color, alpha })
    if (outline) this.stroke(pts, { closed: true, color: outline, weight: o.weight ?? 1, passes: o.passes ?? 1 })
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0, o: EllipseOptions = {}): Pt[] {
    const seg = o.segments ?? Math.max(14, Math.round(10 + (rx + ry) * 0.5))
    const c = Math.cos(rot), s = Math.sin(rot)
    const pts: Pt[] = []
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2
      const x = Math.cos(t) * rx, y = Math.sin(t) * ry
      pts.push([cx + x * c - y * s, cy + x * s + y * c])
    }
    if (o.fill) {
      this.blob(pts, { color: o.fill, alpha: o.fillAlpha ?? 1, rough: o.rough })
    }
    if (o.stroke !== false) this.stroke(pts, { ...o, closed: true, fill: null })

    return pts
  }

  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number,
    rot = 0, o: EllipseOptions = {}): Pt[] {
    const seg = o.segments ?? Math.max(6, Math.round(Math.abs(a1 - a0) * 6))
    const c = Math.cos(rot), s = Math.sin(rot)
    const pts: Pt[] = []
    for (let i = 0; i <= seg; i++) {
      const t = a0 + ((a1 - a0) * i) / seg
      const x = Math.cos(t) * rx, y = Math.sin(t) * ry
      pts.push([cx + x * c - y * s, cy + x * s + y * c])
    }
    this.stroke(pts, o)

    return pts
  }

  dot(x: number, y: number, r: number, o: DotOptions = {}): void {
    const color = o.color ?? this.ink
    this.ellipse(x, y, r, r * this.rng.float(0.85, 1.15), 0, {
      fill: color, stroke: false, rough: 1.4, segments: 12, fillAlpha: o.alpha ?? 1,
    })
  }

  // -------------------------------------------------------------------- fills

  clip(poly: Pt[] | null | undefined, fn: () => void): void {
    if (!poly || poly.length < 3) {
      fn()

      return
    }
    this.s.clip(smooth(resample(poly, this.step * 1.5), true), fn)
  }

  /** Parallel pencil shading, clipped to a region. */
  hatch(poly: Pt[] | null | undefined, o: HatchOptions = {}): void {
    if (!poly || poly.length < 3) return
    const {
      angle = -0.5, gap = this.px * 0.055, color = this.ink,
      alpha = 0.85, weight = 0.55, cross = false, jitterGap = 0.4,
    } = o
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of poly) {
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const R = Math.hypot(x1 - x0, y1 - y0) * 0.62 + gap
    const lines = (ang: number): Pt[][] => {
      const dx = Math.cos(ang), dy = Math.sin(ang)
      const nx = -dy, ny = dx
      const out: Pt[][] = []
      for (let d = -R; d <= R; d += gap * this.rng.float(1 - jitterGap * 0.5, 1 + jitterGap)) {
        const bx = cx + nx * d, by = cy + ny * d
        const l = R * this.rng.float(0.8, 1.02)
        out.push([[bx - dx * l, by - dy * l], [bx + dx * l, by + dy * l]])
      }

      return out
    }
    this.clip(poly, () => {
      this.strokeMany(lines(angle), { color, alpha, weight, rough: 1.6 })
      if (cross) this.strokeMany(lines(angle + Math.PI / 2 + this.rng.jitter(0.2)), { color, alpha: alpha * 0.85, weight, rough: 1.6 })
    })
  }

  /** Loose circular scribble fill -- crayon, not pencil. */
  scribble(poly: Pt[], o: ScribbleOptions = {}): void {
    const { color = this.ink, alpha = 0.7, weight = 0.6, loops = 26 } = o
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of poly) {
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2
    const pts: Pt[] = []
    for (let i = 0; i <= loops * 12; i++) {
      const t = (i / 12) * Math.PI * 2 / 3
      const k = 0.15 + 0.9 * (i / (loops * 12))
      pts.push([cx + Math.cos(t * 1.7) * rx * k, cy + Math.sin(t) * ry * k])
    }
    this.clip(poly, () => this.stroke(pts, { color, alpha, weight, passes: 1, overshoot: 0, rough: 2 }))
  }

  /** Short marks scattered in a region -- stubble, freckles, texture. */
  speckle(poly: Pt[], o: SpeckleOptions = {}): void {
    const { count = 40, color = this.ink, alpha = 0.8, len = this.px * 0.03 } = o
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of poly) {
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    const marks: Pt[][] = []
    for (let i = 0; i < count; i++) {
      const x = this.rng.float(x0, x1), y = this.rng.float(y0, y1)
      const a = this.rng.float(0, Math.PI * 2)
      const l = len * this.rng.float(0.4, 1.3)
      marks.push([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]])
    }
    this.clip(poly, () => this.strokeMany(marks, { color, alpha, weight: 0.5, rough: 0.8 }))
  }
}

export { resample, smooth }
export default Pen
