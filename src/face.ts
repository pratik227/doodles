/**
 * Draw one face.
 *
 * Builds the invisible head, hands every feature a drawing frame glued to it,
 * and walks the layers in order. Nothing in here knows what a nose looks like;
 * that's the feature library's job.
 */

import { drawBeard, drawMoustache } from './features/facialhair'
import { drawBrows, drawEars, drawMouth } from './features/mouth'

import { Head } from './head'
import { Pen } from './pen'
import { Rng } from './rng'
import { drawAccessories } from './features/accessories'
import { drawBackdrop } from './features/backdrop'
import { drawEyes } from './features/eyes'
import { drawHair } from './features/hair'
import { drawHat } from './features/hats'
import { drawNose } from './features/nose'
import { makeGenome } from './genome'
import { marks as markFns } from './features/marks'
import { oval } from './shapes'

import type {
  BlobOptions, DotOptions, FeatureContext, Frame, Genome, HatchOptions,
  Overrides, Point2, Pt, StrokeOptions, Surface,
} from './types'
import type { Seed } from './rng'

export interface RenderFaceOptions {
  cx?: number
  cy?: number
  scale?: number
  seed?: Seed
  yaw?: number | null
  pitch?: number | null
  roll?: number | null
  genome?: Genome | null
  traits?: Overrides
  backdrop?: boolean
  rough?: number
  /** Perspective strength, in head radii. Larger is flatter. */
  focal?: number
}

export interface RenderFaceResult {
  genome: Genome
  head: Head
}

interface ContextParts {
  pen: Pen
  head: Head
  rng: Rng
  g: Genome
  px: number
}

/**
 * Helpers handed to every feature. They all speak feature space -- x across
 * the face, y down it, z out of it -- and the frame does the rest.
 */
function makeContext({ pen, head, rng, g, px }: ContextParts): FeatureContext {
  const c: FeatureContext = {
    pen, head, rng, g, px, pal: g.palette,

    /** Stroke a path given in feature space. */
    draw(f: Frame, pts: Pt[], o: StrokeOptions = {}) {
      pen.stroke(f.poly(pts), o)
    },

    /** Fill a shape given in feature space. */
    fill(f: Frame, pts: Pt[], o: BlobOptions = {}) {
      pen.blob(f.poly(pts), o)
    },

    oval(f: Frame, cx: number, cy: number, rx: number, ry: number, rot = 0,
      o: StrokeOptions & { segments?: number, z?: number } = {}) {
      const pts = oval(cx, cy, rx, ry, rot, o.segments ?? 18, o.z ?? 0)
      pen.stroke(f.poly(pts), { closed: true, ...o })
    },

    /** A dot that foreshortens properly, because it is a tiny filled oval. */
    dot(f: Frame, x: number, y: number, r: number, o: DotOptions = {}) {
      const pts = oval(x, y, r, r * rng.float(0.85, 1.15), 0, 12, o.z ?? 0)
      pen.blob(f.poly(pts), { color: o.color ?? g.palette.ink, alpha: o.alpha ?? 1, rough: 1.5 })
    },

    hatch(f: Frame, pts: Pt[], o: HatchOptions = {}) {
      pen.hatch(f.poly(pts), o)
    },

    /**
     * Ears are the one feature that refuses to be a decal. A patch of skin on
     * the side of the skull is edge-on from the front, which would draw an ear
     * as a vertical scratch -- so the drawing plane swings between the surface
     * tangent (at profile, where you see the ear face-on) and the outward
     * normal (head-on, where a doodle ear sticks out sideways).
     */
    earFrame(f: Frame): Frame {
      const a = Math.min(1, Math.abs(f.facing))
      const bx = f.ex[0] * a + f.ez[0] * (1 - a)
      const by = f.ex[1] * a + f.ez[1] * (1 - a)
      const want = Math.max(Math.hypot(f.ex[0], f.ex[1]), Math.hypot(f.ez[0], f.ez[1]))
      const have = Math.hypot(bx, by) || 1
      const ex: Point2 = [(bx / have) * want, (by / have) * want]
      const map = (x: number, y: number, z = 0): Point2 => [
        f.o[0] + x * ex[0] + y * f.ey[0] + z * f.ez[0],
        f.o[1] + x * ex[1] + y * f.ey[1] + z * f.ez[1],
      ]

      return { ...f, ex, map, poly: (pts: Pt[]) => pts.map((p) => map(p[0], p[1], p[2] || 0)) }
    },

    /** Same patch of skin, feature space flipped, so pairs read as pairs. */
    mirrorFrame(f: Frame): Frame {
      return {
        ...f,
        ex: [-f.ex[0], -f.ex[1]] as Point2,
        map: (a: number, b: number, cz = 0) => f.map(-a, b, cz),
        poly: (pts: Pt[]) => pts.map((p) => f.map(-p[0], p[1], p[2] || 0)),
      }
    },
  }

  return c
}

export function renderFace(surface: Surface, opts: RenderFaceOptions = {}): RenderFaceResult {
  const {
    cx = surface.width / 2,
    cy = surface.height / 2,
    scale = Math.min(surface.width, surface.height) * 0.3,
    seed = 1,
    yaw = null, pitch = null, roll = null,
    genome: given = null,
    traits = {},
    backdrop = true,
    rough = 1,
  } = opts

  const g = given || makeGenome(seed, traits)
  const rng = new Rng(`${g.seed}~ink`)

  const head = new Head({
    ...g.skull,
    cx, cy, scale,
    focal: opts.focal ?? 7,
    yaw: yaw ?? g.orientation.yaw,
    pitch: pitch ?? g.orientation.pitch,
    roll: roll ?? g.orientation.roll,
  })

  const pen = new Pen(surface, rng, { px: scale, ink: g.ink, rough })
  const c = makeContext({ pen, head, rng, g, px: scale })

  // ------------------------------------------------------------ layer order
  if (backdrop) drawBackdrop(c)

  const sil = head.silhouette(108)

  if (g.skin) {
    pen.blob(sil.pts, { color: g.skin, rough: 0.9, step: 1.4 })
    // A little tone on the side the light isn't coming from.
    if (g.shade !== false && rng.bool(0.28)) {
      const shade = head.cap({ v: 0.1, axis: [rng.sign() * 0.9, 0.1, 0.3], grow: -0.004 })
      pen.hatch(shade.poly, { angle: rng.float(-1.3, 1.3), gap: scale * 0.055, color: g.ink, alpha: 0.08, weight: 0.35 })
    }
  }

  // Cheek washes sit under the ink, like paint under pen.
  for (const m of g.marks) if (m.type === 'blush') markFns.blush(c, m)

  pen.stroke(sil.pts, { closed: true, weight: 1.15, passes: 2, rough: 0.9, step: 1.5 })

  drawEars(c)
  drawBrows(c)
  drawEyes(c)
  drawNose(c)
  drawBeard(c)
  drawMouth(c)
  drawMoustache(c)
  drawHair(c)
  drawHat(c)
  drawAccessories(c)

  for (const m of g.marks) if (m.type !== 'blush') (markFns[m.type] || (() => { }))(c, m)

  return { genome: g, head }
}

export default renderFace
