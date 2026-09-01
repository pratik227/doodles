/**
 * The bit every UI framework needs, written once.
 *
 * `renderFace` wants a surface, a centre, a scale and radians. A component
 * wants a size in pixels and an angle in degrees. This is the translation --
 * no framework imported, so React and Vue can share every line of it.
 */

import { Canvas2DSurface } from '../surfaces/canvas2d'
import { SVGSurface } from '../surfaces/svg'
import { renderFace } from '../face'
import { renderPlate } from '../plate'
import { drawRig } from '../rig'

import type { Ctx2D } from '../surfaces/canvas2d'
import type { Genome, Overrides } from '../types'
import type { Head } from '../head'
import type { PlateCell } from '../plate'
import type { Seed } from '../rng'

const RAD = Math.PI / 180

/** Grain opacities that suit each surface -- SVG filters far more cheaply. */
const GRAIN = { svg: 0.25, canvas: 0.05 }

const grainFor = (paper: boolean | number | undefined, fallback: number): number | null => {
  if (paper === false || paper == null) return null

  return paper === true ? fallback : paper
}

export interface FaceOptions {
  seed?: Seed
  /** A genome you already have. Overrides `seed` and `traits`. */
  genome?: Genome | null
  /** Pin features: `{ nose: 'hook', eyes: { left: { type: 'spiral' } } }`. */
  traits?: Overrides
  /** Degrees, the way the CLI and the sliders take them. */
  yaw?: number
  pitch?: number
  roll?: number
  width?: number
  /** Defaults to `width * 1.2` -- portrait, like the reference plates. */
  height?: number
  /** Head radius in pixels. Defaults to 30% of the smaller side. */
  scale?: number
  background?: string | null
  /** `true` for the default grain, a number for its opacity, `false` for none. */
  paper?: boolean | number
  backdrop?: boolean
  rough?: number
  /** Perspective strength in head radii; larger is flatter. */
  focal?: number
  /** Draw the invisible head over the drawing. */
  rig?: boolean
  /**
   * Backing-store pixels per CSS pixel. Defaults to the display's, capped at
   * 2; set it explicitly when you want an exact pixel count, as a file export
   * does.
   */
  pixelRatio?: number
}

export interface PlateOptions {
  cols?: number
  rows?: number
  seed?: Seed
  traits?: Overrides
  /** Degrees: the widest each face may turn, tilt and lean. */
  turn?: number
  tilt?: number
  lean?: number
  width?: number
  height?: number
  scaleFactor?: number
  background?: string | null
  paper?: boolean | number
  rough?: number
  /** See `FaceOptions.pixelRatio`. */
  pixelRatio?: number
}

export interface FaceResult {
  genome: Genome
  head: Head
}

export interface SVGResult extends FaceResult {
  svg: string
}

export interface PlateSVGResult {
  svg: string
  faces: PlateCell[]
}

/** Width and height a face gets when nobody says otherwise. */
export function faceSize(o: FaceOptions): { width: number, height: number, scale: number } {
  const width = o.width ?? 320
  const height = o.height ?? Math.round(width * 1.2)

  return { width, height, scale: o.scale ?? Math.min(width, height) * 0.3 }
}

export function plateSize(o: PlateOptions): { width: number, height: number } {
  const cols = o.cols ?? 6
  const rows = o.rows ?? 8
  const width = o.width ?? 960
  const height = o.height ?? Math.round((width / cols) * rows * 1.02)

  return { width, height }
}

/** One face as an SVG string, ready to inline. */
export function faceSVG(o: FaceOptions = {}): SVGResult {
  const { width, height, scale } = faceSize(o)
  const s = new SVGSurface({ width, height, background: o.background ?? null })
  const grain = grainFor(o.paper, GRAIN.svg)
  if (grain != null) s.paperTexture({ opacity: grain })
  const res = paintFace(s, o, width, height, scale)

  return { svg: s.toString(), ...res }
}

/** A grid of faces as an SVG string, plus where each one landed. */
export function plateSVG(o: PlateOptions = {}): PlateSVGResult {
  const { width, height } = plateSize(o)
  const s = new SVGSurface({ width, height, background: o.background ?? null })
  const grain = grainFor(o.paper, GRAIN.svg)
  if (grain != null) s.paperTexture({ opacity: grain })
  const faces = paintPlate(s, o)

  return { svg: s.toString(), faces }
}

