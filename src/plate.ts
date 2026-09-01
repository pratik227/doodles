/**
 * A plate: a grid of faces on one sheet, the way the reference sheets are laid
 * out. Every cell is just renderFace with a different centre and seed.
 */

import { PAPER } from './palette'

import type { Genome, Overrides, Surface } from './types'
import type { Seed } from './rng'

export interface RenderPlateOptions {
  cols?: number
  rows?: number
  seed?: Seed
  margin?: number | null
  paper?: boolean
  paperColor?: string
  scaleFactor?: number
  /** How much each face wanders in its cell. */
  jitter?: number
  /** Max |yaw| in radians; 0 keeps the plate frontal. */
  turn?: number
  /** Max |pitch|. */
  tilt?: number
  /** Max |roll|. */
  lean?: number
  seedPrefix?: string | null
  rough?: number
  traits?: Overrides
}

export interface PlateCell {
  seed: string
  cx: number
  cy: number
  scale: number
  genome: Genome
}
import { Rng } from './rng'
import { renderFace } from './face'

export function renderPlate(surface: Surface, opts: RenderPlateOptions = {}): PlateCell[] {
  const {
    cols = 6,
    rows = 8,
    seed = 'plate',
    margin = null,
    paper = true,
    scaleFactor = 0.3,
    jitter = 0.16,          // how much each face wanders in its cell
    turn = 0,               // max |yaw| in radians; 0 keeps the plate frontal
    tilt = 0,               // max |pitch|
    lean = 0.05,            // max |roll|
    seedPrefix = null,
  } = opts

  const rng = new Rng(`${seed}~plate`)
  if (paper) surface.background(opts.paperColor || rng.pick(PAPER))
  if (paper && surface.paperTexture) {
    surface.paperTexture(surface.constructor.name === 'SVGSurface'
      ? { opacity: 0.28, freq: 1.1 }
      : { opacity: 0.05, scale: 1, rng: () => rng.next() })
  }

  const pad = margin ?? Math.min(surface.width, surface.height) * 0.05
  const cw = (surface.width - pad * 2) / cols
  const ch = (surface.height - pad * 2) / rows
  const cell = Math.min(cw, ch)
  const faces: PlateCell[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      const fseed = `${seedPrefix ?? seed}-${i}`
      const cx = pad + cw * (col + 0.5) + rng.gauss(0, cell * jitter * 0.25)
      const cy = pad + ch * (row + 0.5) + rng.gauss(0, cell * jitter * 0.25)
      const scale = cell * scaleFactor * rng.float(0.86, 1.12)
      const res = renderFace(surface, {
        cx, cy, scale, seed: fseed,
        yaw: turn ? rng.gauss(0, turn / 2) : 0,
        pitch: tilt ? rng.gauss(0, tilt / 2) : 0,
        roll: lean ? rng.gauss(0, lean / 2) : 0,
        rough: opts.rough ?? 1,
      })
      faces.push({ seed: fseed, cx, cy, scale, genome: res.genome })
    }
  }

  return faces
}

export default renderPlate
