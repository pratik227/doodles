/**
 * Turning a face into a file.
 *
 * Stills go through a canvas (or straight out as SVG text, which needs no
 * canvas at all). Animation records a real canvas with `MediaRecorder`, which
 * is the one way to get a webm out of a browser without shipping a codec.
 *
 * Everything here is framework-free and returns a `File`, so it drops equally
 * well into a download link, a `FormData`, or an upload.
 */

import { drawFaceOnCanvas, drawPlateOnCanvas, faceSVG, faceSize, plateSVG, plateSize } from './core'
import { makeGenome } from '../genome'
import { poseAt, resolvePose } from '../poses'

import type { FaceOptions, PlateOptions } from './core'
import type { Genome } from '../types'
import type { Keyframe, Pose, PoseName } from '../poses'
import type { Seed } from '../rng'

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg'

const MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

const EXT: Record<ImageFormat, string> = {
  png: 'png', jpeg: 'jpg', webp: 'webp', svg: 'svg',
}

/** Formats without an alpha channel, which therefore need a solid ground. */
const OPAQUE = new Set<ImageFormat>(['jpeg'])

/** webm codecs worth asking for, best first. */
const VIDEO_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export interface ImageFileOptions extends FaceOptions {
  /** Default `png`. `jpeg` and `webp` honour `quality`. */
  format?: ImageFormat
  /** 0..1, for the lossy formats. Default 0.92. */
  quality?: number
  /** Default `naives-<seed>.<ext>`. */
  filename?: string
}

export interface PlateFileOptions extends PlateOptions {
  format?: ImageFormat
  quality?: number
  filename?: string
}

export interface VideoFileOptions extends FaceOptions {
  /** A built-in name, your own function, or keyframes. Default `turntable`. */
  pose?: PoseName | Pose | Keyframe[]
  /** Seconds of finished clip. Default 10. */
  duration?: number
  /** Default 24. */
  fps?: number
  /** Cycles of the pose within the clip. Default 1 -- one seamless loop. */
  loops?: number
  /** Overrides the auto-detected webm codec. */
  mimeType?: string
  videoBitsPerSecond?: number
  /** Default `naives-<seed>.webm`. */
  filename?: string
  /** Called with 0..1 as the clip records. */
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

// ------------------------------------------------------------------- stills

/** One face as a `File`. */
export async function faceFile(options: ImageFileOptions = {}): Promise<File> {
  const format = options.format ?? 'png'
  const genome = options.genome ?? makeGenome(options.seed ?? 'naives', options.traits ?? {})
  const opts = { ...options, genome, background: groundFor(options, format, genome) }

  if (format === 'svg') {
    return textFile(faceSVG(opts).svg, name(options.filename, options.seed, format))
  }
  const { width, height } = faceSize(opts)
  const canvas = rasterCanvas(width * ratio(opts), height * ratio(opts))
  drawFaceOnCanvas(canvas, { ...opts, pixelRatio: ratio(opts) })

  return blobFile(await toBlob(canvas, MIME[format], options.quality),
    name(options.filename, options.seed, format), MIME[format])
}

/** A whole plate as a `File`. */
export async function plateFile(options: PlateFileOptions = {}): Promise<File> {
  const format = options.format ?? 'png'
  const opts = { ...options, background: options.background ?? (OPAQUE.has(format) ? '#efe9dd' : null) }

  if (format === 'svg') {
    return textFile(plateSVG(opts).svg, name(options.filename, options.seed, format, 'plate'))
  }
  const { width, height } = plateSize(opts)
  const canvas = rasterCanvas(width * ratio(opts), height * ratio(opts))
  drawPlateOnCanvas(canvas, { ...opts, pixelRatio: ratio(opts) })

  return blobFile(await toBlob(canvas, MIME[format], options.quality),
    name(options.filename, options.seed, format, 'plate'), MIME[format])
}

// ---------------------------------------------------------------- animation

/** Is `MediaRecorder` here, and will it give us a webm? */
export function canRecordVideo(): boolean {
  return pickVideoMime() !== null
}

/** The best webm flavour this browser will record, or null if it won't. */
export function pickVideoMime(): string | null {
  const R = globalThis.MediaRecorder as typeof MediaRecorder | undefined
  if (typeof R === 'undefined') return null
  for (const type of VIDEO_TYPES) {
    if (!R.isTypeSupported || R.isTypeSupported(type)) return type
  }

  return null
}

/**
 * A looping clip of the face moving through a pose, as a webm `File`.
 *
 * Recording happens in real time -- a ten second clip takes ten seconds --
 * because that is how `MediaRecorder` stamps its frames. `onProgress` is there
 * to keep a button honest about it.
 */
export async function faceVideoFile(options: VideoFileOptions = {}): Promise<File> {
  const mimeType = options.mimeType ?? pickVideoMime()
  if (!mimeType) {
    throw new Error('naives: this environment cannot record webm (no MediaRecorder)')
  }
  const duration = Math.max(0.1, options.duration ?? 10)
  const fps = Math.max(1, options.fps ?? 24)
  const loops = Math.max(1, options.loops ?? 1)
  const pose = resolvePose(options.pose)
  const genome = options.genome ?? makeGenome(options.seed ?? 'naives', options.traits ?? {})
  const base = { yaw: options.yaw, pitch: options.pitch, roll: options.roll }

  const { width, height } = faceSize(options)
  const canvas = displayCanvas(width * ratio(options), height * ratio(options))
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    ...(options.videoBitsPerSecond ? { videoBitsPerSecond: options.videoBitsPerSecond } : {}),
  })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size) chunks.push(e.data)
  }

  const done = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('naives: recording failed'))
  })

  const paint = (t: number) => {
    drawFaceOnCanvas(canvas, {
      ...options,
      genome,
      pixelRatio: ratio(options),
      ...poseAt(pose, t, base),
    })
  }

  paint(0)
  recorder.start()

  const totalMs = duration * 1000
  const started = now()
  try {
    for (;;) {
      if (options.signal?.aborted) throw abortError()
      const elapsed = now() - started
      if (elapsed >= totalMs) break
      // One cycle of the pose per `1 / loops` of the clip, so the last frame
      // lands back on the first however many times it goes round.
      paint(((elapsed / totalMs) * loops) % 1)
      options.onProgress?.(Math.min(1, elapsed / totalMs))
      await nextFrame(fps)
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop()
    for (const track of stream.getTracks()) track.stop()
  }
  await done
  options.onProgress?.(1)

  return blobFile(new Blob(chunks, { type: mimeType }),
    name(options.filename, options.seed, 'webm'), mimeType)
}