/**
 * Paint one face onto a 2D context, sizing the canvas for the display.
 * Returns the genome, so a caption can describe what was drawn.
 */
export function drawFaceOnCanvas(canvas: HTMLCanvasElement | OffscreenCanvas,
  o: FaceOptions = {}): FaceResult | null {
  const { width, height, scale } = faceSize(o)
  const ctx = fitCanvas(canvas, width, height, o.pixelRatio)
  if (!ctx) return null
  const surface = new Canvas2DSurface(ctx, width, height)
  if (o.background) surface.background(o.background)
  const res = paintFace(surface, o, width, height, scale)
  const grain = grainFor(o.paper, GRAIN.canvas)
  if (grain != null) surface.paperTexture({ opacity: grain, rng: seededNoise(o.seed) })

  return res
}

export function drawPlateOnCanvas(canvas: HTMLCanvasElement | OffscreenCanvas,
  o: PlateOptions = {}): PlateCell[] {
  const { width, height } = plateSize(o)
  const ctx = fitCanvas(canvas, width, height, o.pixelRatio)
  if (!ctx) return []
  const surface = new Canvas2DSurface(ctx, width, height)
  if (o.background) surface.background(o.background)
  const faces = paintPlate(surface, o)
  const grain = grainFor(o.paper, GRAIN.canvas)
  if (grain != null) surface.paperTexture({ opacity: grain, rng: seededNoise(o.seed) })

  return faces
}

/**
 * Which plate cell is under a click, in canvas pixels. Returns null when the
 * pointer is in the gutter rather than on a face.
 */
export function pickFace(faces: PlateCell[], x: number, y: number): PlateCell | null {
  let best: PlateCell | null = null, bd = Infinity
  for (const f of faces) {
    const d = (f.cx - x) ** 2 + (f.cy - y) ** 2
    if (d < bd) {
      bd = d; best = f
    }
  }

  return best && bd < (best.scale * 1.6) ** 2 ? best : null
}

/** Canvas pixels for a pointer event, undoing CSS scaling and the DPR. */
export function pointerToCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number,
  width: number, height: number): { x: number, y: number } {
  const rect = canvas.getBoundingClientRect()

  return {
    x: ((clientX - rect.left) / (rect.width || 1)) * width,
    y: ((clientY - rect.top) / (rect.height || 1)) * height,
  }
}

// ------------------------------------------------------------------ private

function paintFace(surface: SVGSurface | Canvas2DSurface, o: FaceOptions,
  width: number, height: number, scale: number): FaceResult {
  const res = renderFace(surface, {
    seed: o.seed ?? 'naives',
    genome: o.genome ?? null,
    traits: o.traits ?? {},
    cx: width / 2,
    cy: height / 2,
    scale,
    yaw: (o.yaw ?? 0) * RAD,
    pitch: (o.pitch ?? 0) * RAD,
    roll: (o.roll ?? 0) * RAD,
    backdrop: o.backdrop ?? true,
    rough: o.rough ?? 1,
    focal: o.focal ?? 7,
  })
  if (o.rig) drawRig(surface, res.head, res.genome)

  return res
}

function paintPlate(surface: SVGSurface | Canvas2DSurface, o: PlateOptions): PlateCell[] {
  return renderPlate(surface, {
    cols: o.cols ?? 6,
    rows: o.rows ?? 8,
    seed: o.seed ?? 'plate',
    traits: o.traits,
    turn: (o.turn ?? 0) * RAD,
    tilt: (o.tilt ?? 0) * RAD,
    lean: (o.lean ?? 3) * RAD,
    scaleFactor: o.scaleFactor ?? 0.3,
    rough: o.rough ?? 1,
    // The surface already carries the background and grain the caller asked
    // for, so the plate must not paint its own on top.
    paper: false,
  })
}

/**
 * Size the backing store for the device, then hand back a context that draws
 * in CSS pixels.
 */
function fitCanvas(canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number, height: number, pixelRatio?: number): Ctx2D | null {
  const dpr = pixelRatio
    ?? (typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1))
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  if ('style' in canvas) {
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }
  const ctx = canvas.getContext('2d') as Ctx2D | null
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  return ctx
}

/** Grain that is stable for a seed, so a repaint doesn't reshuffle the paper. */
function seededNoise(seed: Seed | undefined): () => number {
  let h = 0
  const s = String(seed ?? 'naives')
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0

  return () => {
    h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0

    return (h >>> 8) / 0x1000000
  }
}