// ------------------------------------------------------------------ private

const ratio = (o: { pixelRatio?: number }): number => Math.max(1, o.pixelRatio ?? 1)

/** jpeg has no alpha, so give it the face's own paper rather than black. */
function groundFor(o: FaceOptions, format: ImageFormat, genome: Genome): string | null {
  if (o.background !== undefined) return o.background

  return OPAQUE.has(format) ? genome.paper : null
}

function name(given: string | undefined, seed: Seed | undefined,
  format: ImageFormat | 'webm', kind = 'face'): string {
  if (given) return given
  const ext = format === 'webm' ? 'webm' : EXT[format]
  const slug = String(seed ?? kind).replace(/[^\w.-]+/g, '-').slice(0, 48) || kind

  return `naives-${slug}.${ext}`
}

function textFile(text: string, filename: string): File {
  return new File([text], filename, { type: MIME.svg })
}

function blobFile(blob: Blob, filename: string, type: string): File {
  return new File([blob], filename, { type })
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

/** Offscreen where we can get it -- it is cheaper and needs no document. */
function rasterCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height))
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)

  return displayCanvas(w, h)
}

/** `captureStream` only exists on a real <canvas>, so recording needs one. */
function displayCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('naives: rendering to a file needs a canvas (no document here)')
  }
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))

  return c
}

function toBlob(canvas: AnyCanvas, type: string, quality = 0.92): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`naives: could not encode ${type}`))),
      type, quality)
  })
}

const now = (): number =>
  (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** rAF when there is a screen to sync to, a timer when there is not. */
function nextFrame(fps: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 1000 / fps)
  })
}

function abortError(): Error {
  const e = new Error('naives: recording aborted')
  e.name = 'AbortError'

  return e
}

export type { FaceOptions, PlateOptions } from './core'
